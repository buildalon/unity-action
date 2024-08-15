import { ValidateInputs } from './inputs';
import { ExecUnity } from './unity';
import core = require('@actions/core');

const main = async () => {
    try {
        const [editor, args] = await ValidateInputs();
        await ExecUnity(editor, args);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
