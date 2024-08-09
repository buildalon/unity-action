const core = require('@actions/core');
const exec = require('@actions/exec');

async function ExecUnity(editor, args) {
    switch (process.platform) {
        case 'linux':
        case 'darwin':
            core.info(`[command]${editor} ${args.join(' ')}`);
            return await exec.exec(editor, args, {
                listeners: {
                    stdline: (data) => {
                        core.info(data);
                    },
                    stdout: (data) => {
                        core.info(data);
                    },
                    stderr: (data) => {
                        core.info(data);
                    }
                },
                silent: true,
                ignoreReturnCode: true
            });
        default:
            core.info(`[command]"${editor}" ${args.join(' ')}`);
            return await exec.exec(`"${editor}"`, args, {
                listeners: {
                    stdline: (data) => {
                        core.info(data);
                    },
                    stdout: (data) => {
                        core.info(data);
                    },
                    stderr: (data) => {
                        core.info(data);
                    }
                },
                silent: true,
                ignoreReturnCode: true,
                windowsVerbatimArguments: true
            });
    }
}

module.exports = { ExecUnity };
