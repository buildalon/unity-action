export interface UnityCommand {
  editorPath: string;
  args: string[];
}
export interface ProcInfo {
  pid: number;
  ppid: number;
  name: string;
}