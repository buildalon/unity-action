const { ValidateInputs } = require('./inputs');
const { ExecUnityPwsh, ExecUnitySpawn } = require('./unity');
const core = require('@actions/core');

const main = async () => {
    try {
        const [editor, args] = await ValidateInputs();
        await ExecUnitySpawn(editor, args);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
