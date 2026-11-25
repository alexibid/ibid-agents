import type { Database, Row, Statement } from '../store/database.js';
import { issueTypeOf, labelsOf, type BacklogDraft, type IssueLink, type ItemKind, type Size } from './backlog.js';

export type ItemState = 'draft' | 'published';

export interface StoredItem {
  readonly key: string;
  readonly kind: ItemKind;
  readonly title: string;
  readonly body: string;
  readonly size: Size;
  readonly repository: string;
  readonly parent: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly issueUrl: string;
  readonly state: ItemState;
}

export interface StoredEpic {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly runId: string;
  readonly updatedOn: string;
  readonly items: readonly StoredItem[];
}

export interface BacklogArchive {
  keepDraft(runId: string, draft: BacklogDraft): Promise<void>;
  recordPublished(epicId: string, links: readonly IssueLink[]): Promise<void>;
  epics(project: string): Promise<StoredEpic[]>;
}

interface ItemRow extends Row {
  readonly epic_id: string;
  readonly key: string;
  readonly kind: ItemKind;
  readonly project: string;
  readonly title: string;
  readonly body: string;
  readonly size: Size;
  readonly repository: string;
  readonly parent_key: string;
  readonly issue_url: string;
  readonly state: ItemState;
  readonly run_id: string;
  readonly updated_at: Date;
}

const DROP_LEFT_OUT = "delete from backlog_items where epic_id = $1 and state = 'draft' and not (key = any($2::text[]))";

const KEEP_ITEM = `
  insert into backlog_items (epic_id, key, position, kind, project, title, body, size, repository, parent_key, issue_url, state, run_id)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
  on conflict (epic_id, key) do update
    set position = excluded.position, kind = excluded.kind, project = excluded.project, title = excluded.title,
        body = excluded.body, size = excluded.size, repository = excluded.repository, parent_key = excluded.parent_key,
        issue_url = case when excluded.issue_url <> '' then excluded.issue_url else backlog_items.issue_url end,
        state = 'draft', run_id = excluded.run_id, updated_at = now()`;

const PUBLISH_ITEM = `update backlog_items set issue_url = $3, state = 'published', updated_at = now() where epic_id = $1 and key = $2`;

const EPICS = `
  select * from backlog_items
  where $1 = '' or project = $1
  order by max(updated_at) over (partition by epic_id) desc, epic_id, position`;

export class PostgresBacklogArchive implements BacklogArchive {
  constructor(private readonly database: Database) {}

  keepDraft(runId: string, draft: BacklogDraft): Promise<void> {
    const keys = draft.items.map((item) => item.key);
    const items: Statement[] = draft.items.map((item, position) => ({
      text: KEEP_ITEM,
      values: [
        draft.id,
        item.key,
        position,
        item.kind,
        draft.project,
        item.title,
        item.body,
        item.size,
        item.repository,
        item.parent,
        item.issue,
        runId,
      ],
    }));
    return this.database.inOneTransaction([{ text: DROP_LEFT_OUT, values: [draft.id, keys] }, ...items]);
  }

  recordPublished(epicId: string, links: readonly IssueLink[]): Promise<void> {
    return this.database.inOneTransaction(links.map((link) => ({ text: PUBLISH_ITEM, values: [epicId, link.key, link.url] })));
  }

  async epics(project: string): Promise<StoredEpic[]> {
    const rows = await this.database.rows<ItemRow>(EPICS, [project]);
    return groupedByEpic(rows);
  }
}

function groupedByEpic(rows: readonly ItemRow[]): StoredEpic[] {
  const epics = new Map<string, ItemRow[]>();
  for (const row of rows) {
    epics.set(row.epic_id, [...(epics.get(row.epic_id) ?? []), row]);
  }
  return [...epics.entries()].map(([id, items]) => epicOf(id, items));
}

function epicOf(id: string, rows: readonly ItemRow[]): StoredEpic {
  const head = rows.find((row) => row.kind === 'epic') ?? rows[0];
  const latest = Math.max(...rows.map((row) => row.updated_at.getTime()));
  return {
    id,
    project: head?.project ?? '',
    title: head?.title ?? id,
    runId: head?.run_id ?? '',
    updatedOn: new Date(latest).toISOString(),
    items: rows.map(itemOf),
  };
}

function itemOf(row: ItemRow): StoredItem {
  return {
    key: row.key,
    kind: row.kind,
    title: row.title,
    body: row.body,
    size: row.size,
    repository: row.repository,
    parent: row.parent_key,
    issueType: issueTypeOf(row.kind),
    labels: labelsOf(row),
    issueUrl: row.issue_url,
    state: row.state,
  };
}
