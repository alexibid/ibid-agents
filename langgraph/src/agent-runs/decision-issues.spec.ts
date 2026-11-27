import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentRunFlow } from './agent-run-flow.js';
import { decisionRunsIn, linkedIssuesIn, pendingDecisionFor } from './decision-issues.js';
import { agentFlowsIn, definitionOf } from './definition.js';

const SKILLS_DIR = resolve(import.meta.dirname, '..', '..', '..', 'skills');
const EPIC_78 = 'https://github.com/alexibid/ibid-website/issues/78';
const ISSUE_79 = 'https://github.com/alexibid/ibid-website/issues/79';
const OTHER_REPO_ISSUE = 'https://github.com/alexibid/papikapi/issues/12';

const issueReviewDefinition = definitionOf(
  'issue-review',
  JSON.stringify({
    title: 'Issue review',
    steps: [{ id: 'apply', name: 'Aplicar', doneBy: 'issue-review', task: 'Apply.', fields: { summary: 'text' } }],
  }),
  '/skills/issue-review/SKILL.md',
);

const projectManagerDefinition = definitionOf(
  'project-manager',
  JSON.stringify({
    title: 'Project manager',
    steps: [{ id: 'create-issues', name: 'Criar', doneBy: 'project-manager', task: 'Create.', fields: { summary: 'text' } }],
  }),
  '/skills/project-manager/SKILL.md',
);

describe('linkedIssuesIn', () => {
  it('should extract explicit issues, full GitHub issue URLs, and owner/repo#number shorthands without duplicates', () => {
    const found = linkedIssuesIn(
      `Execute D1 (#79) for epic #78 (${EPIC_78}) and task (${ISSUE_79}.) plus alexibid/ibid-website#2 and alexibid/ibid-website#79.`,
      { issue: ISSUE_79 },
    );

    expect(found).toEqual([
      ISSUE_79,
      EPIC_78,
      'https://github.com/alexibid/ibid-website/issues/2',
    ]);
  });

  it('should return an empty list when no GitHub issue is referenced', () => {
    expect(linkedIssuesIn('Evaluate monitor architecture in langgraph/src/monitor.')).toEqual([]);
  });
});

describe('AgentRunFlow completion for decision runs tied to GitHub issues', () => {
  let folder = '';
  let saver: SqliteSaver | undefined;
  let sampleFile = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'decision-issues-'));
    sampleFile = join(folder, 'sample.ts');
    await writeFile(sampleFile, 'export const sample = true;\n');
  });

  afterEach(async () => {
    saver?.db.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function finishSolutionArchitect(flow: AgentRunFlow, request: string, origin: { issue?: string; epic?: string } = {}) {
    const started = await flow.start('solution-architect', request, origin);
    await flow.submit(started.runId, { architecture: 'Angular standalone + signals', readFiles: [sampleFile] });
    await flow.submit(started.runId, { flaws: ['Native controls missing'] });
    await flow.submit(started.runId, { design: 'Use native controls and HttpClient' });
    return flow.submit(started.runId, { files: [sampleFile], executionPrompt: 'Implement native controls.' });
  }

  it('should require /project-manager or /issue-review immediately when solution-architect finishes a run tied to GitHub issues', async () => {
    const stateFile = join(folder, 'agent-runs.sqlite');
    saver = SqliteSaver.fromConnString(stateFile);
    const saRaw = await readFile(join(SKILLS_DIR, 'solution-architect', 'flow.json'), 'utf8');
    const saDefinition = definitionOf('solution-architect', saRaw, join(SKILLS_DIR, 'solution-architect', 'SKILL.md'));
    const flow = new AgentRunFlow([saDefinition, issueReviewDefinition, projectManagerDefinition], saver);

    const finished = await finishSolutionArchitect(
      flow,
      `Execute D1 (#79) for ibid-website epic #78 (${EPIC_78}): Plan contact form (${ISSUE_79}).`,
      { issue: ISSUE_79, epic: EPIC_78 },
    );

    expect(finished.status).toBe('finished');
    expect(finished.next).toBe('nothing');
    expect(finished.linkedIssues).toEqual([ISSUE_79, EPIC_78]);
    expect(finished.requiredFollowUp).toMatchObject({
      agent: 'project-manager',
      noApprovalAgent: 'issue-review',
      issues: [ISSUE_79, EPIC_78],
      repositories: ['alexibid/ibid-website'],
    });
    expect(finished.requiredFollowUp?.instruction).toContain('Do not wait until the end of the epic');

    const pending = decisionRunsIn(stateFile, flow.definitions());
    expect(pending).toHaveLength(1);
    expect(pending[0]?.followUpStatus).toBe('pending');
    expect(pendingDecisionFor({ issue: 'https://github.com/alexibid/ibid-website/issues/80', epic: EPIC_78 }, pending)).not.toBe('none');
    expect(pendingDecisionFor({ issue: OTHER_REPO_ISSUE, epic: '' }, pending)).toBe('none');
  });

  it('should clear pending decision follow-up once issue-review or project-manager finishes for that repository, and ignore other repositories', async () => {
    const stateFile = join(folder, 'agent-runs.sqlite');
    saver = SqliteSaver.fromConnString(stateFile);
    const definitions = await agentFlowsIn(SKILLS_DIR);
    const saDefinition = definitions.find((entry) => entry.agent === 'solution-architect');
    if (saDefinition === undefined) {
      throw new Error('solution-architect flow definition missing');
    }
    const flow = new AgentRunFlow([saDefinition, issueReviewDefinition, projectManagerDefinition], saver);

    const priorReview = await flow.start('issue-review', 'alexibid/ibid-website');
    await flow.submit(priorReview.runId, { summary: 'earlier review' });

    await finishSolutionArchitect(flow, `Design task ${ISSUE_79} for ${EPIC_78}`);

    const unrelatedReview = await flow.start('issue-review', 'alexibid/papikapi-api');
    await flow.submit(unrelatedReview.runId, { summary: 'reviewed another repo' });

    const stillPending = decisionRunsIn(stateFile, flow.definitions());
    expect(stillPending[0]?.followUpStatus).toBe('pending');
    expect(pendingDecisionFor({ issue: 'https://github.com/alexibid/ibid-website/issues/80', epic: EPIC_78 }, stillPending)).not.toBe('none');

    const matchingReview = await flow.start('issue-review', 'alexibid/ibid-website');
    await flow.submit(matchingReview.runId, { summary: 'closed #79 after architecture settled' });

    const resolved = decisionRunsIn(stateFile, flow.definitions());
    expect(resolved[0]?.followUpStatus).toBe('reviewed');
    expect(pendingDecisionFor({ issue: 'https://github.com/alexibid/ibid-website/issues/80', epic: EPIC_78 }, resolved)).toBe('none');

    const secondDecision = await finishSolutionArchitect(flow, `Decide D2 (${ISSUE_79}) for ${EPIC_78}`);
    expect(decisionRunsIn(stateFile, flow.definitions())[0]?.runId).toBe(secondDecision.runId);
    expect(decisionRunsIn(stateFile, flow.definitions())[0]?.followUpStatus).toBe('pending');

    const pmRun = await flow.start('project-manager', `Update criteria and close ${ISSUE_79} in alexibid/ibid-website`);
    await flow.submit(pmRun.runId, { summary: 'updated and closed' });
    expect(decisionRunsIn(stateFile, flow.definitions())[0]?.followUpStatus).toBe('reviewed');
  });

  it('should surface legacy finished decision runs in decisionRunsIn without blocking start_story', async () => {
    const stateFile = join(folder, 'legacy.sqlite');
    const database = new DatabaseSync(stateFile);
    database.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    database
      .prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)')
      .run(
        'solution-architect~legacy',
        '1',
        JSON.stringify({
          ts: '2026-11-26T00:32:19.000Z',
          channel_values: {
            agent: 'solution-architect',
            request: `Execute D1 (${ISSUE_79}) for ${EPIC_78}`,
            status: 'finished',
          },
        }),
      );
    database.close();

    const definitions = await agentFlowsIn(SKILLS_DIR);
    const runs = decisionRunsIn(stateFile, definitions);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.followUpStatus).toBe('pending');
    expect(pendingDecisionFor({ issue: 'https://github.com/alexibid/ibid-website/issues/80', epic: EPIC_78 }, runs)).toBe('none');
  });

  it('should not emit requiredFollowUp when solution-architect runs without any linked GitHub issues', async () => {
    const stateFile = join(folder, 'agent-runs.sqlite');
    saver = SqliteSaver.fromConnString(stateFile);
    const saRaw = await readFile(join(SKILLS_DIR, 'solution-architect', 'flow.json'), 'utf8');
    const saDefinition = definitionOf('solution-architect', saRaw, join(SKILLS_DIR, 'solution-architect', 'SKILL.md'));
    const flow = new AgentRunFlow([saDefinition], saver);

    const finished = await finishSolutionArchitect(flow, 'Evaluate the monitor service architecture.');

    expect(finished.status).toBe('finished');
    expect(finished.linkedIssues).toBeUndefined();
    expect(finished.requiredFollowUp).toBeUndefined();
    expect(decisionRunsIn(stateFile, flow.definitions())).toEqual([]);
  });
});
