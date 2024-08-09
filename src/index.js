const { ValidateInputs } = require('./inputs');
const { ExecUnity } = require('./unity');
const { Cleanup } = require('./post');
const core = require('@actions/core');

const IS_POST = !!core.getState('isPost');

const main = async () => {
    try {
        if (!IS_POST) {
            core.saveState('isPost', true);
            const [editor, args] = await ValidateInputs();
            const exitCode = await ExecUnity(editor, args);
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
