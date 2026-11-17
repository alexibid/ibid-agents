import { describe, expect, it } from 'vitest';
import { failedRunProblem, runApiPathOf } from './ci-run.js';

const RUN = 'https://github.com/alexibid/ibid-workspace/actions/runs/42';

describe('runApiPathOf', () => {
  it.each([
    [RUN, 'repos/alexibid/ibid-workspace/actions/runs/42'],
    [`${RUN}/job/7`, 'repos/alexibid/ibid-workspace/actions/runs/42'],
    ['https://github.com/alexibid/ibid-workspace/pull/3', ''],
    ['https://example.com/alexibid/ibid-workspace/actions/runs/42', ''],
    ['not a link', ''],
  ])('should map %s to "%s"', (link, apiPath) => {
    expect(runApiPathOf(link)).toBe(apiPath);
  });
});

describe('failedRunProblem', () => {
  it('should pass a run that GitHub reports as a success', async () => {
    const asked: string[] = [];
    const problem = await failedRunProblem(RUN, async (apiPath) => {
      asked.push(apiPath);
      return 'success';
    });

    expect(problem).toBe('');
    expect(asked).toEqual(['repos/alexibid/ibid-workspace/actions/runs/42']);
  });

  it.each(['failure', 'cancelled', 'in progress'])('should refuse a run that ended as "%s"', async (conclusion) => {
    expect(await failedRunProblem(RUN, async () => conclusion)).toContain(`"${conclusion}", not "success"`);
  });

  it('should refuse a link that is not a run without asking GitHub', async () => {
    const problem = await failedRunProblem('https://github.com/alexibid/ibid-workspace', async () => {
      throw new Error('GitHub must not be asked');
    });

    expect(problem).toContain('not the link of a GitHub Actions run');
  });
});
