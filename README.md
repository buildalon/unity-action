# Buildalon Unity Action

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![validate](https://github.com/buildalon/unity-action/actions/workflows/validate.yml/badge.svg?branch=main&event=push)](https://github.com/buildalon/unity-action/actions/workflows/validate.yml)

A Github Action to execute Unity Editor command line arguments.

## How to use

### Workflow

```yaml
jobs:
  build:
    env:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            build-target: StandaloneLinux64
          - os: windows-latest
            build-target: StandaloneWindows64
          - os: macos-13
            build-target: StandaloneOSX
    steps:
      - uses: buildalon/unity-action@v1
        name: '${{ matrix.build-target }}-Build'
        with:
          editor-path: 'path/to/your/unity/editor/installation'
          project-path: 'path/to/your/unity/project'
          log-name: '${{ matrix.build-target }}-Build'
          build-target: '${{ matrix.build-target }}'
          args: '-quit -nographics -batchmode'
```

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `editor-path` | The path to the unity editor installation you want to use to execute the arguments with. | If `UNITY_EDITOR_PATH` environment variable is not set. | `env.UNITY_EDITOR_PATH` |
| `project-path` | The path to the unity project you want to use when executing arguments. | If `UNITY_PROJECT_PATH` environment variable is not set, or if it isn't required for the command. | `env.UNITY_PROJECT_PATH` |
| `build-target` | The build target to use when executing arguments. | false | |
| `args` | The arguments to use when executing commands to the editor. | true | `-quit -batchmode -nographics` |
| `log-name` | The name of the log file to create when running the commands. | false | `Unity-yyyyMMddTHHmmss` |
