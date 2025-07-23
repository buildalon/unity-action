
import core = require('@actions/core');
import path = require('path');
import fs = require('fs');
import { spawn } from 'child_process';

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
    const exitCode = await execUnity(editorPath, args);
    if (!isCancelled) {
        await tryKillPid(pidFile);
        if (exitCode !== 0) {
            throw Error(`Unity failed with exit code ${exitCode}`);
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

async function execUnity(editorPath: string, args: string[]): Promise<number> {
    const logPath = getLogFilePath(args);
    core.info(`[command]"${editorPath}" ${args.join(' ')}`);
    const unityProcess = spawn(editorPath, args, { stdio: ['ignore', 'ignore', 'ignore'], detached: true });
    const processId = unityProcess.pid;
    core.debug(`Unity process started with pid: ${processId}`);
    fs.writeFileSync(pidFile, String(processId));
    const streamLog = () => {
        if (fs.existsSync(logPath)) {
            const logStream = fs.createReadStream(logPath, { encoding: 'utf8', flags: 'r' });
            logStream.on('data', chunk => process.stdout.write(chunk));
            logStream.on('end', () => { });
            logStream.on('error', () => { });
        }
    };
    const waitForLog = async () => {
        while (!fs.existsSync(logPath)) {
            await new Promise(res => setTimeout(res, 1));
        }
        streamLog();
    };
    waitForLog();
    const exitCode: number = await new Promise((resolve, reject) => {
        unityProcess.on('exit', code => {
            resolve(code ?? 1);
        });
        unityProcess.on('error', err => {
            reject(err);
        });
    });
    const timeout = 10000; // 10 seconds
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
            await new Promise(res => setTimeout(res, 1));
        }
    }

    core.debug(`Unity Process Exit Code: ${exitCode}`);
    return exitCode;
}