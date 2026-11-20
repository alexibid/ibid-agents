export const HANDOFF_CLIENTS = ['claude', 'antigravity', 'other'] as const;
export const HANDOFF_STATUSES = ['open', 'closed'] as const;

export type HandoffClient = (typeof HANDOFF_CLIENTS)[number];
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export interface NewHandoff {
  readonly workspace: string;
  readonly client: HandoffClient;
  readonly topic: string;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly nextAction: string;
  readonly openQuestions: readonly string[];
  readonly activeStoryId: string;
  readonly activeRunId: string;
  readonly activeCoachId: string;
}

export interface Handoff extends NewHandoff {
  readonly id: string;
  readonly status: HandoffStatus;
  readonly createdOn: string;
  readonly updatedOn: string;
}

export interface ActiveStorySummary {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly status: string;
  readonly updatedOn: string;
}

export interface ActiveRunSummary {
  readonly id: string;
  readonly agent: string;
  readonly request: string;
  readonly status: string;
  readonly updatedOn: string;
}

export interface ActiveBaton {
  readonly handoffs: readonly Handoff[];
  readonly activeStories: readonly ActiveStorySummary[];
  readonly activeRuns: readonly ActiveRunSummary[];
}

export function handoffNotice(baton: ActiveBaton): string {
  const lines = [
    ...baton.handoffs.map(formatHandoff),
    ...baton.activeStories.map(formatStory),
    ...baton.activeRuns.map(formatRun),
  ];
  if (lines.length === 0) {
    return '';
  }
  return [
    'Active handoff state in ibid-langgraph (call `resume_handoff` to read full details before continuing):',
    ...lines,
  ].join('\n');
}

function formatHandoff(handoff: Handoff): string {
  const next = handoff.nextAction === '' ? '' : ` — Next: ${handoff.nextAction}`;
  return `- Handoff [${handoff.workspace}] from ${handoff.client}: ${handoff.topic}${next}`;
}

function formatStory(story: ActiveStorySummary): string {
  return `- Active story ${story.id} (${story.project}, ${story.status}): ${story.title}`;
}

function formatRun(run: ActiveRunSummary): string {
  return `- Active agent run ${run.id} (${run.agent}, ${run.status}): ${run.request}`;
}
