import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { PostgresBacklogArchive } from '../backlog/backlog-archive.js';
import { BacklogKeeper } from '../backlog/backlog-keeper.js';
import type { Database } from '../store/database.js';
import { AgentRunFlow } from './agent-run-flow.js';
import { agentFlowsIn } from './definition.js';
import { PostgresRunJournal } from './run-journal.js';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..', '..');
export const SKILLS_DIRECTORY = join(PACKAGE_ROOT, '..', 'skills');
const STATE_DIRECTORY = join(PACKAGE_ROOT, 'state');

export async function agentRunFlowOf(database: Database): Promise<AgentRunFlow> {
  await mkdir(STATE_DIRECTORY, { recursive: true });
  const checkpointer = SqliteSaver.fromConnString(join(STATE_DIRECTORY, 'agent-runs.sqlite'));
  const keeper = new BacklogKeeper(new PostgresBacklogArchive(database));
  return new AgentRunFlow(await agentFlowsIn(SKILLS_DIRECTORY), checkpointer, new PostgresRunJournal(database), keeper);
}
