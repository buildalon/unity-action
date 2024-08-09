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
            process.kill(pid);
        } catch (error) {
            if (error.code !== 'ENOENT' || error.code !== 'ESRCH') {
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

module.exports = { ExecUnityPwsh };
