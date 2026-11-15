import { readdir, readFile, realpath } from 'node:fs/promises';
import { basename, join } from 'node:path';

export type Origin = 'mine' | 'langgraph' | 'system' | 'project';

export interface CatalogEntry {
  readonly file: string;
  readonly name: string;
  readonly kind: 'agent' | 'skill';
  readonly job: string;
  readonly origin: Origin;
  readonly project: string;
}

const CONTRACT_INDEX = 'README.md';
const TITLE = /^#\s+(.+)$/m;
const JOB = /^##\s+Job\s*\n+([\s\S]*?)(?=\n##\s|(?![\s\S]))/m;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---/;

export async function agentsIn(contractsDirectory: string): Promise<CatalogEntry[]> {
  const files = (await readdir(contractsDirectory)).filter((file) => file.endsWith('.md') && file !== CONTRACT_INDEX).sort();
  return Promise.all(
    files.map(async (file) => {
      const text = await readFile(join(contractsDirectory, file), 'utf8');
      return {
        file,
        name: TITLE.exec(text)?.[1]?.trim() ?? basename(file, '.md'),
        kind: 'agent' as const,
        job: JOB.exec(text)?.[1]?.trim().replace(/\s*\n\s*/g, ' ') ?? '',
        origin: 'langgraph' as const,
        project: '',
      };
    }),
  );
}

export async function skillsIn(skillsDirectory: string, originOf: (name: string) => Origin): Promise<CatalogEntry[]> {
  const folders = (await readdir(skillsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const skills = await Promise.all(
    folders.map(async (folder) => {
      const text = await readFile(join(skillsDirectory, folder.name, 'SKILL.md'), 'utf8').catch(() => '');
      const header = FRONT_MATTER.exec(text)?.[1] ?? '';
      return {
        file: `${folder.name}/SKILL.md`,
        name: fieldOf(header, 'name') || folder.name,
        kind: 'skill' as const,
        job: fieldOf(header, 'description'),
        origin: originOf(folder.name),
        project: '',
      };
    }),
  );
  return skills.sort((first, second) => first.name.localeCompare(second.name));
}

export async function projectSkillsIn(projectsDirectory: string, systemSkills: string): Promise<CatalogEntry[]> {
  const projects = (await readdir(projectsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const found = await Promise.all(
    projects.map(async (project) => {
      const folder = join(projectsDirectory, project.name, '.agents', 'skills');
      const names = await readdir(folder).catch(() => []);
      const own = await Promise.all(
        names.map(async (name) => ((await realpath(join(folder, name)).catch(() => '')).startsWith(systemSkills) ? '' : name)),
      );
      return Promise.all(
        own.filter((name) => name !== '').map(async (name) => {
          const text = await readFile(join(folder, name, 'SKILL.md'), 'utf8').catch(() => '');
          return {
            file: `projects/${project.name}/.agents/skills/${name}/SKILL.md`,
            name,
            kind: 'skill' as const,
            job: fieldOf(FRONT_MATTER.exec(text)?.[1] ?? '', 'description'),
            origin: 'project' as const,
            project: project.name,
          };
        }),
      );
    }),
  );
  return found.flat();
}

function fieldOf(header: string, field: string): string {
  const line = header.split('\n').find((entry) => entry.startsWith(`${field}:`));
  return line?.slice(field.length + 1).trim().replace(/^["']|["']$/g, '') ?? '';
}
