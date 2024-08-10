const { spawn } = require('child_process');
const exec = require('@actions/exec');
const core = require('@actions/core');
const io = require('@actions/io');
const fs = require('fs').promises;
const path = require('path');

const pidFile = path.join(process.env.GITHUB_WORKSPACE, 'unity-process-id.txt');

async function ExecUnityPwsh(editorPath, args) {
    const logFilePath = getLogFilePath(args);
    const pwsh = await io.which("pwsh", true);
    const unity = path.resolve(__dirname, 'unity.ps1');
    const exitCode = await exec.exec(`"${pwsh}" -Command`, `& {${unity} -EditorPath '${editorPath}' -Arguments '${args.join(` `)}' -LogFile '${logFilePath}'}`, {
        listeners: {
            stdline: (data) => {
                const line = data.toString().trim();
                if (line && line.length > 0) {
                    core.info(line);
                }
            }
        },
        silent: true,
        ignoreReturnCode: true
    });
    await TryKillPid(pidFile);
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

async function ExecUnitySpawn(editorPath, args) {
    // use spawn to start the unity process with the args
    // don't capture the stdout/stderr, instead tail the -logFile and print the output
    // logFile will be the arg after `-logFile` in the args array
    // be sure to capture the pid of the unity process and write it to a file
    // so we can kill the process when the job is done
    const logFilePath = getLogFilePath(args);
    const unityProcess = spawn(editorPath, args);
    await fs.writeFile(pidFile, unityProcess.pid.toString());
    const tail = spawn('tail', ['-f', logFilePath]);
    tail.stdout.setEncoding('utf8');
    tail.stdout.on('data', (data) => {
        core.info(data);
    });
    const exitCode = await new Promise((resolve, reject) => {
        unityProcess.on('close', (code) => {
            core.info('on close');
            tail.kill();
            resolve(code);
        });
        unityProcess.on('exit', (code) => {
            core.info('on exit');
            tail.kill();
            resolve(code);
        });
    });
    await TryKillPid(pidFile);
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

async function getLogFilePath(args) {
    const logFileIndex = args.indexOf('-logFile');
    if (logFileIndex === -1) {
        throw Error('Missing -logFile argument');
    }
    return args[logFileIndex + 1];
}

async function TryKillPid(pidFile) {
    try {
        await fs.access(pidFile, fs.constants.R_OK);
        try {
            const pid = await fs.readFile(pidFile, 'utf8');
            core.info(`Killing Unity process with pid: ${pid}`);
            process.kill(pid);
        } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ESRCH') {
                core.info(`Failed to kill Unity process:\n${JSON.stringify(error)}`);
            }
        } finally {
            await fs.unlink(pidFile);
        }
    } catch (error) {
        // nothing
    }
}

module.exports = { ExecUnityPwsh, ExecUnitySpawn };
