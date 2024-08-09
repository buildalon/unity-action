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
            core.info(`[command]${editorPath} ${args.join(' ')}`);
            await exec.exec(editorPath, args);
        } else {
            await Cleanup();
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
