import { isOutsideWorkspace, type ProjectSheet } from './sheet.js';

const APPS_PREFIX = 'apps/';
const LIBS_PREFIX = 'libs/';
const UTILS_PREFIX = 'libs/utils/';

export function affectsProject(file: string, sheet: ProjectSheet, ownFiles: readonly string[]): boolean {
  if (ownFiles.includes(file)) {
    return true;
  }
  if (isOutsideWorkspace(sheet.path)) {
    return underFolder(file, sheet.path);
  }
  if (isOutsideWorkspace(file)) {
    return false;
  }
  if (sheet.path === '.' || underFolder(file, sheet.path)) {
    return true;
  }
  if (file.startsWith(APPS_PREFIX)) {
    return false;
  }
  if (sheet.path.startsWith(LIBS_PREFIX) && file.startsWith(LIBS_PREFIX)) {
    return file.startsWith(UTILS_PREFIX) || sheet.reuses.some((lib) => file.startsWith(`${LIBS_PREFIX}${lib}/`));
  }
  return true;
}

function underFolder(file: string, folder: string): boolean {
  return file === folder || file.startsWith(`${folder}/`);
}
