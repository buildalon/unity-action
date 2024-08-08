const core = require("@actions/core");
const fs = require("fs").promises;
const path = require("path");

async function ValidateInputs() {
    const editorPath = core.getInput(`editor-path`) || process.env.UNITY_EDITOR_PATH;
    if (!editorPath) {
        throw Error(`Missing editor-path or UNITY_EDITOR_PATH`);
    }
    await fs.access(editorPath, fs.constants.X_OK);
    core.info(`Unity Editor Path:\n  > "${editorPath}"`);
    const args = [];
    const inputArgs = core.getInput(`args`);
    if (inputArgs) {
        args.push(...inputArgs.split(` `));
    }
    if (!args.includes(`-buildTarget`)) {
        const buildTarget = core.getInput(`build-target`);
        if (buildTarget) {
            core.info(`Build Target:\n  > ${buildTarget}`);
            args.push(`-buildTarget`, buildTarget);
        }
    }
    let projectPath = undefined;
    if (!args.includes(`-projectPath`) &&
        (!args.includes(`-createManualActivationFile`) &&
            !args.includes(`-manualLicenseFile`) &&
            !args.includes(`-returnLicense`) &&
            !args.includes(`-serial`))) {
        projectPath = core.getInput(`project-path`) || process.env.UNITY_PROJECT_PATH;
        if (!projectPath) {
            throw Error(`Missing project-path or UNITY_PROJECT_PATH`);
        }
        await fs.access(projectPath, fs.constants.R_OK);
        core.info(`Unity Project Path:\n  > "${projectPath}"`);
        args.push(`-projectPath`, projectPath);
    }
    if (!args.includes(`-logFile`)) {
        const logsDirectory = projectPath !== undefined
            ? path.join(projectPath, `Builds`, `Logs`)
            : path.join(env.process.GITHUB_WORKSPACE, `Logs`);
        try {
            await fs.access(logsDirectory, fs.constants.R_OK);
        } catch (error) {
            core.info(`Creating Logs Directory:\n  > "${logsDirectory}"`);
            await fs.mkdir(logsDirectory, { recursive: true });
        }
        const logName = core.getInput(`log-name`, { required: true });
        const timestamp = new Date().toISOString().replace(/[-:]/g, ``).replace(/\.\d{3}/, ``); // yyyyMMddTHHmmss
        const logPath = path.join(logsDirectory, `${logName}-${timestamp}.log`);
        core.info(`Log File Path:\n  > "${logPath}"`);
        args.push(`-logFile`, logPath);
    }
    core.info(`Args:`);
    for (const arg of args) {
        core.info(`  > ${arg}`);
    }
    return [editorPath, args];
}

module.exports = { ValidateInputs };
