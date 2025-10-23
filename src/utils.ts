/**
 * Split a string into an array of arguments, respecting quotes and escapes.
 * @param input The input string to split.
 * @returns An array of arguments.
 */
export function shellSplit(input: string | undefined): string[] {
  if (!input || input.trim().length === 0) { return []; }
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