const { ValidateInputs } = require('./inputs');
const { Cleanup } = require('./post');
const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs').promises;

const IS_POST = !!core.getState('isPost');

const main = async () => {
    try {
        if (!IS_POST) {
            core.saveState('isPost', true);
            const [editor, args] = await ValidateInputs();
            const editorPath = process.platform === 'win32' ? `"${editor}"` : editor;
            if (process.platform === 'darwin') {
                const editorPathDetails = await fs.stat(editorPath);
                core.info(`Unity Editor Path Details:\n  > ${JSON.stringify(editorPathDetails)}`);
            }
            const exitCode = await exec(editorPath, args);
            if (exitCode !== 0) {
                core.setFailed(`Unity process exited with code ${exitCode}`);
            }
        } else {
            const unityPid = core.getState('unityPid');
            core.info(`Killing Unity process with PID ${unityPid}...`);
            try {
                process.kill(unityPid);
            } catch (error) {
                core.setFailed(`Failed to kill Unity process:\n${JSON.stringify(error)}`);
            }
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
