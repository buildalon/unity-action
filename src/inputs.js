const core = require("@actions/core");
const fs = require("fs").promises;
const path = require("path");

const WORKSPACE = process.env.GITHUB_WORKSPACE;
const UNITY_EDITOR_PATH = process.env.UNITY_EDITOR_PATH;
const UNITY_PROJECT_PATH = process.env.UNITY_PROJECT_PATH;

async function ValidateInputs() {
    let editorPath = core.getInput(`editor-path`) || UNITY_EDITOR_PATH;
    if (!editorPath) {
        throw Error(`Missing editor-path or UNITY_EDITOR_PATH`);
    }
    await fs.access(editorPath, fs.constants.X_OK);
    core.debug(`Unity Editor Path:\n  > "${editorPath}"`);
    const args = [];
    const inputArgsString = core.getInput(`args`);
    const inputArgs = inputArgsString !== undefined
        ? inputArgsString.split(` `)
        : [];
    if (inputArgs.includes(`-version`)) {
        return [editorPath, [`-version`]];
    }
    if (!inputArgs.includes(`-batchmode`)) {
        args.push(`-batchmode`);
    }
    if (!inputArgs.includes(`-nographics`)) {
        args.push(`-nographics`);
    }
    if (!inputArgs.includes(`-buildTarget`)) {
        const buildTarget = core.getInput(`build-target`);
        if (buildTarget) {
            core.debug(`Build Target:\n  > ${buildTarget}`);
            args.push(`-buildTarget`, buildTarget);
        }
    }
    let projectPath = undefined;
    const needsProjectPath = !(
        inputArgs.includes(`-createManualActivationFile`) ||
        inputArgs.includes(`-manualLicenseFile`) ||
        inputArgs.includes(`-returnLicense`) ||
        inputArgs.includes(`-serial`) ||
        inputArgs.includes(`-createProject `));
    if (!inputArgs.includes(`-projectPath`) && needsProjectPath) {
        projectPath = core.getInput(`project-path`) || UNITY_PROJECT_PATH;
        if (process.platform === `win32` && projectPath.endsWith(`\\`)) {
            projectPath = projectPath.slice(0, -1);
        }
        if (!projectPath) {
            throw Error(`Missing project-path or UNITY_PROJECT_PATH`);
        }
        await fs.access(projectPath, fs.constants.R_OK);
        core.debug(`Unity Project Path:\n  > "${projectPath}"`);
        args.push(`-projectPath`, projectPath);
    }
    if (inputArgs) {
        args.push(...inputArgs);
    }
    if (!inputArgs.includes(`-logFile`)) {
        const logsDirectory = projectPath !== undefined
            ? path.join(projectPath, `Builds`, `Logs`)
            : path.join(WORKSPACE, `Logs`);
        try {
            await fs.access(logsDirectory, fs.constants.R_OK);
        } catch (error) {
            core.debug(`Creating Logs Directory:\n  > "${logsDirectory}"`);
            await fs.mkdir(logsDirectory, { recursive: true });
        }
        const logName = core.getInput(`log-name`, { required: true });
        const timestamp = new Date().toISOString().replace(/[-:]/g, ``).replace(/\..+/, ``);
        const logPath = path.join(logsDirectory, `${logName}-${timestamp}.log`);
        core.debug(`Log File Path:\n  > "${logPath}"`);
        args.push(`-logFile`, `-`, logPath);
    } else {
        const logFileIndex = args.indexOf(`-logFile`);
        if (logFileIndex !== -1 && args[logFileIndex + 1] !== `-`) {
            args.splice(logFileIndex + 1, 0, `-`);
        }
    }
    core.debug(`Args:`);
    for (const arg of args) {
        core.debug(`  > ${arg}`);
    }
    return [editorPath, args];
}

module.exports = { ValidateInputs };
