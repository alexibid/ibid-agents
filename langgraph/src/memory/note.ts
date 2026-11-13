export const NOTE_KINDS = ['idea', 'plan', 'decision', 'research'] as const;
export const NOTE_STATUSES = ['open', 'done', 'dropped'] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export interface NewNote {
  readonly kind: NoteKind;
  readonly project: string;
  readonly title: string;
  readonly body: string;
  readonly keywords: readonly string[];
  readonly sources: readonly string[];
}

export interface Note extends NewNote {
  readonly id: string;
  readonly status: NoteStatus;
  readonly createdOn: string;
  readonly updatedOn: string;
}

export interface Question {
  readonly text: string;
  readonly projects: readonly string[];
}

export interface StatusChange {
  readonly noteId: string;
  readonly status: NoteStatus;
}

const KINDS_STILL_TO_ACT_ON: readonly NoteKind[] = ['idea', 'plan'];

export function initialStatusOf(kind: NoteKind): NoteStatus {
  return KINDS_STILL_TO_ACT_ON.includes(kind) ? 'open' : 'done';
}
