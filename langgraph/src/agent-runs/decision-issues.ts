import { latestThreads, type LatestThread } from '../store/story-threads.js';
import type { AgentFlowDefinition, FlowFollowUp } from './definition.js';
import type { RunFollowUp, RunOrigin } from './state.js';

export interface DecisionRunRecord {
  readonly runId: string;
  readonly agent: string;
  readonly finishedOn: string;
  readonly linkedIssues: readonly string[];
  readonly repositories: readonly string[];
  readonly requiredFollowUp?: RunFollowUp;
  readonly followUpStatus: 'pending' | 'reviewed';
}

interface IndexedDecision {
  readonly thread: LatestThread;
  readonly agent: string;
  readonly linkedIssues: readonly string[];
  readonly repositories: readonly string[];
  readonly requiredFollowUp: RunFollowUp | 'none';
  readonly resolvers: ReadonlySet<string>;
}

const FINISHED = 'finished';
const DEFAULT_RESOLVERS: readonly string[] = ['project-manager', 'issue-review'];
const ISSUE_URL = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/g;
const ISSUE_SHORTHAND = /(?:^|[^\w/])([\w.-]+\/[\w.-]+)#(\d+)\b/g;
const EXACT_ISSUE_URL = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)\/?$/;
const FOLLOW_UP_REASON =
  'A decision run tied to GitHub issue(s) finished with no git commit, so story or commit GitHub sync will not close the decision issue.';

export function linkedIssuesIn(request: string, origin: Partial<RunOrigin> = {}): string[] {
  const explicit = [origin.issue ?? '', origin.epic ?? ''].map(normalizedUrl).filter((url) => url !== '');
  const fullUrls = [...request.matchAll(ISSUE_URL)].map((match) => `https://github.com/${match[1]}/issues/${match[2]}`);
  const shorthands = [...request.matchAll(ISSUE_SHORTHAND)].map((match) => `https://github.com/${match[1]}/issues/${match[2]}`);
  return [...new Set([...explicit, ...fullUrls, ...shorthands])];
}

export function repositoriesOf(issues: readonly string[]): string[] {
  const repositories = issues.flatMap((url) => {
    const match = EXACT_ISSUE_URL.exec(url.trim());
    return match?.[1] === undefined ? [] : [match[1]];
  });
  return [...new Set(repositories)];
}

export function followUpFor(definition: AgentFlowDefinition, linkedIssues: readonly string[]): RunFollowUp | 'none' {
  const afterFinish = definition.afterFinish;
  if (afterFinish === undefined) {
    return 'none';
  }
  if (afterFinish.when === 'linked-issues' && linkedIssues.length === 0) {
    return 'none';
  }
  return {
    agent: afterFinish.agent,
    ...(afterFinish.noApprovalAgent !== undefined ? { noApprovalAgent: afterFinish.noApprovalAgent } : {}),
    issues: linkedIssues,
    repositories: repositoriesOf(linkedIssues),
    reason: FOLLOW_UP_REASON,
    instruction: afterFinish.instruction,
  };
}

export function decisionRunsIn(
  stateFile: string,
  decisionFlows: readonly Pick<AgentFlowDefinition, 'agent' | 'afterFinish'>[] = [],
): DecisionRunRecord[] {
  const threads = latestThreads(stateFile).filter((thread) => thread.values['status'] === FINISHED);
  const flowsByAgent = new Map(
    decisionFlows.flatMap((flow) => (flow.afterFinish === undefined ? [] : [[flow.agent, flow.afterFinish]])),
  );
  const decisions = threads.flatMap((thread) => asDecision(thread, flowsByAgent));
  const resolverNames = allResolverNames(decisions);
  const resolvers = threads
    .map((thread) => ({ thread, agent: agentOf(thread) }))
    .filter(({ agent }) => resolverNames.has(agent));
  return decisions
    .sort((first, second) => second.thread.sequence - first.thread.sequence)
    .map((decision) => toRecord(decision, resolvers));
}

export class PendingDecisionReviewError extends Error {
  constructor(runId: string, issues: readonly string[]) {
    super(
      `Decision run "${runId}" finished for ${issues.join(', ')} with no git commit, so its GitHub issue will not close on commit. Run /issue-review (or /project-manager if story criteria or backlog items changed) before starting a story.`,
    );
    this.name = 'PendingDecisionReviewError';
  }
}

export function ensureNoPendingDecision(origin: RunOrigin, runs: readonly DecisionRunRecord[]): RunOrigin {
  const pending = pendingDecisionFor(origin, runs);
  if (pending !== 'none') {
    throw new PendingDecisionReviewError(pending.runId, pending.linkedIssues);
  }
  return origin;
}

export function pendingDecisionFor(origin: RunOrigin, runs: readonly DecisionRunRecord[]): DecisionRunRecord | 'none' {
  const originRepositories = repositoriesOf([origin.issue, origin.epic]);
  const found = runs.find(
    (run) =>
      run.requiredFollowUp !== undefined &&
      run.followUpStatus === 'pending' &&
      matchesOrigin(run, origin, originRepositories),
  );
  return found ?? 'none';
}

function asDecision(thread: LatestThread, flowsByAgent: ReadonlyMap<string, FlowFollowUp>): IndexedDecision[] {
  const agent = agentOf(thread);
  const storedFollowUp = readFollowUp(thread.values['requiredFollowUp']);
  const configured = flowsByAgent.get(agent);
  if (storedFollowUp === 'none' && configured === undefined) {
    return [];
  }
  const linkedIssues = storedIssuesIn(thread, storedFollowUp);
  if (linkedIssues.length === 0) {
    return [];
  }
  return [
    {
      thread,
      agent,
      linkedIssues,
      repositories: repositoriesOf(linkedIssues),
      requiredFollowUp: storedFollowUp,
      resolvers: resolversFor(storedFollowUp, configured),
    },
  ];
}

function toRecord(decision: IndexedDecision, resolvers: readonly { readonly thread: LatestThread; readonly agent: string }[]): DecisionRunRecord {
  const reviewed = resolvers.some(
    ({ thread, agent }) =>
      decision.resolvers.has(agent) &&
      finishedAfter(thread, decision.thread) &&
      coversDecision(thread, decision.linkedIssues, decision.repositories),
  );
  return {
    runId: decision.thread.threadId,
    agent: decision.agent,
    finishedOn: decision.thread.updatedOn.toISOString(),
    linkedIssues: decision.linkedIssues,
    repositories: decision.repositories,
    ...(decision.requiredFollowUp === 'none' ? {} : { requiredFollowUp: decision.requiredFollowUp }),
    followUpStatus: reviewed ? 'reviewed' : 'pending',
  };
}

function allResolverNames(decisions: readonly IndexedDecision[]): Set<string> {
  const names = new Set<string>(DEFAULT_RESOLVERS);
  for (const decision of decisions) {
    for (const resolver of decision.resolvers) {
      names.add(resolver);
    }
  }
  return names;
}

function resolversFor(stored: RunFollowUp | 'none', configured: FlowFollowUp | undefined): Set<string> {
  const names = [
    ...(stored === 'none' ? [] : [stored.agent, stored.noApprovalAgent ?? '']),
    ...(configured === undefined ? [] : [configured.agent, configured.noApprovalAgent ?? '']),
  ].filter((name) => name !== '');
  return new Set(names.length > 0 ? names : DEFAULT_RESOLVERS);
}

function storedIssuesIn(thread: LatestThread, storedFollowUp: RunFollowUp | 'none'): string[] {
  if (storedFollowUp !== 'none' && storedFollowUp.issues.length > 0) {
    return [...storedFollowUp.issues];
  }
  const linked = stringArray(thread.values['linkedIssues']);
  if (linked.length > 0) {
    return linked;
  }
  return linkedIssuesIn(textOf(thread.values['request']), readOrigin(thread.values['origin']));
}

function matchesOrigin(run: DecisionRunRecord, origin: RunOrigin, originRepositories: readonly string[]): boolean {
  if (run.linkedIssues.includes(origin.issue) || (origin.epic !== '' && run.linkedIssues.includes(origin.epic))) {
    return true;
  }
  return originRepositories.some((repository) => run.repositories.includes(repository));
}

function finishedAfter(later: LatestThread, earlier: LatestThread): boolean {
  const diff = later.updatedOn.getTime() - earlier.updatedOn.getTime();
  return diff !== 0 ? diff > 0 : later.sequence > earlier.sequence;
}

function coversDecision(thread: LatestThread, issues: readonly string[], repositories: readonly string[]): boolean {
  const corpus = `${textOf(thread.values['request'])}\n${JSON.stringify(thread.values['results'] ?? {})}`.toLowerCase();
  if (issues.some((issue) => corpus.includes(issue.toLowerCase()))) {
    return true;
  }
  return repositories.some((repository) => corpusMentionsRepo(corpus, repository));
}

function corpusMentionsRepo(corpus: string, repository: string): boolean {
  const lower = repository.toLowerCase();
  if (corpus.includes(lower)) {
    return true;
  }
  const name = lower.split('/')[1] ?? '';
  return name !== '' && new RegExp(`(?<![a-z0-9-])${escapeRegExp(name)}(?![a-z0-9-])`).test(corpus);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizedUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function agentOf(thread: LatestThread): string {
  return textOf(thread.values['agent']) || thread.threadId.split('~')[0] || '';
}

function readOrigin(value: unknown): Partial<RunOrigin> {
  if (!isRecord(value)) {
    return {};
  }
  return { issue: textOf(value['issue']), epic: textOf(value['epic']) };
}

function readFollowUp(value: unknown): RunFollowUp | 'none' {
  if (!isRecord(value)) {
    return 'none';
  }
  const agent = textOf(value['agent']);
  const noApprovalAgent = textOf(value['noApprovalAgent']);
  const instruction = textOf(value['instruction']);
  const reason = textOf(value['reason']);
  const issues = stringArray(value['issues']);
  const repositories = stringArray(value['repositories']);
  if (agent === '' || instruction === '') {
    return 'none';
  }
  return {
    agent,
    ...(noApprovalAgent === '' ? {} : { noApprovalAgent }),
    issues,
    repositories,
    reason,
    instruction,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '') : [];
}
