export interface PromptOfTool {
  readonly prompt: string;
  readonly tool: 'claude' | 'antigravity';
}

const NOTHING = '';
const TYPED_FIRST = /^\s*\/([a-z][a-z0-9-]*)(?=$|\s)/;
const COMMAND_TAG = /<command-name>\/([a-z][a-z0-9-]*)<\/command-name>/g;

export function promptOf(rawPayload: string): PromptOfTool {
  try {
    const payload: unknown = JSON.parse(rawPayload);
    if (typeof payload !== 'object' || payload === null) {
      return { prompt: NOTHING, tool: 'claude' };
    }
    const fields = payload as Readonly<Record<string, unknown>>;
    if (typeof fields['lastUserInput'] === 'string') {
      return { prompt: fields['lastUserInput'], tool: 'antigravity' };
    }
    return { prompt: typeof fields['prompt'] === 'string' ? fields['prompt'] : NOTHING, tool: 'claude' };
  } catch {
    return { prompt: NOTHING, tool: 'claude' };
  }
}

export function invokedFlows(prompt: string, agentsWithFlow: ReadonlySet<string>): string[] {
  const typed = TYPED_FIRST.exec(prompt)?.[1];
  const tagged = [...prompt.matchAll(COMMAND_TAG)].map((match) => match[1] ?? NOTHING);
  const named = [...(typed === undefined ? [] : [typed]), ...tagged];
  const normalized = named.map((name) => (name === 'assistente' ? 'assistant' : name));
  return [...new Set(normalized.filter((agent) => agentsWithFlow.has(agent) || agent === 'assistant'))];
}

export function reminderFor(agents: readonly string[]): string {
  if (agents.length === 0) {
    return NOTHING;
  }
  if (agents[0] === 'assistant') {
    return [
      'The assistant is a pure messenger and orchestrator for ibid-workspace.',
      'Never read or edit code directly.',
      'Before doing anything else, call recall_notes or start_story on ibid-langgraph',
      '(or call start_agent_run with agent "devops" if this is a CI/pipeline failure).',
      'Delegate every step to its concrete subagent (define_subagent + invoke_subagent in Antigravity, or Agent in Claude),',
      'and report task progress in a short bulleted status list.',
    ].join(' ');
  }
  const named = agents.map((agent) => `/${agent}`).join(', ');
  return [
    `${named} runs through its own flow.`,
    `Before doing anything else, call start_agent_run on ibid-langgraph with agent "${agents[0]}" and the user's request,`,
    'then do one step at a time and hand each back with submit_agent_step until the status is finished or needs-user.',
    'Do not answer from memory without the flow. If the flow engine cannot be reached, say so and stop.',
  ].join(' ');
}

export function answerFor(tool: PromptOfTool['tool'], reminder: string): string {
  if (reminder === NOTHING) {
    return NOTHING;
  }
  return tool === 'antigravity'
    ? JSON.stringify({ injectSteps: [{ ephemeralMessage: reminder }] })
    : JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: reminder } });
}
