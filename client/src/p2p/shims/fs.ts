// Browser stand-in for node:fs (the host browser injects the word list instead of reading files).
export function readFileSync(): string {
  throw new Error('no filesystem in the browser');
}
export default { readFileSync };
