import core = require('@actions/core');
import { ValidateInputs } from './inputs';
import { ExecUnity } from './unity';
import { UnityCommand } from './types';

const main = async () => {
    try {
        const command: UnityCommand = await ValidateInputs();
        await ExecUnity(command);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
