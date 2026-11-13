import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const OWN_SKILLS = resolve(import.meta.dirname, '..', '..', '..', 'skills');
const TOOL_SKILL_FOLDERS = [join(homedir(), '.claude', 'skills'), join(homedir(), '.gemini', 'config', 'skills')];
const TRASH = join(homedir(), '.Trash');
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export class SkillNotRemovableError extends Error {
  constructor(name: string) {
    super(`"${name}" is not one of your own skills, so it cannot be removed here.`);
    this.name = 'SkillNotRemovableError';
  }
}

export async function moveSkillToTrash(name: string, removable: (name: string) => Promise<boolean>): Promise<string> {
  const folder = join(OWN_SKILLS, name);
  if (!SAFE_NAME.test(name) || !existsSync(folder) || !(await removable(name))) {
    throw new SkillNotRemovableError(name);
  }
  await Promise.all(TOOL_SKILL_FOLDERS.map((tools) => unlinkIfPointingTo(join(tools, name), folder)));
  await mkdir(TRASH, { recursive: true });
  const kept = join(TRASH, `ibid-agents-${name}-${Date.now()}`);
  await rename(folder, kept);
  return kept;
}

async function unlinkIfPointingTo(link: string, folder: string): Promise<void> {
  const details = lstatSync(link, { throwIfNoEntry: false });
  if (details?.isSymbolicLink() !== true) {
    return;
  }
  const target = readlinkSync(link);
  if (target === folder || target.endsWith(`/skills/${link.split('/').at(-1)}`)) {
    await rm(link);
  }
}
