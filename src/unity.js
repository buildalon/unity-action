const exec = require('@actions/exec');
const core = require('@actions/core');

async function ExecUnity(editorPath, args) {
    let exitCode = undefined;
    switch (process.platform) {
        case 'linux':
            core.info(`[command]xvfb-run --auto-servernum "${editorPath}" ${args.join(' ')}`);
            exitCode = await exec.exec('xvfb-run', ['--auto-servernum', editorPath, ...args], {
                listeners: {
                    stdout: (data) => {
                        core.info(data.toString());
                    }
                },
                silent: true,
                ignoreReturnCode: true
            });
            break;
        default:
            core.info(`[command]"${editorPath}" ${args.join(' ')}`);
            exitCode = await exec.exec(`"${editorPath}"`, args, {
                listeners: {
                    stdout: (data) => {
                        core.info(data.toString());
                    }
                },
                silent: true,
                ignoreReturnCode: true,
                windowsVerbatimArguments: process.platform === 'win32'
            });
            break;
    }
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

module.exports = { ExecUnity };