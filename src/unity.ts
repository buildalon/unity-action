import core = require('@actions/core');
import path = require('path');
import fs = require('fs');
import {
    ChildProcessByStdio,
    spawn
} from 'child_process';
import {
    ProcInfo,
    UnityCommand
} from './types';
import {
    cleanupProcessOrphans,
    getArgumentValue,
    listProcesses,
    tryKillPid
} from './utils';

const pidFile = path.join(process.env.RUNNER_TEMP || process.env.USERPROFILE, '.unity', 'unity-editor-process-id.txt');

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
    let exitCode: number;
    let unityProcInfo: ProcInfo | null = null;
    try {
        core.info(`[command]"${command.editorPath}" ${command.args.join(' ')}`);
        exitCode = await exec(command, pInfo => { unityProcInfo = pInfo; });
    } catch (error) {
        core.error(`Unity execution failed:\n${error}`);
        if (!exitCode) {
            exitCode = 1;
        }
    } finally {
        if (!isCancelled) {
            const killedPid = await tryKillPid(pidFile);
            if (unityProcInfo) {
                if (killedPid && killedPid !== unityProcInfo.pid) {
                    core.warning(`Killed process with pid ${killedPid} but expected pid ${unityProcInfo.pid}`);
                }
                await cleanupProcessOrphans(unityProcInfo);
            }
            if (exitCode !== 0) {
                throw Error(`Unity failed with exit code ${exitCode}`);
            }
        }
    }
}

async function exec(command: UnityCommand, onPid: (pid: ProcInfo) => void): Promise<number> {
    const logPath = getArgumentValue('-logFile', command.args);
    if (!logPath) {
        throw Error('Log file path not specified in command arguments');
    }
    let unityProcess: ChildProcessByStdio<null, null, null>;
    if (process.platform === 'linux' && !command.args.includes('-nographics')) {
        const io = require('@actions/io');
        const xvfbRun = await io.which('xvfb-run', true);
        unityProcess = spawn(
            xvfbRun,
            [command.editorPath, ...command.args],
            {
                stdio: ['ignore', 'ignore', 'ignore'],
                detached: true,
                env: {
                    ...process.env,
                    DISPLAY: ':99',
                    UNITY_THISISABUILDMACHINE: '1'
                }
            });
    } else {
        unityProcess = spawn(
            command.editorPath,
            command.args,
            {
                stdio: ['ignore', 'ignore', 'ignore'],
                detached: true,
                env: {
                    ...process.env,
                    UNITY_THISISABUILDMACHINE: '1'
                }
            });
    }
    const processId = unityProcess.pid;
    if (!processId) {
        throw new Error('Failed to start Unity process!');
    }
    onPid({ pid: processId, ppid: process.pid, name: command.editorPath });
    core.debug(`Unity process started with pid: ${processId}`);
    // make sure the directory for the PID file exists
    const pidDir = path.dirname(pidFile);
    if (!fs.existsSync(pidDir)) {
        fs.mkdirSync(pidDir, { recursive: true });
    } else {
        try {
            await fs.promises.access(pidFile, fs.constants.R_OK | fs.constants.W_OK);
            const killedPid = await tryKillPid(pidFile);
            if (killedPid) {
                core.warning(`Killed existing Unity process with pid: ${killedPid}`);
            }
        } catch {
            // PID file does not exist, continue
        }
    }
    // Write the PID to the PID file
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
            } catch (error) {
                // ignore read errors
            }
            await new Promise(res => setTimeout(res, logPollingInterval));
        }
        // Write a newline at the end of the log tail
        // prevents appending logs from being printed on the same line
        process.stdout.write('\n');
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
