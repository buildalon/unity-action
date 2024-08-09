const { ValidateInputs } = require('./inputs');
const { Cleanup } = require('./post');
const core = require('@actions/core');
const exec = require('@actions/exec');

const IS_POST = !!core.getState('isPost');

const main = async () => {
    try {
        if (!IS_POST) {
            core.saveState('isPost', true);
            const [editor, args] = await ValidateInputs();
            const editorPath = process.platform === 'win32' ? `"${editor}"` : editor;
            const exitCode = await exec.exec(editorPath, args, {
                listeners: {
                    stdout: (data) => {
                        core.info(data.toString());
                    },
                    stderr: (data) => {
                        core.info(data.toString());
                    }
                }
            });
            if (exitCode !== 0) {
                throw Error(`Unity failed with exit code ${exitCode}`);
            }
        } else {
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
