import { describe, expect, it } from 'vitest';
import { modelsFor } from './step-models.js';

describe('the models each step runs on', () => {
  it('should keep the strongest model of each client for the steps that write the change', () => {
    const writing = ['plan', 'implement', 'visual-gate'] as const;

    expect(writing.map(modelsFor)).toEqual(writing.map(() => ({ claude: 'opus', antigravity: 'pro' })));
  });

  it('should run the steps that judge or report on the lighter model of each client', () => {
    const judging = ['author-tests', 'validate-tests', 'browser-qa', 'performance', 'ux-critique', 'review', 'final-verification'] as const;

    expect(judging.map(modelsFor)).toEqual(judging.map(() => ({ claude: 'sonnet', antigravity: 'flash' })));
  });
});
