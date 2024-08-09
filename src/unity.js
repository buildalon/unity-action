const exec = require('@actions/exec');
const core = require('@actions/core');
const io = require('@actions/io');
const path = require('path');

async function ExecUnity(editorPath, args) {
    let exitCode = 0;
    switch (process.platform) {
        case 'win32':
            var pwsh = await io.which("pwsh", true);
            var unity = path.resolve(__dirname, 'unity.ps1');
            core.info(`[command]"${editorPath}" ${args.join(' ')}`);
            exitCode = await exec.exec(`"${pwsh}" -Command`, [unity, `"${editorPath}"`, ...args], {
                listeners: {
                    stdline: (data) => {
                        const line = data.toString().trim();
                        if (line && line.length > 0) {
                            core.info(line);
                        }
                    },
                },
                silent: true,
                ignoreReturnCode: true
            });
            break;
        case 'darwin':
            core.info(`[command]"${editorPath}" ${args.join(' ')}`);
            exitCode = await exec.exec(`"${editorPath}"`, args, {
                listeners: {
                    stdline: (data) => {
                        const line = data.toString().trim();
                        if (line && line.length > 0) {
                            core.info(line);
                        }
                    },
                },
                silent: true,
                ignoreReturnCode: true
            });
            break;
        case 'linux':
            core.info(`[command]xvfb-run --auto-servernum "${editorPath}" ${args.join(' ')}`);
            await exec.exec('xvfb-run', ['--auto-servernum', editorPath, ...args], {
                listeners: {
                    stdline: (data) => {
                        const line = data.toString().trim();
                        if (line && line.length > 0) {
                            core.info(line);
                        }
                    },
                },
                silent: true,
                ignoreReturnCode: true
            });
            break;
    }
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

module.exports = { ExecUnity };
