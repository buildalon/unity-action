import path = require('path');
import core = require('@actions/core');
import {
    UnityEditor,
    UnityHub,
    UnityProject,
} from '@rage-against-the-pixel/unity-cli';
import { shellSplit } from './utils';

async function main() {
    try {
        const args = shellSplit(core.getInput(`args`));
        const buildTarget = core.getInput(`build-target`);

        if (buildTarget && buildTarget.length > 0) {
            args.unshift('-buildTarget', buildTarget);
        }

        const editorPath = core.getInput(`editor-path`) || process.env.UNITY_EDITOR_PATH || undefined;
        core.debug(`Unity Editor Path:\n  > "${editorPath}"`);

        let unityEditor: UnityEditor | undefined;

        if (editorPath && editorPath.length > 0) {
            unityEditor = new UnityEditor(editorPath);
        }

        let unityProject: UnityProject | undefined;
        const projectPath = core.getInput(`project-path`) || process.env.UNITY_PROJECT_PATH || undefined;

        if (projectPath && projectPath.trim().length > 0) {
            unityProject = await UnityProject.GetProject(projectPath);
            core.debug(`Unity Project Path:\n  > "${projectPath}"`);

            if (!unityEditor) {
                const unityHub = new UnityHub();
                unityEditor = await unityHub.GetEditor(unityProject.version);
            }
        }

        if (!unityEditor) {
            throw new Error('The Unity Editor path was not specified. Use editor-path to specify it or set the UNITY_EDITOR_PATH environment variable.');
        }

        if (!args.includes('-logFile')) {
            const logName = core.getInput(`log-name`);

            if (logName && logName.trim().length > 0) {
                const timestamp = new Date().toISOString().replace(/[-:]/g, ``).replace(/\..+/, ``);
                const logPath = path.join(unityEditor.GetLogsDirectory(unityProject?.projectPath), `${logName}-${timestamp}.log`);
                core.debug(`Log File Path:\n  > "${logPath}"`);
                args.push('-logFile', logPath);
            }
        }

        await unityEditor.Run({
            projectPath: unityProject?.projectPath,
            args: [...args]
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
