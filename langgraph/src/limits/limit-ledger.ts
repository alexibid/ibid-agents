import type { Database, Statement } from '../store/database.js';
import type { LimitSample } from './limit-sample.js';

const KEEP_SAMPLE = `
  insert into limit_samples (tool, pool, time_window, used_percent, resets_at) values ($1, $2, $3, $4, $5)`;

const FORGET_OLD_SAMPLES = `delete from limit_samples where sampled_at < now() - interval '30 days'`;

const NEAREST = `
  select used_percent from limit_samples
  where tool = pools.tool and pool = pools.pool and time_window = pools.time_window`;

const SHARE_OUT = `
  with pools as (select distinct tool, pool, time_window from limit_samples where pool <> 'estimate'),
  spent as (
    select prompts.id, pools.time_window,
      max(case when after.used_percent >= before.used_percent
        then after.used_percent - before.used_percent else after.used_percent end) as percent
    from prompts
    join pools on pools.tool = prompts.tool
    join lateral (${NEAREST}
      and sampled_at between prompts.asked_at - interval '10 minutes' and prompts.asked_at
      order by sampled_at desc limit 1) before on true
    join lateral (${NEAREST}
      and sampled_at between prompts.finished_at and prompts.finished_at + interval '10 minutes'
      order by sampled_at asc limit 1) after on true
    where prompts.asked_at > now() - interval '12 hours'
    group by prompts.id, pools.time_window
  )
  update prompts set
    five_hour_percent = coalesce((select percent from spent where id = prompts.id and time_window = '5h'), five_hour_percent),
    weekly_percent = coalesce((select percent from spent where id = prompts.id and time_window = 'weekly'), weekly_percent),
    percent_estimated = false
  where id in (select id from spent)`;

export class LimitLedger {
  constructor(private readonly database: Database) {}

  async keep(samples: readonly LimitSample[]): Promise<void> {
    const kept: Statement[] = samples.map((sample) => ({
      text: KEEP_SAMPLE,
      values: [sample.tool, sample.pool, sample.window, sample.usedPercent, sample.resetsOn],
    }));
    await this.database.inOneTransaction([...kept, { text: FORGET_OLD_SAMPLES, values: [] }]);
  }

  async shareOutAmongPrompts(): Promise<void> {
    await this.database.rows(SHARE_OUT);
  }
}
