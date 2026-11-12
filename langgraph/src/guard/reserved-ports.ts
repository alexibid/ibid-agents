import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_FOLDERS = ['apps', 'libs'];
const DECLARED_PORT = /"port"\s*:\s*(\d{2,5})/g;

export async function reservedPortsOf(workspaceRoot: string): Promise<number[]> {
  const projectFiles = (await Promise.all(PROJECT_FOLDERS.map((folder) => projectFilesIn(join(workspaceRoot, folder))))).flat();
  const contents = await Promise.all(projectFiles.map((file) => readFile(file, 'utf8').catch(() => '')));
  const ports = contents.flatMap((content) => [...content.matchAll(DECLARED_PORT)].map((match) => Number(match[1])));
  return [...new Set(ports)].sort((first, second) => first - second);
}

async function projectFilesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(folder, entry.name, 'project.json'));
}
