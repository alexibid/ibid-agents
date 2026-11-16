import type { Database, Row } from '../store/database.js';

export type Percent = number | 'unknown';

export interface Page {
  readonly limit: number;
  readonly offset: number;
}

const PROMPT_COLUMNS = `
  prompts.id, prompts.tool, prompts.model, prompts.workspace, prompts.conversation_id as "conversationId",
  prompts.asked_at as "askedOn", prompts.finished_at as "finishedOn",
  prompts.input_tokens::float8 as "inputTokens", prompts.output_tokens::float8 as "outputTokens",
  prompts.cache_read_tokens::float8 as "cacheReadTokens", prompts.cache_write_tokens::float8 as "cacheWriteTokens",
  coalesce(prompts.five_hour_percent::float8::text, 'unknown') as "fiveHourPercent",
  coalesce(prompts.weekly_percent::float8::text, 'unknown') as "weeklyPercent",
  prompts.percent_estimated as "percentEstimated", prompts.errors`;

const PROMPTS = `
  select ${PROMPT_COLUMNS}, left(prompts.text, 400) as text,
    coalesce((select array_agg(distinct agent) from agent_calls where prompt_id = prompts.id and kind <> 'tool'), '{}') as agents,
    (select count(distinct agent)::int from agent_calls where prompt_id = prompts.id and kind = 'tool') as "toolsUsed"
  from prompts order by prompts.asked_at desc limit $1 offset $2`;

const PROMPT = `select ${PROMPT_COLUMNS}, prompts.text from prompts where prompts.id = $1`;

const CALLS = `
  select id, agent, kind, request, response, failed, called_at as "calledOn"
  from agent_calls where prompt_id = $1 order by called_at, id`;

const LIMITS = `
  with latest as (
    select distinct on (tool, pool, time_window)
      tool, pool, time_window as "window", used_percent::float8 as "usedPercent",
      resets_at as "resetsOn", sampled_at as "sampledOn"
    from limit_samples order by tool, pool, time_window, sampled_at desc
  )
  select * from latest
  where not exists (
    select 1 from latest newer
    where newer.tool = latest.tool and newer."window" = latest."window" and newer."sampledOn" > latest."sampledOn"
      and 'estimate' in (newer.pool, latest.pool)
  )
  order by tool, pool, "window"`;

const TOKENS_BY_DAY = `
  select to_char(date_trunc('day', asked_at), 'YYYY-MM-DD') as day, tool,
    sum(input_tokens + output_tokens + cache_write_tokens)::float8 as tokens,
    sum(cache_read_tokens)::float8 as "cachedTokens", count(*)::int as prompts
  from prompts where asked_at > now() - make_interval(days => $1)
  group by 1, 2 order by 1, 2`;

const STEPS = `
  select step, count(*)::int as runs, count(*) filter (where not passed)::int as failures,
    round(avg(seconds_taken), 1)::float8 as "averageSeconds"
  from step_events where occurred_at > now() - make_interval(days => $1)
  group by step order by failures desc, runs desc`;

const AGENTS = `
  select agent, kind, count(*)::int as calls, count(*) filter (where failed)::int as failures
  from agent_calls where called_at > now() - make_interval(days => $1) and kind <> 'tool'
  group by agent, kind order by calls desc`;

const STORIES = `
  select id, project, title, status, started_at as "startedOn", updated_at as "updatedOn",
    coalesce((select json_agg(json_build_object('step', step, 'passed', passed, 'attempt', attempt,
      'details', details, 'seconds', seconds_taken::float8, 'occurredOn', occurred_at) order by step_events.id)
      from step_events where story_id = stories.id), '[]') as steps
  from stories order by started_at desc limit $1 offset $2`;

const ERRORS = `
  select * from (
    select prompts.asked_at as "occurredOn", 'prompt' as source, prompts.tool, left(prompts.text, 160) as "where",
      message, prompts.id as "promptId"
    from prompts, unnest(prompts.errors) as message
    union all
    select agent_calls.called_at, 'agent', prompts.tool, agent_calls.agent, left(agent_calls.response, 2000), prompts.id
    from agent_calls join prompts on prompts.id = agent_calls.prompt_id where agent_calls.failed
    union all
    select step_events.occurred_at, 'step', 'langgraph', stories.project || ' · ' || step_events.step,
      array_to_string(step_events.details, E'\\n'), ''
    from step_events join stories on stories.id = step_events.story_id where not step_events.passed
  ) problems order by "occurredOn" desc limit $1 offset $2`;

const AGENT_ROSTER = `
  select agent, kind, count(*)::int as calls, count(*) filter (where failed)::int as failures,
    max(called_at) as "lastOn"
  from agent_calls where kind <> 'tool'
  group by agent, kind order by max(called_at) desc`;

const AGENT_ACTIVITY = `
  select agent_calls.id, agent_calls.kind, agent_calls.request, agent_calls.response, agent_calls.failed,
    agent_calls.called_at as "calledOn", prompts.id as "promptId", prompts.tool, left(prompts.text, 240) as "promptText"
  from agent_calls join prompts on prompts.id = agent_calls.prompt_id
  where agent_calls.agent = $1 and agent_calls.kind <> 'tool'
  order by agent_calls.called_at desc limit $2 offset $3`;

const RUNS = `
  select id, agent as project, request as title, status, started_at as "startedOn", updated_at as "updatedOn",
    coalesce((select json_agg(json_build_object('step', step, 'passed', passed, 'attempt', attempt,
      'details', details, 'seconds', seconds_taken::float8, 'occurredOn', occurred_at) order by agent_run_events.id)
      from agent_run_events where run_id = agent_runs.id), '[]') as steps
  from agent_runs where agent = $1 order by started_at desc limit $2`;

export class MonitorQueries {
  constructor(private readonly database: Database) {}

  prompts({ limit, offset }: Page): Promise<Row[]> {
    return this.database.rows(PROMPTS, [limit, offset]).then((rows) => rows.map(withPercents));
  }

  async prompt(promptId: string): Promise<Row[]> {
    const [found, calls] = await Promise.all([this.database.rows(PROMPT, [promptId]), this.database.rows(CALLS, [promptId])]);
    return found.map((row) => ({ ...withPercents(row), calls }));
  }

  limits(): Promise<Row[]> {
    return this.database.rows(LIMITS);
  }

  async telemetry(days: number): Promise<Row> {
    const [tokensByDay, steps, agents] = await Promise.all(
      [TOKENS_BY_DAY, STEPS, AGENTS].map((query) => this.database.rows(query, [days])),
    );
    return { tokensByDay, steps, agents };
  }

  stories({ limit, offset }: Page): Promise<Row[]> {
    return this.database.rows(STORIES, [limit, offset]);
  }

  errors({ limit, offset }: Page): Promise<Row[]> {
    return this.database.rows(ERRORS, [limit, offset]);
  }

  runs(agent: string, { limit }: Page): Promise<Row[]> {
    return this.database.rows(RUNS, [agent, limit]);
  }

  agentRoster(): Promise<Row[]> {
    return this.database.rows(AGENT_ROSTER);
  }

  agentActivity(agent: string, { limit, offset }: Page): Promise<Row[]> {
    return this.database.rows(AGENT_ACTIVITY, [agent, limit, offset]);
  }
}

function withPercents(row: Row): Row {
  return { ...row, fiveHourPercent: percentOf(row['fiveHourPercent']), weeklyPercent: percentOf(row['weeklyPercent']) };
}

function percentOf(value: unknown): Percent {
  const percent = Number(value);
  return typeof value === 'string' && value !== 'unknown' && Number.isFinite(percent) ? percent : 'unknown';
}
