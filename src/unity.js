const exec = require('@actions/exec');
const core = require('@actions/core');
const { spawn } = require('child_process');

async function ExecUnity(editorPath, args) {
    let exitCode = undefined;
    switch (process.platform) {
        case 'linux':
            core.info(`[command]xvfb-run --auto-servernum "${editorPath}" ${args.join(' ')}`);
            exitCode = await exec.exec('xvfb-run', ['--auto-servernum', editorPath, ...args], {
                listeners: {
                    stdline: (data) => {
                        const line = data.toString();
                        if (line && line.trim().length > 0) {
                            core.info(data);
                        }
                    }
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
                        const line = data.toString();
                        if (line && line.trim().length > 0) {
                            core.info(data);
                        }
                    }
                },
                silent: true,
                ignoreReturnCode: true
            });
            break;
        case 'win32':
            core.info(`[command]"${editorPath}" ${args.join(' ')}`);
            const unityProcess = spawn(`"${editorPath}"`, args, {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            unityProcess.stdout.setEncoding('utf8');
            unityProcess.stderr.setEncoding('utf8');
            unityProcess.stdout.on('data', (data) => {
                core.info(data);
            });
            unityProcess.stderr.on('data', (data) => {
                core.error(data);
            });
            await new Promise((resolve, reject) => {
                unityProcess.on('close', (code) => {
                    exitCode = code;
                    resolve();
                });
            });
            break;
        default:
            throw Error(`Unsupported platform: ${process.platform}`);
    }
    if (exitCode !== 0) {
        throw Error(`Unity failed with exit code ${exitCode}`);
    }
}

module.exports = { ExecUnity };