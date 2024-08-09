const { ValidateInputs } = require('./inputs');
const { spawn } = require('child_process');
const { Cleanup } = require('./post');
const core = require('@actions/core');
const path = require('path');
const fs = require('fs').promises;

const IS_POST = !!core.getState('isPost');

const main = async () => {
    try {
        if (!IS_POST) {
            core.saveState('isPost', true);
            const [editor, args] = await ValidateInputs();
            const editorPath = process.platform === 'win32' ? `"${editor}"` : editor;
            core.info(`[command]${editorPath} ${args.join(' ')}`);
            const unityProcess = spawn(editorPath, args);
            const unityPid = unityProcess.pid;
            core.saveState('unityPid', unityPid);
            // write pid to text file in workspace named 'unity-process-id.txt'
            const pidFilePath = path.join(process.env.GITHUB_WORKSPACE, 'unity-process-id.txt');
            await fs.writeFile(pidFilePath, unityPid.toString());
            unityProcess.stdout.on('data', (data) => {
                core.info(data.toString());
            });
            unityProcess.stderr.on('data', (data) => {
                core.error(data.toString());
            });
            await new Promise((resolve, reject) => {
                unityProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Unity exited with code ${code}`));
                    }
                });
            });
        } else {
            const unityPid = core.getState('unityPid');
            core.info(`Killing Unity process with PID ${unityPid}...`);
            try {
                process.kill(unityPid);
            } catch (error) {
                if (error.code === 'ESRCH') {
                    core.info(`No process with PID ${unityPid} found.`);
                } else {
                    core.setFailed(`Failed to kill Unity process: ${error.message}`);
                }
            }
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
