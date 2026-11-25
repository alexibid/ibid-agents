import { describe, expect, it } from 'vitest';
import { costOf, type StepRun } from './flow-cost.js';

const run = (storyId: string, step: string, passed = true, details: string[] = []): StepRun => ({ storyId, step, passed, details });

describe('costOf', () => {
  it('should count what each story really ran, leaving skipped repeats apart', () => {
    const cost = costOf([
      run('a', 'implement'),
      run('a', 'build'),
      run('a', 'browser-qa'),
      run('a', 'author-tests'),
      run('a', 'review', false),
      run('a', 'implement'),
      run('a', 'build', true, ['Skipped: only tests and mocks changed since the last build.']),
      run('a', 'browser-qa', true, ['Skipped: nothing that changes the screen moved since this step last passed.']),
      run('b', 'implement'),
    ]);

    expect(cost.stories[0]).toEqual({ storyId: 'a', steps: 6, failed: 1, skipped: 2, testSteps: 1, screenSteps: 1, agentSteps: 5 });
    expect(cost.averagePerStory.steps).toBe(3.5);
  });

  it('should give zero averages when no story ran', () => {
    expect(costOf([]).averagePerStory).toEqual({ steps: 0, failed: 0, skipped: 0, testSteps: 0, screenSteps: 0, agentSteps: 0 });
  });
});
