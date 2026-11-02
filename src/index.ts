import path = require('path');
import core = require('@actions/core');
import {
    UnityEditor,
    UnityInstaller,
    UnityProject,
} from '@rage-against-the-pixel/unity-cli';
import { ClassifyFailure } from '@rage-against-the-pixel/unity-cli/dist/failure-markers';
import { shellSplit } from './utils';

async function main() {
    try {
        // the official Unity CLI that launches the editor writes workflow commands and annotations in github format
        if (process.env.GITHUB_ACTIONS === 'true' && !process.env.UNITY_FORMAT) {
            process.env.UNITY_FORMAT = 'github';
        }

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
                unityEditor = await new UnityInstaller().GetEditor(unityProject.version);
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
        // a seat limit or network failure gets a notice titled with its marker, so a rerun workflow can retry it
        const message = error instanceof Error ? error.message : String(error);
        const marker = ClassifyFailure(message);

        if (marker) {
            core.notice(`Retryable failure: ${message}`, { title: marker });
        }

        core.setFailed(message);
    }
}

main();
