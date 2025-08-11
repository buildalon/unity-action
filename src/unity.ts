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
    tryKillPid
} from './utils';
import { SummaryTableCell, SummaryTableRow } from '@actions/core/lib/summary';

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
        unityProcess = spawn(xvfbRun, [command.editorPath, ...command.args], {
            stdio: ['ignore', 'ignore', 'ignore'],
            detached: true,
            env: {
                ...process.env,
                DISPLAY: ':99',
                UNITY_THISISABUILDMACHINE: '1'
            }
        });
    } else {
        unityProcess = spawn(command.editorPath, command.args, {
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
    const logs: any[] = [];

    const tailLog = async () => {
        let leftover: string = '';

        while (!logEnded) {
            try {
                const stats = fs.statSync(logPath);

                if (stats.size > lastSize) {
                    const fd = fs.openSync(logPath, 'r');
                    const buffer = Buffer.alloc(stats.size - lastSize);
                    fs.readSync(fd, buffer, 0, buffer.length, lastSize);
                    let chunk: string = buffer.toString('utf8');
                    fs.closeSync(fd);
                    lastSize = stats.size;

                    chunk = leftover + chunk;
                    const lines = chunk.split(/\r?\n/);
                    leftover = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('##utp:')) {
                            try {
                                const utp = JSON.parse(line.slice(6));
                                logs.push(utp);
                                if (utp.type === 'LogEntry') {
                                    switch (utp.severity) {
                                        case 'Error':
                                            core.error(utp.message, { file: utp.file, startLine: utp.line });
                                            break;
                                        case 'Warning':
                                            core.warning(utp.message, { file: utp.file, startLine: utp.line });
                                            break;
                                        default:
                                            core.info(utp.message);
                                            break;
                                    }
                                }

                            } catch (e) {
                                // Ignore malformed utp
                            }
                        } else {
                            process.stdout.write(line + '\n');
                        }
                    }
                }
            } catch (error) {
                // ignore read errors
            }

            await new Promise(res => setTimeout(res, logPollingInterval));
        }

        // Write a newline at the end of the log tail
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

    // Print Unity Action logs in workflow summary
    if (logs.length > 0) {
        try {
            core.summary.addHeading('Unity Action Logs');
            // create a map of log keys and values so we can make sure to put content into the right cell
            const logMap = new Map<string, string>();
            for (const log of logs) {
                for (const [key, value] of Object.entries(log)) {
                    logMap.set(key, value.toString());
                }
            }
            // put logs into a table.
            // get a list of all the keys in the logs
            const keys = new Set<string>();
            for (const log of logs) {
                Object.keys(log).forEach(key => keys.add(key));
            }
            // create header summary cells
            const headers: SummaryTableCell[] = [];
            for (const key of keys) {
                headers.push({ data: key });
            }
            // create a header rows
            const rows: SummaryTableRow[] = [];
            rows.push(headers);
            // create a data row for each log
            for (const log of logs) {
                const dataRow: SummaryTableCell[] = Array.from(keys).map(key => ({ data: log[key]?.toString() ?? '' }));
                rows.push(dataRow);
            }
            const summary = core.summary.addTable(rows);
            await summary.write();
        } catch (e) {
            core.warning('Failed to write Unity Action logs to summary: ' + e);
        }
    }

    return exitCode;
}
