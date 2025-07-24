#!/bin/bash
# This script is used to fetch the Unity template from the editor path in env variables.
set -e

if [ -z "$UNITY_EDITOR_PATH" ]; then
  echo "UNITY_EDITOR_PATH is not set. Please set it to the path of your Unity editor."
  exit 1
fi

PACKAGE="$1"

if [ -z "$PACKAGE" ]; then
    echo "Usage: $0 <package-name>"
    echo "Example: $0 com.unity.template.3d"
    exit 1
fi

# UNITY_EDITOR_PATH: /home/runner/Unity/Hub/Editor/<version>/Editor/Unity
# TEMPLATE_PATH=/home/runner/Unity/Hub/Editor/<version>/Editor/Data/Resources/PackageManager/ProjectTemplates/com.unity.template.3d-<version>.tgz
# Derive the editor root (strip trailing /Unity or /Unity.exe)
EDITOR_ROOT=$(dirname "${UNITY_EDITOR_PATH}")
TEMPLATE_DIR="${EDITOR_ROOT}/Data/Resources/PackageManager/ProjectTemplates"

if [ ! -d "${TEMPLATE_DIR}" ]; then
    echo "Template directory not found: ${TEMPLATE_DIR}"
    exit 1
fi

PACKAGES=$(find "${TEMPLATE_DIR}" -name "*.tgz" 2>/dev/null)

if [ -z "${PACKAGES}" ]; then
    echo "No templates found in ${TEMPLATE_DIR}"
else
    echo "Available templates:"
    for pkg in ${PACKAGES}; do
        echo " - $(basename "${pkg}")"
    done
fi

TEMPLATE_PATH=$(find "${TEMPLATE_DIR}" -name "${PACKAGE}.*.tgz" | head -n 1)

if [ -z "${TEMPLATE_PATH}" ]; then
    echo "${PACKAGE} path not found in ${TEMPLATE_DIR}!"
    exit 1
fi

echo "TEMPLATE_PATH=${TEMPLATE_PATH}"
echo "TEMPLATE_PATH=${TEMPLATE_PATH}" >> "${GITHUB_OUTPUT}"