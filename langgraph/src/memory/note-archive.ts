import type { Database, Row } from '../store/database.js';
import { initialStatusOf, type NewNote, type Note, type NoteKind, type NoteStatus, type Question, type StatusChange } from './note.js';

export interface NoteArchive {
  remember(newNote: NewNote): Promise<Note>;
  recall(question: Question): Promise<Note[]>;
  stillOpen(projects: readonly string[]): Promise<Note[]>;
  changeStatus(change: StatusChange): Promise<Note>;
  plans(text: string): Promise<Note[]>;
  forget(noteId: string): Promise<void>;
}

interface NoteRow extends Row {
  readonly id: string;
  readonly kind: NoteKind;
  readonly status: NoteStatus;
  readonly project: string;
  readonly title: string;
  readonly body: string;
  readonly keywords: readonly string[];
  readonly sources: readonly string[];
  readonly created_at: Date;
  readonly updated_at: Date;
}

export class UnknownNoteError extends Error {
  constructor(noteId: string) {
    super(`No note has the id "${noteId}".`);
    this.name = 'UnknownNoteError';
  }
}

const MOST_RELEVANT = 8;
const COLUMNS = 'id, kind, status, project, title, body, keywords, sources, created_at, updated_at';
const IN_PROJECTS = '(cardinality($1::text[]) = 0 or project = any($1))';

const REMEMBER = `
  insert into notes (kind, status, project, title, body, keywords, sources, search)
  values ($1, $2, $3, $4, $5, $6, $7, note_search($4, $5, $6))
  on conflict (project, kind, lower(title)) do update
    set body = excluded.body, keywords = excluded.keywords, sources = excluded.sources,
        search = excluded.search, updated_at = now()
  returning ${COLUMNS}`;

const RECALL = `
  select ${COLUMNS} from notes
  where ${IN_PROJECTS} and search @@ note_query($2)
  order by ts_rank(search, note_query($2)) desc, updated_at desc
  limit ${MOST_RELEVANT}`;

const STILL_OPEN = `select ${COLUMNS} from notes where ${IN_PROJECTS} and status = 'open' order by updated_at desc`;

const PLAN_KINDS = `kind in ('idea', 'plan')`;
const OPEN_FIRST = `case status when 'open' then 0 when 'done' then 1 else 2 end`;

const ALL_PLANS = `select ${COLUMNS} from notes where ${PLAN_KINDS} order by ${OPEN_FIRST}, updated_at desc`;

const MATCHING_PLANS = `
  select ${COLUMNS} from notes
  where ${PLAN_KINDS} and (search @@ note_query($1) or title ilike '%' || $1 || '%' or body ilike '%' || $1 || '%')
  order by ${OPEN_FIRST}, ts_rank(search, note_query($1)) desc, updated_at desc`;

const FORGET = `delete from notes where id::text = $1 returning id`;

const CHANGE_STATUS = `update notes set status = $2, updated_at = now() where id::text = $1 returning ${COLUMNS}`;

export class PostgresNoteArchive implements NoteArchive {
  constructor(private readonly database: Database) {}

  async remember(newNote: NewNote): Promise<Note> {
    const { kind, project, title, body, keywords, sources } = newNote;
    const values = [kind, initialStatusOf(kind), project, title, body, keywords, sources];
    return noteOf((await this.database.rows<NoteRow>(REMEMBER, values)).at(0), title);
  }

  async recall({ text, projects }: Question): Promise<Note[]> {
    return (await this.database.rows<NoteRow>(RECALL, [projects, text])).map((row) => noteOf(row, row.id));
  }

  async stillOpen(projects: readonly string[]): Promise<Note[]> {
    return (await this.database.rows<NoteRow>(STILL_OPEN, [projects])).map((row) => noteOf(row, row.id));
  }

  async changeStatus({ noteId, status }: StatusChange): Promise<Note> {
    return noteOf((await this.database.rows<NoteRow>(CHANGE_STATUS, [noteId, status])).at(0), noteId);
  }

  async plans(text: string): Promise<Note[]> {
    const wanted = text.trim();
    const rows = wanted === '' ? await this.database.rows<NoteRow>(ALL_PLANS) : await this.database.rows<NoteRow>(MATCHING_PLANS, [wanted]);
    return rows.map((row) => noteOf(row, row.id));
  }

  async forget(noteId: string): Promise<void> {
    if ((await this.database.rows<Row>(FORGET, [noteId])).length === 0) {
      throw new UnknownNoteError(noteId);
    }
  }
}

function noteOf(row: NoteRow | undefined, reference: string): Note {
  if (row === undefined) {
    throw new UnknownNoteError(reference);
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    project: row.project,
    title: row.title,
    body: row.body,
    keywords: row.keywords,
    sources: row.sources,
    createdOn: row.created_at.toISOString(),
    updatedOn: row.updated_at.toISOString(),
  };
}
