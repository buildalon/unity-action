const core = require('@actions/core');
const exec = require('@actions/exec');
const { spawn } = require('child_process');
const process = require('process');

async function ExecUnity(editor, args) {
    const process = spawn(`"${editor}"`, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsVerbatimArguments: process.platform === `win32`
    });
    process.stdout.on('data', (data) => {
        core.info(data.toString());
    });
    process.stderr.on('data', (data) => {
        core.error(data.toString());
    });
    return new Promise((resolve, reject) => {
        process.on('close', (code) => {
            resolve(code);
        });
    });
}

module.exports = { ExecUnity };
