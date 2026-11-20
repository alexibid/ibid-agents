import { describe, expect, it } from 'vitest';
import type { Row, Value } from '../store/database.js';
import { PostgresHandoffArchive, UnknownHandoffError, type QueryableDatabase } from './handoff-archive.js';

interface RecordedQuery {
  readonly text: string;
  readonly values: readonly Value[];
}

class FakeDatabase implements QueryableDatabase {
  readonly queries: RecordedQuery[] = [];
  readonly #responses: readonly (readonly Row[])[];
  #index = 0;

  constructor(responses: readonly (readonly Row[])[]) {
    this.#responses = responses;
  }

  async rows<Shape extends Row>(text: string, values: readonly Value[] = []): Promise<Shape[]> {
    this.queries.push({ text, values });
    const result = this.#responses[this.#index] ?? [];
    this.#index += 1;
    return result as Shape[];
  }
}

const STAMP = new Date('2026-11-19T12:00:00.000Z');

const HANDOFF_ROW: Row = {
  id: 'h-1',
  workspace: 'ibid-workspace',
  client: 'claude',
  topic: 'Cross-client baton',
  summary: 'Ready to implement the MCP tools',
  decisions: ['Store batons in Postgres'],
  next_action: 'Run tests',
  open_questions: ['Should SessionStart show active stories?'],
  active_story_id: 'story-42',
  active_run_id: '',
  active_coach_id: '',
  status: 'open',
  created_at: STAMP,
  updated_at: STAMP,
};

describe('PostgresHandoffArchive', () => {
  it('should save a handoff and map the returned row', async () => {
    const database = new FakeDatabase([[HANDOFF_ROW]]);
    const archive = new PostgresHandoffArchive(database);

    const saved = await archive.save({
      workspace: 'ibid-workspace',
      client: 'claude',
      topic: 'Cross-client baton',
      summary: 'Ready to implement the MCP tools',
      decisions: ['Store batons in Postgres'],
      nextAction: 'Run tests',
      openQuestions: ['Should SessionStart show active stories?'],
      activeStoryId: 'story-42',
      activeRunId: '',
      activeCoachId: '',
    });

    expect(saved.id).toBe('h-1');
    expect(saved.nextAction).toBe('Run tests');
    expect(saved.openQuestions).toEqual(['Should SessionStart show active stories?']);
    expect(saved.activeStoryId).toBe('story-42');
    expect(saved.updatedOn).toBe('2026-11-19T12:00:00.000Z');
    expect(database.queries[0]?.text).toContain('on conflict (workspace, lower(topic)) where status = \'open\'');
  });

  it('should aggregate open handoffs, active stories and active runs', async () => {
    const database = new FakeDatabase([
      [HANDOFF_ROW],
      [{ id: 'story-42', project: 'papikapi', title: 'Add filters', status: 'working', updated_at: STAMP }],
      [{ id: 'run-7', agent: 'devops', request: 'Check CI', status: 'needs-user', updated_at: STAMP }],
    ]);
    const archive = new PostgresHandoffArchive(database);

    const baton = await archive.active(' ibid-workspace ');

    expect(baton.handoffs).toHaveLength(1);
    expect(baton.activeStories).toEqual([
      { id: 'story-42', project: 'papikapi', title: 'Add filters', status: 'working', updatedOn: '2026-11-19T12:00:00.000Z' },
    ]);
    expect(baton.activeRuns).toEqual([
      { id: 'run-7', agent: 'devops', request: 'Check CI', status: 'needs-user', updatedOn: '2026-11-19T12:00:00.000Z' },
    ]);
    expect(database.queries[0]?.values).toEqual(['ibid-workspace']);
  });

  it('should close an existing handoff', async () => {
    const database = new FakeDatabase([[{ ...HANDOFF_ROW, status: 'closed' }]]);
    const archive = new PostgresHandoffArchive(database);

    const closed = await archive.close('h-1');

    expect(closed.status).toBe('closed');
    expect(database.queries[0]?.values).toEqual(['h-1']);
  });

  it('should throw UnknownHandoffError when closing an unknown id', async () => {
    const archive = new PostgresHandoffArchive(new FakeDatabase([[]]));

    await expect(archive.close('missing-id')).rejects.toThrow(UnknownHandoffError);
  });
});
