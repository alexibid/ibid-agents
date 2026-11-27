import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentRunFlow } from './agent-run-flow.js';
import { verifyGithubIssues } from './github-link.js';

export interface AgentStartAttempt {
  readonly agent: string;
  readonly request: string;
  readonly issue: string;
  readonly epic: string;
}

export type BeforeAgentStart = (attempt: AgentStartAttempt) => Promise<void>;

const optionalIssueUrl = z.union([z.literal(''), z.url()]).default('');

function answer(found: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(found, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export async function startAgentRun(
  flow: AgentRunFlow,
  { agent, request, issue, epic }: AgentStartAttempt,
  beforeStart?: BeforeAgentStart,
) {
  return Promise.resolve()
    .then(() => beforeStart?.({ agent, request, issue, epic }))
    .then(() => verifyGithubIssues([issue, epic]))
    .then(() => flow.start(agent, request, { issue, epic }))
    .then(answer, refusal);
}

export function registerAgentRunTools(server: McpServer, flow: AgentRunFlow, beforeStart?: BeforeAgentStart): void {
  server.registerTool(
    'start_agent_run',
    {
      description:
        "Start an agent's own flow, the first thing an agent with a flow does when invoked. Returns the run id and the first step the flow engine waits for.",
      inputSchema: {
        agent: z.string().describe('The skill name of the agent, as in /name'),
        request: z.string().describe("The user's request, in their words"),
        issue: optionalIssueUrl.describe('Optional GitHub issue URL of the task or decision this run executes'),
        epic: optionalIssueUrl.describe('Optional GitHub issue URL of the parent epic'),
      },
    },
    async ({ agent, request, issue, epic }) =>
      startAgentRun(flow, { agent, request, issue, epic }, beforeStart),
  );

  server.registerTool(
    'submit_agent_step',
    {
      description:
        'Hand back the result of the current step of an agent run, in the exact shape asked for. The flow engine judges it and returns the next step, the exact problem, or that the run is finished (including any requiredFollowUp for linked GitHub issues).',
      inputSchema: {
        runId: z.string(),
        handBack: z.record(z.string(), z.unknown()).describe('The fields the current step asked for'),
      },
    },
    async ({ runId, handBack }) => flow.submit(runId, handBack).then(answer, refusal),
  );

  server.registerTool(
    'agent_run_status',
    {
      description: 'Read where an agent run stands: the step the flow engine waits for and the history.',
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => flow.report(runId).then(answer, refusal),
  );

  server.registerTool(
    'abandon_agent_run',
    {
      description:
        'Close an agent run the user no longer wants. It stops handing out steps and no longer keeps the workspace guard open. Use only when the user says so.',
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => flow.abandon(runId).then(answer, refusal),
  );
}
