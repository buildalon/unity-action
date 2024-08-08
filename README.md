# Buildalon Unity Action

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH)

A Github Action to execute Unity Editor command line arguments.

## How to use

### Workflow

```yaml

```

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `editor-path` | The path to the unity editor installation you want to use to execute the arguments with. | If `UNITY_EDITOR_PATH` environment variable is not set. | `env.UNITY_EDITOR_PATH` |
| `project-path` | The path to the unity project you want to use when executing arguments. | If `UNITY_PROJECT_PATH` environment variable is not set, or if it isn't required for the command. | `env.UNITY_PROJECT_PATH` |
| `build-target` | The build target to use when executing arguments. | false | |
| `args` | The arguments to use when executing commands to the editor. | true | `-quit -batchmode -nographics` |
| `log-name` | The name of the log file to create when running the commands. | false | `Unity-yyyyMMddTHHmmss` |
