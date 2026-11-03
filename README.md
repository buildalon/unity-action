# Buildalon Unity Action

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![marketplace](https://img.shields.io/static/v1?label=&labelColor=505050&message=Buildalon%20Actions&color=FF1E6F&logo=github-actions&logoColor=0076D6)](https://github.com/marketplace?query=buildalon) [![validate](https://github.com/buildalon/unity-action/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/buildalon/unity-action/actions/workflows/validate.yml)

A Github Action to execute [Unity Editor command line arguments](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html).

## How to use

### Workflow

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            build-target: StandaloneLinux64
          - os: windows-latest
            build-target: StandaloneWindows64
          - os: macos-latest
            build-target: StandaloneOSX
    steps:
      - uses: buildalon/unity-action@v4
        name: ${{ matrix.build-target }}-Build
        with:
          editor-path: path/to/your/unity/editor/installation
          project-path: path/to/your/unity/project
          log-name: ${{ matrix.build-target }}-Build
          build-target: ${{ matrix.build-target }}
          args: -quit -nographics -batchmode
```

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `editor-path` | The path to the unity editor installation you want to use to execute the arguments with. When neither this nor `UNITY_EDITOR_PATH` is set, the editor is looked up from the project's Unity version. | If `UNITY_EDITOR_PATH`, `project-path` and `UNITY_PROJECT_PATH` are not set. | `env.UNITY_EDITOR_PATH` |
| `project-path` | The path to the unity project you want to use when executing arguments. | If `UNITY_PROJECT_PATH` environment variable is not set, or if it isn't required for the command. | `env.UNITY_PROJECT_PATH` |
| `build-target` | The build target to use when executing arguments. Passed as `-buildTarget`. | false | |
| `args` | The [arguments](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html) to use when executing commands to the editor. `-batchmode` and `-nographics` are added when missing; use `-force-graphics` to skip `-nographics`. | false | `-quit -batchmode -nographics` |
| `log-name` | The name of the log file, written as `<log-name>-<yyyyMMddTHHmmss>.log` in the project's `Builds/Logs` folder (or `Logs` in the workspace without a project). Skipped when `args` contains `-logFile`. | false | `Unity` |

On GitHub Actions, `UNITY_FORMAT` defaults to `github` so the official Unity CLI writes annotations. When the run fails for a reason a rerun can fix, the action adds a notice titled `unity-license-exhausted` or `unity-transient-failure` for [retry-failed-jobs](https://github.com/buildalon/retry-failed-jobs).

This repository's CI tests pull requests against the Unity streams the official Unity CLI lists, and a monthly run covers the older editor lines. Every Unity row reports as its own check, and rows on a stream that only has alpha releases report without failing the run.
