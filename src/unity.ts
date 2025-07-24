import core = require('@actions/core');
import path = require('path');
import fs = require('fs');
import { spawn, exec } from 'child_process';
import * as util from 'util';
import { ProcInfo, UnityCommand } from './types';
import { cleanupProcessOrphans, getArgumentValue, listProcesses } from './utils';

const pidFile = path.join(process.env.RUNNER_TEMP || process.env.USERPROFILE, '.unity', 'unity-editor-process-id.txt');
const execAsync = util.promisify(exec);

export async function ExecUnity(command: UnityCommand): Promise<void> {
    let isCancelled = false;
    process.once('SIGINT', async () => {
        await tryKillPid(pidFile);
        isCancelled = true;
    });
    process.once('SIGTERM', async () => {
        await tryKillPid(pidFile);
        isCancelled = true;
    });
    const beforeProcs = await listProcesses();
    const beforePids = new Set(beforeProcs.map(p => p.pid));
    let exitCode: number;
    let unityProcInfo: ProcInfo | null = null;
    try {
        core.info(`[command]"${command.editorPath}" ${command.args.join(' ')}`);
        exitCode = await execUnity(command, pInfo => { unityProcInfo = pInfo; });
    } finally {
        if (!isCancelled) {
            const killedPid = await tryKillPid(pidFile);
            if (killedPid && killedPid !== unityProcInfo.pid) {
                core.warning(`Killed process with pid ${killedPid} but expected pid ${unityProcInfo}`);
            }
            if (unityProcInfo) {
                await cleanupProcessOrphans(unityProcInfo, beforePids);
            }
            if (exitCode !== 0) {
                throw Error(`Unity failed with exit code ${exitCode}`);
            }
        }
    }
}

async function tryKillPid(pidFile: string): Promise<number | null> {
    let pid: number | null = null;
    try {
        if (!fs.existsSync(pidFile)) {
            core.debug(`PID file does not exist: ${pidFile}`);
            return null;
        }
        const fileHandle = await fs.promises.open(pidFile, 'r');
        try {
            pid = parseInt(await fileHandle.readFile('utf8'));
            core.debug(`Attempting to kill Unity process with pid: ${pid}`);
            process.kill(pid);
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
    return pid;
}

async function execUnity(command: UnityCommand, onPid: (pid: ProcInfo) => void): Promise<number> {
    const logPath = getArgumentValue('-logFile', command.args);
    if (!logPath) {
        throw Error('Log file path not specified in command arguments');
    }
    const unityProcess = spawn(command.editorPath, command.args, { stdio: ['ignore', 'ignore', 'ignore'], detached: true });
    const processId = unityProcess.pid;
    if (processId === undefined) {
        throw new Error('Failed to start Unity process');
    }
    onPid({ pid: processId, ppid: process.pid, name: command.editorPath });
    core.debug(`Unity process started with pid: ${processId}`);
    fs.writeFileSync(pidFile, String(processId));

    const logPollingInterval = 100; // milliseconds

    // Wait for log file to appear
    while (!fs.existsSync(logPath)) {
        await new Promise(res => setTimeout(res, logPollingInterval));
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
            await new Promise(res => setTimeout(res, logPollingInterval));
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

    // Wait for log file to be unlocked
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
            await new Promise(res => setTimeout(res, logPollingInterval));
        }
    }
    return exitCode;
}
