const core = require('@actions/core');
const { spawn } = require('child_process');

async function ExecUnity(editor, args) {
    const unityProcess = spawn(`"${editor}"`, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsVerbatimArguments: process.platform === `win32`
    });
    unityProcess.stdout.on('data', (data) => {
        core.info(data.toString());
    });
    unityProcess.stderr.on('data', (data) => {
        core.error(data.toString());
    });
    return new Promise((resolve, reject) => {
        unityProcess.on('close', (code) => {
            resolve(code);
        });
    });
}

module.exports = { ExecUnity };
