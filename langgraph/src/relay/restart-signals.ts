import { watchFile } from 'node:fs';

const CHECK_EVERY_MS = 1000;
const SETTLE_MS = 3000;

export function whenAnyChanges(files: readonly string[], act: () => void): void {
  let settling: NodeJS.Timeout | undefined;
  const settled = () => {
    clearTimeout(settling);
    settling = setTimeout(act, SETTLE_MS);
  };
  for (const file of files) {
    watchFile(file, { interval: CHECK_EVERY_MS }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs) {
        settled();
      }
    });
  }
}
