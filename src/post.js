const core = require('@actions/core');
const io = require('@actions/io');
const fs = require('fs').promises;
const path = require('path');

const WORKSPACE = process.env.GITHUB_WORKSPACE;

async function Cleanup() {
    core.info(`Cleaning up workspace...`);
    const buildsDirectory = path.join(WORKSPACE, 'Builds');
    const logDirectory = path.join(WORKSPACE, 'Logs');
    await Promise.all([
        deletePath(buildsDirectory),
        deletePath(logDirectory)
    ]);
}

async function deletePath(path) {
    try {
        await fs.access(path, fs.constants.R_OK);
        await io.rmRF(path);
        core.debug(`Deleted:\n  > "${path}"`);
    } catch (error) {
        // Ignore error if path does not exist
    }
}

module.exports = { Cleanup };
