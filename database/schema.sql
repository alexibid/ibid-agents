create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('idea', 'plan', 'decision', 'research')),
  status text not null check (status in ('open', 'done', 'dropped')),
  project text not null,
  title text not null,
  body text not null,
  keywords text[] not null default '{}',
  sources text[] not null default '{}',
  search tsvector not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notes_identity on notes (project, kind, lower(title));
create index if not exists notes_search on notes using gin (search);

create or replace function note_search(title text, body text, keywords text[]) returns tsvector
language sql stable as $$
  select
    setweight(to_tsvector('portuguese', title || ' ' || array_to_string(keywords, ' ')), 'A') ||
    setweight(to_tsvector('english', title || ' ' || array_to_string(keywords, ' ')), 'A') ||
    setweight(to_tsvector('portuguese', body), 'B') ||
    setweight(to_tsvector('english', body), 'B')
$$;

create or replace function note_query(question text) returns tsquery
language sql stable as $$
  select coalesce(
    string_agg(plainto_tsquery('portuguese', word)::text || ' | ' || plainto_tsquery('english', word)::text, ' | '),
    ''
  )::tsquery
  from regexp_split_to_table(lower(question), '[\s,.;:!?()"''/]+') as word
  where word <> ''
    and numnode(plainto_tsquery('portuguese', word)) > 0
    and numnode(plainto_tsquery('english', word)) > 0
$$;

create table if not exists stories (
  id text primary key,
  project text not null,
  title text not null,
  criteria text[] not null,
  status text not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists step_events (
  id bigint generated always as identity primary key,
  story_id text not null references stories (id) on delete cascade,
  step text not null,
  passed boolean not null,
  details text[] not null default '{}',
  attempt integer not null,
  seconds_taken numeric not null,
  occurred_at timestamptz not null default now()
);

create index if not exists step_events_story on step_events (story_id, occurred_at);

create table if not exists transcript_files (
  path text primary key,
  tool text not null,
  size_bytes bigint not null,
  modified_at timestamptz not null
);

create table if not exists prompts (
  id text primary key,
  tool text not null check (tool in ('claude', 'antigravity')),
  conversation_id text not null,
  workspace text not null,
  model text not null,
  text text not null,
  asked_at timestamptz not null,
  finished_at timestamptz not null,
  input_tokens bigint not null,
  output_tokens bigint not null,
  cache_read_tokens bigint not null,
  cache_write_tokens bigint not null,
  five_hour_percent numeric,
  weekly_percent numeric
);

alter table prompts add column if not exists errors text[] not null default '{}';
alter table prompts add column if not exists percent_estimated boolean not null default false;

create index if not exists prompts_recent on prompts (asked_at desc);

create table if not exists agent_calls (
  id text primary key,
  prompt_id text not null references prompts (id) on delete cascade,
  agent text not null,
  kind text not null check (kind in ('agent', 'langgraph', 'skill')),
  request text not null,
  response text not null,
  failed boolean not null,
  called_at timestamptz not null
);

alter table agent_calls drop constraint if exists agent_calls_kind_check;
alter table agent_calls add constraint agent_calls_kind_check check (kind in ('agent', 'langgraph', 'skill', 'tool'));

alter table agent_calls add column if not exists called_by text not null default '';

create index if not exists agent_calls_prompt on agent_calls (prompt_id, called_at);
create index if not exists agent_calls_agents on agent_calls (agent, called_at desc) where kind <> 'tool';
create index if not exists agent_calls_failures on agent_calls (called_at desc) where failed;

create table if not exists limit_samples (
  id bigint generated always as identity primary key,
  tool text not null check (tool in ('claude', 'antigravity')),
  pool text not null,
  time_window text not null check (time_window in ('5h', 'weekly')),
  used_percent numeric not null,
  resets_at timestamptz not null,
  sampled_at timestamptz not null default now()
);

create index if not exists limit_samples_recent on limit_samples (tool, pool, time_window, sampled_at desc);

create table if not exists limit_hits (
  tool text not null check (tool in ('claude', 'antigravity')),
  time_window text not null check (time_window in ('5h', 'weekly')),
  hit_at timestamptz not null,
  resets_at timestamptz not null,
  primary key (tool, time_window, resets_at)
);

create table if not exists agent_runs (
  id text primary key,
  agent text not null,
  request text not null,
  status text not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_run_events (
  id bigint generated always as identity primary key,
  run_id text not null references agent_runs (id) on delete cascade,
  step text not null,
  passed boolean not null,
  details text[] not null default '{}',
  attempt integer not null,
  seconds_taken numeric not null,
  occurred_at timestamptz not null default now()
);

create index if not exists agent_run_events_run on agent_run_events (run_id, occurred_at);

create table if not exists eval_results (
  id bigint generated always as identity primary key,
  agent text not null,
  case_id text not null,
  request text not null,
  passed boolean not null,
  details text[] not null default '{}',
  run_id text not null,
  answer text not null,
  ran_at timestamptz not null default now()
);

create index if not exists eval_results_recent on eval_results (agent, case_id, ran_at desc);

create table if not exists backlog_items (
  epic_id text not null,
  key text not null,
  position integer not null,
  kind text not null check (kind in ('epic', 'story', 'task')),
  project text not null,
  title text not null,
  body text not null,
  size text not null check (size in ('S', 'M', 'L')),
  repository text not null,
  parent_key text not null default '',
  issue_url text not null default '',
  state text not null check (state in ('draft', 'published')),
  run_id text not null,
  updated_at timestamptz not null default now(),
  primary key (epic_id, key)
);

create index if not exists backlog_items_recent on backlog_items (updated_at desc);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  client text not null check (client in ('claude', 'antigravity', 'other')),
  topic text not null,
  summary text not null,
  decisions text[] not null default '{}',
  next_action text not null default '',
  open_questions text[] not null default '{}',
  active_story_id text not null default '',
  active_run_id text not null default '',
  active_coach_id text not null default '',
  status text not null check (status in ('open', 'closed')) default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists handoffs_open_topic on handoffs (workspace, lower(topic)) where status = 'open';
create index if not exists handoffs_recent on handoffs (status, updated_at desc);
