const { ValidateInputs } = require('./inputs');
const core = require('@actions/core');
const exec = require('@actions/exec');

const main = async () => {
    try {
        const [editor, args] = await ValidateInputs();
        const editorPath = process.platform === 'win32' ? `"${editor}"` : editor;
        core.info(`[command]${editorPath} ${args.join(' ')}`);
        const exitCode = await exec.exec(editorPath, args, {
            listeners: {
                stdout: (data) => {
                    core.info(data.toString());
                }
            },
            silent: true,
            ignoreReturnCode: true,
            windowsVerbatimArguments: process.platform === 'win32'
        });
        if (exitCode !== 0) {
            throw Error(`Unity failed with exit code ${exitCode}`);
        }
    } catch (error) {
        core.setFailed(error);
    }
}

main();
