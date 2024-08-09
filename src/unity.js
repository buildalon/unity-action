
async function ExecUnity(editor, args) {
    core.info(`[command]"${editor}" ${args.join(' ')}`);
    switch (process.platform) {
        case 'linux':
        case 'darwin':
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