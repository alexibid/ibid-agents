import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const caseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  request: z.string().min(1),
  workingDirectory: z.string().default(''),
  expect: z.object({
    stopsAt: z.string().min(1),
    mentions: z.array(z.string()).default([]),
    avoids: z.array(z.string()).default([]),
  }),
});

const fileSchema = z.object({ cases: z.array(caseSchema).min(1) });

export type EvalCase = z.infer<typeof caseSchema>;

export interface AgentEvals {
  readonly agent: string;
  readonly cases: readonly EvalCase[];
}

export const FINISHED = 'finished';
const EVALS_FILE = 'evals.json';

export async function evalsIn(skillsDirectory: string): Promise<AgentEvals[]> {
  const folders = (await readdir(skillsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const found = await Promise.all(
    folders.map(async (folder) => {
      const text = await readFile(join(skillsDirectory, folder.name, EVALS_FILE), 'utf8').catch(() => '');
      return text === '' ? [] : [{ agent: folder.name, cases: fileSchema.parse(JSON.parse(text)).cases }];
    }),
  );
  return found.flat().sort((first, second) => first.agent.localeCompare(second.agent));
}
