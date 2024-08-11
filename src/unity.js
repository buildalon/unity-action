const exec = require('@actions/exec');
const core = require('@actions/core');
const io = require('@actions/io');
const fs = require('fs').promises;
const path = require('path');

const pidFile = path.join(process.env.RUNNER_TEMP, 'unity-process-id.txt');

async function ExecUnityPwsh(editorPath, args) {
    const logPath = getLogFilePath(args);
    const pwsh = await io.which('pwsh', true);
    const unity = path.resolve(__dirname, `unity.ps1`);
    const exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity} -EditorPath '${editorPath}' -Arguments '${args.join(` `)}' -LogPath '${logPath}'`, {
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

function getLogFilePath(args) {
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
            core.debug(`Attempting to kill Unity process with pid: ${pid}`);
            process.kill(pid);
        } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ESRCH') {
                core.error(`Failed to kill Unity process:\n${JSON.stringify(error)}`);
            }
        } finally {
            await fs.unlink(pidFile);
        }
    } catch (error) {
        // nothing
    }
}

module.exports = { ExecUnityPwsh };
