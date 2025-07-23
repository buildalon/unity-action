export function shellSplit(input: string | undefined): string[] {
  if (!input) return [];
  const result: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escape) {
      current += c;
      escape = false;
    } else if (c === '\\') {
      escape = true;
    } else if (inSingle) {
      if (c === "'") inSingle = false;
      else current += c;
    } else if (inDouble) {
      if (c === '"') inDouble = false;
      else current += c;
    } else if (c === "'") {
      inSingle = true;
    } else if (c === '"') {
      inDouble = true;
    } else if (/\s/.test(c)) {
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
    } else {
      current += c;
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}
