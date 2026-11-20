import { describe, expect, it } from 'vitest';
import { judgePlan, stepQueue, type Plan } from './plan.js';
import type { ProjectSheet } from './sheet.js';

const sheet: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: ['ibid-ui'],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [
    { step: 'review', when: 'always' },
    { step: 'implement', when: 'always' },
    { step: 'journey', when: 'ui' },
    { step: 'visual-gate', when: 'figures' },
  ],
  commands: { journey: 'run <journey>' },
};

const plan = (overrides: Partial<Plan>): Plan => ({
  files: ['apps/demo/src/total.ts'],
  conditions: [],
  journey: '',
  reusedParts: [],
  brief: '',
  ...overrides,
});

describe('stepQueue', () => {
  it('should keep only the steps whose condition is active, in canonical order', () => {
    expect(stepQueue(sheet, [])).toEqual(['implement', 'review']);
    expect(stepQueue(sheet, ['ui'])).toEqual(['implement', 'journey', 'review']);
  });
});

describe('judgePlan', () => {
  it('should accept a plan that names its files and declares what they trigger', () => {
    expect(judgePlan(plan({}), sheet)).toEqual({ accepted: true, problems: [] });
  });

  it('should reject a plan with no files', () => {
    expect(judgePlan(plan({ files: [] }), sheet).accepted).toBe(false);
  });

  it('should reject a plan whose files trigger a condition it does not declare', () => {
    const verdict = judgePlan(plan({ files: ['apps/demo/src/a.html'] }), sheet);

    expect(verdict.problems).toContain(
      'The planned files require the condition "ui", which the plan does not declare.',
    );
  });

  it('should reject an interface plan that names no journey and no reuse search', () => {
    const verdict = judgePlan(plan({ files: ['apps/demo/src/a.html'], conditions: ['ui'] }), sheet);

    expect(verdict.problems).toHaveLength(2);
  });

  it('should not ask for a reuse search when the sheet names no library under Reuses', () => {
    const verdict = judgePlan(plan({ files: ['apps/demo/src/a.html'], conditions: ['ui'], journey: '01-total' }), {
      ...sheet,
      reuses: [],
    });

    expect(verdict.accepted).toBe(true);
  });

  it('should accept an interface plan with a journey and a reuse search', () => {
    const complete = plan({
      files: ['apps/demo/src/a.html'],
      conditions: ['ui'],
      journey: '01-total',
      reusedParts: ['ibid-card'],
    });

    expect(judgePlan(complete, sheet).accepted).toBe(true);
  });
});
