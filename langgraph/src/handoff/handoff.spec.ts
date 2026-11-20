import { describe, expect, it } from 'vitest';
import { handoffNotice, type ActiveBaton } from './handoff.js';

const EMPTY_BATON: ActiveBaton = {
  handoffs: [],
  activeStories: [],
  activeRuns: [],
};

describe('handoffNotice', () => {
  it('should return an empty string when nothing is active', () => {
    expect(handoffNotice(EMPTY_BATON)).toBe('');
  });

  it('should list open handoffs, active stories and active runs', () => {
    const notice = handoffNotice({
      handoffs: [
        {
          id: 'h-1',
          workspace: 'ibid-workspace',
          client: 'claude',
          topic: 'Checkout flow',
          summary: 'Agreed on the API contract',
          decisions: ['Use Stripe webhook'],
          nextAction: 'Start the story for papikapi-api',
          openQuestions: [],
          activeStoryId: '',
          activeRunId: '',
          activeCoachId: '',
          status: 'open',
          createdOn: '2026-11-19T10:00:00.000Z',
          updatedOn: '2026-11-19T11:00:00.000Z',
        },
      ],
      activeStories: [
        {
          id: 'story-1',
          project: 'papikapi',
          title: 'Show receipt history',
          status: 'working',
          updatedOn: '2026-11-19T11:05:00.000Z',
        },
      ],
      activeRuns: [
        {
          id: 'run-1',
          agent: 'devops',
          request: 'Fix failing CI',
          status: 'needs-user',
          updatedOn: '2026-11-19T11:10:00.000Z',
        },
      ],
    });

    expect(notice).toContain('resume_handoff');
    expect(notice).toContain('Handoff [ibid-workspace] from claude: Checkout flow — Next: Start the story for papikapi-api');
    expect(notice).toContain('Active story story-1 (papikapi, working): Show receipt history');
    expect(notice).toContain('Active agent run run-1 (devops, needs-user): Fix failing CI');
  });

  it('should omit the next action suffix when none was saved', () => {
    const notice = handoffNotice({
      ...EMPTY_BATON,
      handoffs: [
        {
          id: 'h-2',
          workspace: 'ibid-agents',
          client: 'antigravity',
          topic: 'Handoff design',
          summary: 'Drafted the schema',
          decisions: [],
          nextAction: '',
          openQuestions: [],
          activeStoryId: '',
          activeRunId: '',
          activeCoachId: '',
          status: 'open',
          createdOn: '2026-11-19T10:00:00.000Z',
          updatedOn: '2026-11-19T11:00:00.000Z',
        },
      ],
    });

    expect(notice).toContain('Handoff [ibid-agents] from antigravity: Handoff design');
    expect(notice).not.toContain('— Next:');
  });
});
