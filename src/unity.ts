import core = require('@actions/core');
import path = require('path');
import fs = require('fs');
import { spawn, exec } from 'child_process';
import * as util from 'util';
const execAsync = util.promisify(exec);

const pidFile = path.join(process.env.RUNNER_TEMP, 'unity-process-id.txt');
let isCancelled = false;

export async function ExecUnity(editorPath: string, args: string[]): Promise<void> {
    process.once('SIGINT', async () => {
        await tryKillPid(pidFile);
        isCancelled = true;
    });
    process.once('SIGTERM', async () => {
        await tryKillPid(pidFile);
        isCancelled = true;
    });
    core.info(`[command]"${editorPath}" ${args.join(' ')}`);

    const beforeProcs = await listProcesses();
    const beforePids = new Set(beforeProcs.map(p => p.pid));

    let exitCode: number;
    let unityPid: number | undefined;
    try {
        exitCode = await execUnity(editorPath, args, pid => { unityPid = pid; });
    } finally {
        if (!isCancelled) {
            await tryKillPid(pidFile);
            if (unityPid) {
                await cleanupUnityOrphans(unityPid, beforePids);
            }
            if (exitCode !== 0) {
                throw Error(`Unity failed with exit code ${exitCode}`);
            }
        }
    }
}

function getLogFilePath(args: string[]): string {
    const logFileIndex = args.indexOf('-logFile');
    if (logFileIndex === -1) {
        throw Error('Missing -logFile argument');
    }
    return args[logFileIndex + 1];
}

async function tryKillPid(pidFile: string): Promise<void> {
    try {
        const fileHandle = await fs.promises.open(pidFile, 'r');
        try {
            const pid = await fileHandle.readFile('utf8');
            core.debug(`Attempting to kill Unity process with pid: ${pid}`);
            process.kill(parseInt(pid));
        } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ESRCH') {
                core.error(`Failed to kill Unity process:\n${JSON.stringify(error)}`);
            }
        } finally {
            await fileHandle.close();
            await fs.promises.unlink(pidFile);
        }

    } catch (error) {
        // ignored
    }
}

async function execUnity(editorPath: string, args: string[], onPid: (pid: number) => void): Promise<number> {
    const logPath = getLogFilePath(args);
    const unityProcess = spawn(editorPath, args, { stdio: ['ignore', 'ignore', 'ignore'], detached: true });
    const processId = unityProcess.pid;
    if (processId === undefined) {
        throw new Error('Failed to start Unity process');
    }
    onPid(processId);
    core.debug(`Unity process started with pid: ${processId}`);
    fs.writeFileSync(pidFile, String(processId));

    // Wait for log file to appear
    while (!fs.existsSync(logPath)) {
        await new Promise(res => setTimeout(res, 100));
    }

    // Start tailing the log file
    let lastSize = 0;
    let logEnded = false;
    const tailLog = async () => {
        while (!logEnded) {
            try {
                const stats = fs.statSync(logPath);
                if (stats.size > lastSize) {
                    const fd = fs.openSync(logPath, 'r');
                    const buffer = Buffer.alloc(stats.size - lastSize);
                    fs.readSync(fd, buffer, 0, buffer.length, lastSize);
                    process.stdout.write(buffer.toString('utf8'));
                    fs.closeSync(fd);
                    lastSize = stats.size;
                }
            } catch (err) {
                // ignore read errors
            }
            await new Promise(res => setTimeout(res, 250));
        }
    };

    const timeout = 10000; // 10 seconds

    // Start log tailing in background
    const tailPromise = tailLog();

    const exitCode: number = await new Promise((resolve, reject) => {
        unityProcess.on('exit', (code: number) => {
            setTimeout(() => {
                logEnded = true;
                resolve(code ?? 1);
            }, timeout);
        });
        unityProcess.on('error', (error: Error) => {
            setTimeout(() => {
                logEnded = true;
                reject(error);
            }, timeout);
        });
    });

    // Wait for log tailing to finish
    await tailPromise;

    // Wait for log file to be unlocked (optional, keep original logic)
    const start = Date.now();
    let fileLocked = true;
    while (fileLocked && Date.now() - start < timeout) {
        try {
            if (fs.existsSync(logPath)) {
                const fd = fs.openSync(logPath, 'r+');
                fs.closeSync(fd);
                fileLocked = false;
            } else {
                fileLocked = false;
            }
        } catch {
            fileLocked = true;
            await new Promise(res => setTimeout(res, 100));
        }
    }
    return exitCode;
}

type ProcInfo = { pid: number, ppid: number, name: string };

const systemProcessNames = [
    'System',
    'Idle',
    'Spotlight',
    'svchost.exe',
    'explorer.exe',
    'services.exe',
    'wininit.exe',
    'winlogon.exe',
    'lsass.exe',
    'csrss.exe',
    'smss.exe',
    'init',
    'kthreadd',
    'kworker',
    'systemd',
    'launchd',
    'kernel_task',
    'Finder',
    'Dock',
    'WindowServer',
    'logd',
    'securityd',
    'notifyd',
    'unattended-upgrades',
    'cron',
    'atd',
    'dbus-daemon'
];

async function listProcesses(): Promise<ProcInfo[]> {
    try {
        const filterSystem = (name: string) => {
            return !systemProcessNames.some(sysName => name && name.toLowerCase().includes(sysName.toLowerCase()));
        };
        if (process.platform === 'win32') {
            // Use PowerShell Get-CimInstance for process listing
            const winProcessCli = 'powershell -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Csv -NoTypeInformation"';
            core.debug(`${winProcessCli}:`);
            const { stdout } = await execAsync(winProcessCli);
            const lines = stdout.split(/\r?\n/).filter(l => l.trim());
            const procs: ProcInfo[] = [];
            for (const line of lines.slice(1)) {
                const parts = line.split(',');
                core.debug(line);
                if (parts.length >= 3 && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
                    const procName = parts[3] || parts[2];
                    if (filterSystem(procName)) {
                        procs.push({
                            name: procName,
                            pid: Number(parts[1]),
                            ppid: Number(parts[2])
                        });
                    }
                }
            }
            return procs;
        } else {
            const unixProcessCli = 'ps -eo pid,ppid,comm';
            core.debug(`${unixProcessCli}:`);
            const { stdout } = await execAsync(unixProcessCli);
            const lines = stdout.split(/\r?\n/).slice(1).filter(l => l.trim());
            const procs: ProcInfo[] = [];
            for (const line of lines) {
                core.debug(line);
                const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
                if (match) {
                    const procName = match[3];
                    if (filterSystem(procName)) {
                        procs.push({
                            pid: Number(match[1]),
                            ppid: Number(match[2]),
                            name: procName
                        });
                    }
                }
            }
            return procs;
        }
    } catch (error) {
        core.error(`Failed to list processes:\n${error}`);
        return [];
    }
}

async function cleanupUnityOrphans(unityPid: number, beforePids: Set<number>) {
    const procs = await listProcesses();
    core.startGroup(`Found ${procs.length} processes after Unity started.`);
    for (const proc of procs) {
        // Skip system processes
        if (systemProcessNames.some(name => proc.name && proc.name.toLowerCase().includes(name.toLowerCase()))) {
            continue;
        }
        if (proc.ppid === unityPid) {
            // Only kill processes whose parent is Unity
            try {
                process.kill(proc.pid);
                core.info(`Killed orphaned Unity child process: ${proc.name} (pid: ${proc.pid})`);
            } catch (error) {
                if ((error as NodeJS.ErrnoException)?.code === 'ESRCH') {
                    core.info(`Orphaned process ${proc.name} (pid: ${proc.pid}) already exited.`);
                } else {
                    core.error(`Failed to kill orphaned process ${proc.name} (pid: ${proc.pid}):\n\t${error}`);
                }
            }
        } else if (!beforePids.has(proc.pid)) {
            // Log processes that weren't present before Unity started but are not Unity children
            core.info(`Detected new process not parented by Unity: ${proc.name} (pid: ${proc.pid}, ppid: ${proc.ppid})`);
        }
    }
    core.endGroup();
}