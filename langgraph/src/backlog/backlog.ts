import { z } from 'zod';

export const ITEM_KINDS = ['epic', 'story', 'task'] as const;
export const SIZES = ['S', 'M', 'L'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];
export type Size = (typeof SIZES)[number];

const itemSchema = z.object({
  key: z.string().regex(/^[\p{L}\p{N}-]+$/u),
  kind: z.enum(ITEM_KINDS),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  size: z.enum(SIZES),
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  parent: z.string().default(''),
  issue: z.union([z.literal(''), z.url()]).default(''),
});

const draftSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  project: z.string().trim().min(1),
  items: z.array(itemSchema).min(1),
});

const linkSchema = z.object({ key: z.string().min(1), url: z.url() });

export type BacklogItem = z.infer<typeof itemSchema>;
export type BacklogDraft = z.infer<typeof draftSchema>;
export type IssueLink = z.infer<typeof linkSchema>;

export interface ParsedValue<Shape> {
  readonly value: Shape;
  readonly problems: readonly string[];
}

const ISSUE_TYPES: Readonly<Record<ItemKind, string>> = { epic: 'Feature', story: 'Feature', task: 'Task' };
const KIND_LABELS: Readonly<Record<ItemKind, string>> = { epic: 'epic', story: 'user-story', task: 'task' };
const PARENT_KINDS: Readonly<Record<ItemKind, readonly ItemKind[]>> = { epic: [], story: ['epic'], task: ['story', 'epic'] };
const EMPTY_DRAFT: BacklogDraft = { id: '', project: '', items: [] };
const MIN_STORIES_PER_EPIC = 3;
const STANDING_EPIC = /^Maintenance of /;

export function issueTypeOf(kind: ItemKind): string {
  return ISSUE_TYPES[kind];
}

export function labelsOf(item: Pick<BacklogItem, 'kind' | 'size'>): readonly string[] {
  return [KIND_LABELS[item.kind], `size:${item.size}`];
}

export function parsedDraft(value: unknown): ParsedValue<BacklogDraft> {
  const parsed = draftSchema.safeParse(value);
  if (!parsed.success) {
    return { value: EMPTY_DRAFT, problems: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  }
  return { value: parsed.data, problems: shapeProblemsOf(parsed.data.items) };
}

export function parsedLinks(value: unknown, draft: BacklogDraft): ParsedValue<readonly IssueLink[]> {
  const parsed = z.array(linkSchema).min(1).safeParse(value);
  if (!parsed.success) {
    return { value: [], problems: ['must be a list of { "key", "url" }, one for every issue in the backlog'] };
  }
  const linked = new Set(parsed.data.map((link) => link.key));
  const known = new Set(draft.items.map((item) => item.key));
  const missing = draft.items.filter((item) => !linked.has(item.key)).map((item) => `has no link for "${item.key}"`);
  const unknown = parsed.data.filter((link) => !known.has(link.key)).map((link) => `has "${link.key}", which is not in the backlog`);
  return { value: parsed.data, problems: [...missing, ...unknown] };
}

export function draftsIn(earlier: Readonly<Record<string, unknown>>): readonly BacklogDraft[] {
  return Object.values(earlier)
    .flatMap((result) => (typeof result === 'object' && result !== null ? Object.values(result) : []))
    .map(parsedDraft)
    .filter((parsed) => parsed.problems.length === 0 && parsed.value.items.length > 0)
    .map((parsed) => parsed.value);
}

function shapeProblemsOf(items: readonly BacklogItem[]): string[] {
  const kinds = new Map(items.map((item) => [item.key, item.kind]));
  const epics = items.filter((item) => item.kind === 'epic');
  const problems = epics.length === 1 ? [] : ['must have exactly one epic'];
  if (kinds.size !== items.length) {
    problems.push('has two issues with the same key');
  }
  for (const item of items) {
    problems.push(...itemProblemsOf(item, kinds));
  }
  return problems;
}

export function epicSizeProblems(value: unknown): string[] {
  const { value: draft, problems } = parsedDraft(value);
  const epic = draft.items.find((item) => item.kind === 'epic');
  const stories = draft.items.filter((item) => item.kind === 'story').length;
  const onlyRewordsAnExistingEpic = epic?.issue !== '' && stories === 0;
  if (problems.length > 0 || epic === undefined || STANDING_EPIC.test(epic.title) || onlyRewordsAnExistingEpic || stories >= MIN_STORIES_PER_EPIC) {
    return [];
  }
  return [
    `the epic "${epic.key}" has ${stories} stories; an epic holds at least ${MIN_STORIES_PER_EPIC}, because it is committed as one. Add the new stories to an open epic of the same project or theme, or widen this one`,
  ];
}

function itemProblemsOf(item: BacklogItem, kinds: ReadonlyMap<string, ItemKind>): string[] {
  const parentKind = kinds.get(item.parent);
  const allowed = PARENT_KINDS[item.kind];
  const problems: string[] = [];
  if (allowed.length === 0 ? item.parent !== '' : parentKind === undefined || !allowed.includes(parentKind)) {
    problems.push(`"${item.key}" has a parent that is not ${allowed.length === 0 ? 'empty' : `a ${allowed.join(' or ')}`}`);
  }
  if (item.kind === 'story' && item.size === 'L') {
    problems.push(`"${item.key}" is a story of size L, which must be split`);
  }
  return problems;
}
