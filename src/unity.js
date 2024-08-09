const { spawn } = require('child_process');
const exec = require('@actions/exec');
const core = require('@actions/core');
const io = require('@actions/io');
const fs = require('fs').promises;
const path = require('path');

async function ExecUnityPwsh(editorPath, args) {
    let exitCode = 0;
    var pwsh = await io.which("pwsh", true);
    var unity = path.resolve(__dirname, 'unity.ps1');
    exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity} -editorPath '${editorPath}' -arguments '${args.join(` `)}'`, {
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
    const pidFile = path.join(process.env.GITHUB_WORKSPACE, 'unity-process-id.txt');
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
    const logFileIndex = args.indexOf('-logFile');
    if (logFileIndex === -1) {
        throw Error('Missing -logFile argument');
    }
    const logFile = args[logFileIndex + 1];
    const pidFile = path.join(process.env.GITHUB_WORKSPACE, 'unity-process-id.txt');
    const unityProcess = spawn(editorPath, args);
    await fs.writeFile(pidFile, unityProcess.pid.toString());
    // tail the logFile and print the output
    const tail = spawn('tail', ['-f', logFile]);
    tail.stdout.on('data', (data) => {
        core.info(data.toString());
    });
    const exitCode = await new Promise((resolve, reject) => {
        unityProcess.on('exit', (code) => {
            tail.kill();
            resolve(code);
        });
    });
}

module.exports = { ExecUnityPwsh };
