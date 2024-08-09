const { ValidateInputs } = require('./inputs');
const { ExecUnity } = require('./unity');
const core = require('@actions/core');

const main = async () => {
    try {
        const [editor, args] = await ValidateInputs();
        await ExecUnity(editor, args);
    } catch (error) {
        core.setFailed(error);
    }
}

main();
