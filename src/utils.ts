import core = require('@actions/core');
import { exec } from 'child_process';
import * as util from 'util';
import { ProcInfo } from './types';
import fs = require('fs');

const execAsync = util.promisify(exec);
const systemProcessNames = [
  'System',
  'Idle',
  'Spotlight',
  'svchost.exe',
  'explorer.exe',
  'services.exe',
  'wininit.exe',
  'winlogon.exe',
  'lsass.exe',
  'csrss.exe',
  'smss.exe',
  'init',
  'kthreadd',
  'kworker',
  'systemd',
  'launchd',
  'kernel_task',
  'Finder',
  'Dock',
  'WindowServer',
  'logd',
  'securityd',
  'notifyd',
  'unattended-upgrades',
  'cron',
  'atd',
  'dbus-daemon'
];

/**
 * Split a string into an array of arguments, respecting quotes and escapes.
 * @param input The input string to split.
 * @returns An array of arguments.
 */
export function shellSplit(input: string | undefined): string[] {
  if (!input) return [];
  const result: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inSingle) {
      if (escape) {
        current += c;
        escape = false;
      } else if (c === '\\') {
        // Only escape if next char is a single quote or backslash
        const next = input[i + 1];
        if (next === "'" || next === '\\') {
          escape = true;
          continue;
        } else {
          current += c;
        }
      } else if (c === "'") {
        inSingle = false;
      } else {
        current += c;
      }
    } else if (inDouble) {
      if (escape) {
        current += c;
        escape = false;
      } else if (c === '\\') {
        // Only escape if next char is a double quote or backslash
        const next = input[i + 1];
        if (next === '"' || next === '\\') {
          escape = true;
          continue;
        } else {
          current += c;
        }
      } else if (c === '"') {
        inDouble = false;
      } else {
        current += c;
      }
    } else {
      if (c === "'") {
        inSingle = true;
      } else if (c === '"') {
        inDouble = true;
      } else if (/\s/.test(c)) {
        if (current.length > 0) {
          result.push(current);
          current = '';
        }
      } else {
        // Only treat backslash as escape inside quotes; outside, preserve it
        current += c;
      }
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}
/**
 * Get the value of a command line argument.
 * @param value The name of the argument to retrieve.
 * @param args The list of command line arguments.
 * @returns The value of the argument or an error if not found.
 */
export function getArgumentValue(value: string, args: string[]): string {
  const index = args.indexOf(value);
  if (index === -1 || index === args.length - 1) {
    throw Error(`Missing ${value} argument`);
  }
  return args[index + 1];
}
/**
 * List all processes currently running on the system.
 * @returns A promise that resolves to an array of process information objects.
 */
export async function listProcesses(): Promise<ProcInfo[]> {
  try {
    const filterSystem = (name: string) => {
      return !systemProcessNames.some(sysName => name && name.toLowerCase().includes(sysName.toLowerCase()));
    };
    if (process.platform === 'win32') {
      // Use PowerShell Get-CimInstance for process listing
      const winProcessCli = 'powershell -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Csv -NoTypeInformation"';
      core.debug(`${winProcessCli}:`);
      const { stdout } = await execAsync(winProcessCli);
      const lines = stdout.split(/\r?\n/).filter(l => l.trim());
      const procs: ProcInfo[] = [];
      for (const line of lines.slice(1)) {
        const parts = line.split(',');
        core.debug(line);
        if (parts.length >= 3 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
          const procName = parts[2];
          if (filterSystem(procName)) {
            procs.push({
              name: procName,
              pid: Number(parts[0]),
              ppid: Number(parts[1])
            });
          }
        }
      }
      return procs;
    } else {
      const unixProcessCli = 'ps -eo pid,ppid,comm';
      core.debug(`${unixProcessCli}:`);
      const { stdout } = await execAsync(unixProcessCli);
      const lines = stdout.split(/\r?\n/).slice(1).filter(l => l.trim());
      const procs: ProcInfo[] = [];
      for (const line of lines) {
        core.debug(line);
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (match) {
          const procName = match[3];
          if (filterSystem(procName)) {
            procs.push({
              pid: Number(match[1]),
              ppid: Number(match[2]),
              name: procName
            });
          }
        }
      }
      return procs;
    }
  } catch (error) {
    core.error(`Failed to list processes:\n${error}`);
    return [];
  }
}
/**
 * Cleanup orphaned processes that were spawned by a specific parent process.
 * @param parentProcess The parent process information.
 */
export async function cleanupProcessOrphans(parentProcess: ProcInfo) {
  const procs = await listProcesses();
  if (procs.length === 0) {
    core.debug('No processes found to clean up.');
    return;
  }
  core.startGroup('Cleaning up orphaned processes:');
  try {
    for (const proc of procs) {
      if (proc.ppid === parentProcess.pid) {
        try {
          process.kill(proc.pid);
          core.info(`  {name: ${proc.name}, pid: ${proc.pid}}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === 'ESRCH') {
            core.debug(`  {name: ${proc.name}, pid: ${proc.pid}} already exited.`);
          } else {
            core.error(`Failed to kill orphaned process {name: ${proc.name}, pid: ${proc.pid}}:\n\t${error}`);
          }
        }
      }
    }
  } finally {
    core.endGroup();
  }
}
/**
 * Attempts to kill a process with the given PID read from a PID file.
 * @param pidFilePath The path to the PID file.
 * @returns The PID of the killed process, or null if no process was killed.
 */
export async function tryKillPid(pidFilePath: string): Promise<number | null> {
  let pid: number | null = null;
  try {
    if (!fs.existsSync(pidFilePath)) {
      core.debug(`PID file does not exist: ${pidFilePath}`);
      return null;
    }
    const fileHandle = await fs.promises.open(pidFilePath, 'r');
    try {
      pid = parseInt(await fileHandle.readFile('utf8'));
      core.debug(`Killing process pid: ${pid}`);
      process.kill(pid);
    } catch (error) {
      const nodeJsException = error as NodeJS.ErrnoException;
      const errorCode = nodeJsException?.code;
      if (errorCode !== 'ENOENT' && errorCode !== 'ESRCH') {
        core.error(`Failed to kill process:\n${JSON.stringify(error)}`);
      }
    } finally {
      await fileHandle.close();
      await fs.promises.unlink(pidFilePath);
    }

  } catch (error) {
    // ignored
  }
  return pid;
}