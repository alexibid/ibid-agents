import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const FIELD_KINDS = ['text', 'list', 'yes', 'urls', 'optional-urls', 'file', 'files', 'optional-files', 'passing-runs', 'backlog', 'published-issues', 'discovery-review'] as const;

const stepSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  doneBy: z.string().regex(/^[a-z][a-z0-9-]*$/),
  task: z.string().min(1),
  fields: z.record(z.string(), z.enum(FIELD_KINDS)),
  calls: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).default([]),
});

const followUpSchema = z.object({
  agent: z.string().regex(/^[a-z][a-z0-9-]*$/),
  noApprovalAgent: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  when: z.enum(['linked-issues', 'always']).default('linked-issues'),
  instruction: z.string().min(1),
});

const flowSchema = z.object({
  title: z.string().min(1),
  afterFinish: followUpSchema.optional(),
  steps: z.array(stepSchema).min(1),
});

export type FieldKind = (typeof FIELD_KINDS)[number];
export type FlowStep = z.infer<typeof stepSchema>;
export type FlowFollowUp = z.infer<typeof followUpSchema>;

export interface AgentFlowDefinition {
  readonly agent: string;
  readonly title: string;
  readonly skillFile: string;
  readonly afterFinish?: FlowFollowUp;
  readonly steps: readonly FlowStep[];
}

export class InvalidAgentFlowError extends Error {
  constructor(agent: string, problems: readonly string[]) {
    super(`The flow of "${agent}" is invalid: ${problems.join('; ')}`);
    this.name = 'InvalidAgentFlowError';
  }
}

const FLOW_FILE = 'flow.json';
const SKILL_FILE = 'SKILL.md';

export async function agentFlowsIn(skillsDirectory: string): Promise<AgentFlowDefinition[]> {
  const folders = (await readdir(skillsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const found = await Promise.all(
    folders.map(async (folder) => {
      const text = await readFile(join(skillsDirectory, folder.name, FLOW_FILE), 'utf8').catch(() => '');
      return text === '' ? [] : [definitionOf(folder.name, text, join(skillsDirectory, folder.name, SKILL_FILE))];
    }),
  );
  return found.flat().sort((first, second) => first.agent.localeCompare(second.agent));
}

export function definitionOf(agent: string, text: string, skillFile: string): AgentFlowDefinition {
  const parsed = flowSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new InvalidAgentFlowError(agent, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const ids = parsed.data.steps.map((step) => step.id);
  if (new Set(ids).size !== ids.length) {
    throw new InvalidAgentFlowError(agent, ['two steps share an id']);
  }
  return {
    agent,
    title: parsed.data.title,
    skillFile,
    ...(parsed.data.afterFinish !== undefined ? { afterFinish: parsed.data.afterFinish } : {}),
    steps: parsed.data.steps,
  };
}
