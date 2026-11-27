import type { Database, Row } from '../store/database.js';

export interface StepRun {
  readonly storyId: string;
  readonly step: string;
  readonly passed: boolean;
  readonly details: readonly string[];
}

export interface StoryCost {
  readonly storyId: string;
  readonly steps: number;
  readonly failed: number;
  readonly skipped: number;
  readonly testSteps: number;
  readonly screenSteps: number;
  readonly agentSteps: number;
}

export interface FlowCost {
  readonly stories: readonly StoryCost[];
  readonly averagePerStory: Omit<StoryCost, 'storyId'>;
}

const TEST_STEPS = new Set(['author-tests', 'unit-tests', 'validate-tests']);
const SCREEN_STEPS = new Set(['browser-qa', 'ux-critique', 'visual-gate', 'accessibility', 'performance']);
const ENGINE_STEPS = new Set(['build', 'lint', 'rule-checks', 'seo-audit', 'unit-tests', 'journey', 'accessibility']);
const SKIPPED = 'Skipped:';

const RUNS_SINCE = `
  select step_events.story_id as "storyId", step_events.step, step_events.passed, step_events.details
  from step_events join stories on stories.id = step_events.story_id
  where stories.started_at > now() - make_interval(days => $1)
  order by step_events.id`;

export function costOf(runs: readonly StepRun[]): FlowCost {
  const byStory = new Map<string, StepRun[]>();
  for (const run of runs) {
    byStory.set(run.storyId, [...(byStory.get(run.storyId) ?? []), run]);
  }
  const stories = [...byStory].map(([storyId, storyRuns]) => storyCostOf(storyId, storyRuns));
  return { stories, averagePerStory: averageOf(stories) };
}

export async function flowCostSince(database: Database, days: number): Promise<FlowCost> {
  return costOf((await database.rows<Row>(RUNS_SINCE, [days])).map(runOf));
}

function runOf(row: Row): StepRun {
  const details = Array.isArray(row['details']) ? row['details'].map(String) : [];
  return { storyId: String(row['storyId']), step: String(row['step']), passed: row['passed'] === true, details };
}

function storyCostOf(storyId: string, runs: readonly StepRun[]): StoryCost {
  const ran = runs.filter((run) => !isSkipped(run));
  return {
    storyId,
    steps: ran.length,
    failed: ran.filter((run) => !run.passed).length,
    skipped: runs.length - ran.length,
    testSteps: ran.filter((run) => TEST_STEPS.has(run.step)).length,
    screenSteps: ran.filter((run) => SCREEN_STEPS.has(run.step)).length,
    agentSteps: ran.filter((run) => !ENGINE_STEPS.has(run.step)).length,
  };
}

function isSkipped(run: StepRun): boolean {
  return run.details.some((detail) => detail.startsWith(SKIPPED));
}

function averageOf(stories: readonly StoryCost[]): Omit<StoryCost, 'storyId'> {
  const total = Math.max(stories.length, 1);
  const mean = (pick: (cost: StoryCost) => number) => Math.round((stories.reduce((sum, cost) => sum + pick(cost), 0) / total) * 10) / 10;
  return {
    steps: mean(({ steps }) => steps),
    failed: mean(({ failed }) => failed),
    skipped: mean(({ skipped }) => skipped),
    testSteps: mean(({ testSteps }) => testSteps),
    screenSteps: mean(({ screenSteps }) => screenSteps),
    agentSteps: mean(({ agentSteps }) => agentSteps),
  };
}
