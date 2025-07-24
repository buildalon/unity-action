import core = require("@actions/core");
import path = require("path");
import fs = require('fs');
import { shellSplit } from './utils';
import { UnityCommand } from "./types";

const WORKSPACE = process.env.GITHUB_WORKSPACE;
const UNITY_EDITOR_PATH = process.env.UNITY_EDITOR_PATH;
const UNITY_PROJECT_PATH = process.env.UNITY_PROJECT_PATH;

export async function ValidateInputs(): Promise<UnityCommand> {
    let editorPath = core.getInput(`editor-path`) || UNITY_EDITOR_PATH;
    if (!editorPath) {
        throw Error(`Missing editor-path or UNITY_EDITOR_PATH`);
    }
    await fs.promises.access(editorPath, fs.constants.X_OK);
    core.debug(`Unity Editor Path:\n  > "${editorPath}"`);
    const args = [];
    const inputArgsString = core.getInput(`args`);
    const inputArgs = shellSplit(inputArgsString);
    if (inputArgs.includes(`-version`)) {
        return { editorPath, args: [`-version`] };
    }
    if (!inputArgs.includes(`-batchmode`)) {
        args.push(`-batchmode`);
    }
    const match = editorPath.match(/(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/);
    if (!match) {
        throw Error(`Invalid Unity Editor Path: ${editorPath}`);
    }
    const unityMajorVersion = match.groups?.major;
    if (!unityMajorVersion) {
        throw Error(`Invalid Unity Major Version: ${editorPath}`);
    }
    const autoAddNographics = parseInt(unityMajorVersion, 10) > 2018;
    if (autoAddNographics && !inputArgs.includes(`-nographics`) && !inputArgs.includes(`-force-graphics`)) {
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
        inputArgs.includes(`-version`) ||
        inputArgs.includes(`-createProject`));
    if (!inputArgs.includes(`-projectPath`) && needsProjectPath) {
        projectPath = core.getInput(`project-path`) || UNITY_PROJECT_PATH;
        if (process.platform === `win32` && projectPath.endsWith(`\\`)) {
            projectPath = projectPath.slice(0, -1);
        }
        if (!projectPath) {
            throw Error(`Missing project-path or UNITY_PROJECT_PATH`);
        }
        await fs.promises.access(projectPath, fs.constants.R_OK);
        core.debug(`Unity Project Path:\n  > "${projectPath}"`);
        args.push(`-projectPath`, projectPath);
    }
    if (!inputArgs.includes(`-logFile`)) {
        const logsDirectory = projectPath !== undefined
            ? path.join(projectPath, `Builds`, `Logs`)
            : path.join(WORKSPACE, `Logs`);
        try {
            await fs.promises.access(logsDirectory, fs.constants.R_OK);
        } catch (error) {
            core.debug(`Creating Logs Directory:\n  > "${logsDirectory}"`);
            await fs.promises.mkdir(logsDirectory, { recursive: true });
        }
        const logName = core.getInput(`log-name`) || `Unity`;
        const timestamp = new Date().toISOString().replace(/[-:]/g, ``).replace(/\..+/, ``);
        const logPath = path.join(logsDirectory, `${logName}-${timestamp}.log`);
        core.debug(`Log File Path:\n  > "${logPath}"`);
        args.push(`-logFile`, logPath);
    }
    if (!inputArgs.includes(`-automated`)) {
        args.push(`-automated`);
    }
    if (inputArgs) {
        args.push(...inputArgs);
    }
    core.debug(`Args:`);
    args.forEach(arg => core.debug(`  ${arg}`));
    return { editorPath, args };
}
