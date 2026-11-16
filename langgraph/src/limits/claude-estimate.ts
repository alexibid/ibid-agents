import type { Database, Row } from '../store/database.js';
import type { TimeWindow } from '../usage/prompt-record.js';
import { currentWindowOf, ESTIMATE_POOL, roundedPercent, type LimitSample, type Spending } from './limit-sample.js';

interface SpendingRow extends Row {
  readonly askedOn: Date;
  readonly percent: number;
}

interface WeekRow extends Row {
  readonly opensAt: Date;
  readonly percent: number;
}

interface ReadingRow extends Row {
  readonly window: TimeWindow;
  readonly resetsOn: Date;
  readonly percent: number;
}

const WEEK_MS = 7 * 86_400_000;
const WEIGHT = '(input_tokens + 5 * output_tokens + 2 * cache_write_tokens + 0.1 * cache_read_tokens)::numeric';

const CAPACITIES = `
  weighed as (select model, asked_at, ${WEIGHT} as weight from prompts where tool = 'claude' and model like 'claude-%'),
  spent_before_hit as (
    select hits.time_window, hits.hit_at, weighed.model, sum(weighed.weight) as weight
    from limit_hits hits
    join weighed on weighed.asked_at between
      hits.resets_at - case hits.time_window when '5h' then interval '5 hours' else interval '7 days' end and hits.hit_at
    where hits.tool = 'claude'
    group by hits.time_window, hits.hit_at, weighed.model
  ),
  windows as (
    select time_window, hit_at, sum(weight) as capacity, (array_agg(model order by weight desc))[1] as model
    from spent_before_hit group by time_window, hit_at
  ),
  ranked as (
    select *,
      row_number() over (partition by time_window, model order by hit_at desc) as recency,
      row_number() over (partition by time_window order by hit_at desc) as overall_recency
    from windows where capacity > 0
  ),
  measured as (select time_window, model, avg(capacity) as capacity from ranked where recency <= 3 group by time_window, model),
  ratio as (
    select (select avg(capacity) from ranked where time_window = 'weekly' and overall_recency <= 6)
         / nullif((select avg(capacity) from ranked where time_window = '5h' and overall_recency <= 6), 0) as weekly_per_five_hours
  ),
  capacities as (
    select time_window, model, capacity from measured
    union all
    select 'weekly', five.model, five.capacity * ratio.weekly_per_five_hours
    from measured five, ratio
    where five.time_window = '5h' and ratio.weekly_per_five_hours is not null
      and not exists (select 1 from measured week where week.time_window = 'weekly' and week.model = five.model)
  )`;

const SHARE_OF = (window: string) => `
  (select round(${WEIGHT} / capacity * 100, 4) from capacities where time_window = '${window}' and model = prompts.model)`;

const ESTIMATE_PROMPTS = `
  with ${CAPACITIES}
  update prompts set
    five_hour_percent = coalesce(${SHARE_OF('5h')}, five_hour_percent),
    weekly_percent = coalesce(${SHARE_OF('weekly')}, weekly_percent),
    percent_estimated = true
  where tool = 'claude' and (five_hour_percent is null or weekly_percent is null or percent_estimated)
    and model in (select model from capacities)`;

const SINCE_FIVE_HOUR_RESET = `
  with opening as (
    select greatest(now() - interval '10 hours', coalesce(max(resets_at), '-infinity')) as earliest
    from limit_hits where tool = 'claude' and time_window = '5h' and resets_at <= now()
  )
  select greatest(asked_at, earliest) as "askedOn", coalesce(five_hour_percent, 0)::float8 as percent
  from prompts, opening
  where tool = 'claude' and finished_at > earliest
  order by asked_at`;

const SINCE_WEEKLY_RESET = `
  with anchor as (select max(resets_at) as known from limit_hits where tool = 'claude' and time_window = 'weekly'),
  opening as (
    select known + floor(extract(epoch from now() - known) / 604800) * interval '7 days' as opens_at
    from anchor where known is not null
  )
  select opens_at as "opensAt", coalesce(sum(weekly_percent), 0)::float8 as percent
  from opening left join prompts on prompts.tool = 'claude' and prompts.finished_at > opening.opens_at
  group by opens_at`;

const SINCE_LAST_READING = `
  with reading as (
    select distinct on (time_window) time_window, used_percent, resets_at, sampled_at
    from limit_samples where tool = 'claude' and pool <> $1 and resets_at > now()
    order by time_window, sampled_at desc
  )
  select reading.time_window as "window", reading.resets_at as "resetsOn",
    (reading.used_percent + coalesce(sum(case reading.time_window
      when '5h' then prompts.five_hour_percent else prompts.weekly_percent end), 0))::float8 as percent
  from reading
  left join prompts on prompts.tool = 'claude' and prompts.finished_at > reading.sampled_at
  group by reading.time_window, reading.resets_at, reading.used_percent`;

const MEASURED_RECENTLY = `
  select 1 from limit_samples
  where tool = 'claude' and pool <> $1 and sampled_at > now() - interval '10 minutes' limit 1`;

export class ClaudeEstimate {
  constructor(private readonly database: Database) {}

  async refresh(): Promise<LimitSample[]> {
    await this.database.rows(ESTIMATE_PROMPTS);
    if ((await this.database.rows(MEASURED_RECENTLY, [ESTIMATE_POOL])).length > 0) {
      return [];
    }
    const anchored = await this.#sinceLastReading();
    const anchoredWindows = new Set(anchored.map((sample) => sample.window));
    const fiveHours = anchoredWindows.has('5h') ? [] : await this.#fiveHours();
    const week = anchoredWindows.has('weekly') ? [] : await this.#week();
    return [...anchored, ...fiveHours, ...week];
  }

  async #sinceLastReading(): Promise<LimitSample[]> {
    return (await this.database.rows<ReadingRow>(SINCE_LAST_READING, [ESTIMATE_POOL])).map((row) => ({
      tool: 'claude',
      pool: ESTIMATE_POOL,
      window: row.window,
      usedPercent: roundedPercent(Math.min(row.percent, 100)),
      resetsOn: row.resetsOn.toISOString(),
    }));
  }

  async #fiveHours(): Promise<LimitSample[]> {
    const spending: Spending[] = (await this.database.rows<SpendingRow>(SINCE_FIVE_HOUR_RESET)).map((row) => ({
      askedOn: row.askedOn,
      percent: row.percent,
    }));
    return currentWindowOf(spending, new Date());
  }

  async #week(): Promise<LimitSample[]> {
    return (await this.database.rows<WeekRow>(SINCE_WEEKLY_RESET)).map((row) => ({
      tool: 'claude',
      pool: ESTIMATE_POOL,
      window: 'weekly',
      usedPercent: roundedPercent(Math.min(row.percent, 100)),
      resetsOn: new Date(row.opensAt.getTime() + WEEK_MS).toISOString(),
    }));
  }
}
