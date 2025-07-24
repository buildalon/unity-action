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

TEMPLATE_PATH=$(find "$UNITY_EDITOR_PATH" -name "${PACKAGE}.*.tgz" | head -n 1)

if [ -z "$TEMPLATE_PATH" ]; then
    echo "Template path not found in $UNITY_EDITOR_PATH!"

    PACKAGES=$(find "$UNITY_EDITOR_PATH/../Resources/PackageManager/ProjectTemplates" -name "*.tgz")

    if [ -z "$PACKAGES" ]; then
        echo "No templates found in $UNITY_EDITOR_PATH/../Resources/PackageManager/ProjectTemplates"
    else
        echo "Available templates:"
        for pkg in $PACKAGES; do
            echo " - $(basename "$pkg")"
        done
    fi
    exit 1
fi

echo "TEMPLATE_PATH=$TEMPLATE_PATH"
echo "TEMPLATE_PATH=$TEMPLATE_PATH" >> "$GITHUB_OUTPUT"