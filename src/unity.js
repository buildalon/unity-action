const exec = require('@actions/exec');
const core = require('@actions/core');
const io = require('@actions/io');
const path = require('path');

async function ExecUnity(editorPath, args) {
    let exitCode = 0;
    var pwsh = await io.which("pwsh", true);
    var unity = path.resolve(__dirname, 'unity.ps1');
    core.info(`[command]"${editorPath}" ${args.join(' ')}`);
    exitCode = await exec.exec(`"${pwsh}" -Command`, `& {${unity} -editorPath '${editorPath}' -arguments '${args.join(`,`)}'}`, {
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
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

module.exports = { ExecUnity };
