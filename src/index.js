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
            const exitCode = await exec.exec(editor, args, {
                listeners: {
                    stdline: (data) => {
                        core.info(data);
                    }
                },
                silent: true,
                ignoreReturnCode: true,
                windowsVerbatimArguments: process.platform === 'win32'
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
