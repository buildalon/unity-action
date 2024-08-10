const { ValidateInputs } = require('./inputs');
const { ExecUnityPwsh, ExecUnitySpawn } = require('./unity');
const core = require('@actions/core');

const main = async () => {
    try {
        const [editor, args] = await ValidateInputs();
        await ExecUnityPwsh(editor, args);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
