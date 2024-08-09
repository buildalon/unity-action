const { ValidateInputs } = require('./inputs');
const { spawn } = require('child_process');
const { Cleanup } = require('./post');
const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');

const IS_POST = !!core.getState('isPost');
const WORKSPACE = process.env.GITHUB_WORKSPACE;

const main = async () => {
    try {
        if (!IS_POST) {
            core.saveState('isPost', true);
            const [editor, args] = await ValidateInputs();
            const editorPath = process.platform === 'win32' ? `"${editor}"` : editor;
            core.info(`[command]${editorPath} ${args.join(' ')}`);
            const unityProcess = spawn(editorPath, args, {
                shell: process.platform !== 'win32',
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            core.saveState('unityPid', unityProcess.pid);
            await fs.writeFile(path.join(WORKSPACE, 'unity-process-id.txt'), unityProcess.pid.toString());
            unityProcess.stdout.on('data', (data) => {
                core.info(data.toString());
            });
            unityProcess.stderr.on('data', (data) => {
                core.error(data.toString());
            });
            await new Promise((resolve, reject) => {
                unityProcess.on('exit', (code) => {
                    if (code === 0) {
                        core.info(`Unity exited with code ${code}`);
                        resolve();
                    } else {
                        reject(`Unity exited with code ${code}`);
                    }
                });
            });
        } else {
            const unityPid = core.getState('unityPid');
            core.info(`Killing Unity process with PID ${unityPid}...`);
            try {
                process.kill(unityPid);
            } catch (error) {
                if (error.code !== 'ESRCH') {
                    core.setFailed(`Failed to kill Unity process:\n${JSON.stringify(error)}`);
                }
            }
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
