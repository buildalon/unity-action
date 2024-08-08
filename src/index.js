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
            await exec.exec(`"${editor}"`, args);
        } else {
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
