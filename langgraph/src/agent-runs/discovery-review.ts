import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { parsedDraft, type BacklogDraft } from '../backlog/backlog.js';
import { discoveryOf, type DiscoveryClass } from '../domain/discovery.js';
import { codeSpans, rowsUnderHeading } from '../sheets/markdown-tables.js';
import { SheetReader } from '../sheets/sheet-reader.js';

export const RULES_DIRECTORY = resolve(import.meta.dirname, '..', '..', '..', 'rules');

const entrySchema = z.object({
  project: z.string().trim().min(1),
  discovery: z.enum(['seo', 'aso', 'unclassified']),
  rules: z.array(z.string().trim().min(1)).default([]),
  reason: z.string().trim().min(1),
});

const reviewSchema = z.array(entrySchema).min(1);

type ReviewEntry = z.infer<typeof entrySchema>;

const RULE_ID: Readonly<Record<'seo' | 'aso', RegExp>> = { seo: /^SEO\d{2}$/, aso: /^ASO\d{2}$/ };
const OK = '';

export const DISCOVERY_REVIEW_EXAMPLE = [
  { project: '<project>', discovery: 'seo | aso | unclassified', rules: ['<rule id the work touches>'], reason: '<why>' },
];

export async function discoveryReviewProblem(value: unknown, rulesDirectory: string = RULES_DIRECTORY): Promise<string> {
  const parsed = reviewSchema.safeParse(value);
  if (!parsed.success) {
    return 'must list, for every project the request touches, { "project", "discovery", "rules", "reason" }';
  }
  const problems = await Promise.all(parsed.data.map((entry) => entryProblem(entry, rulesDirectory)));
  return problems.filter((problem) => problem !== OK).join('; ');
}

export function uncoveredRulesProblem(value: unknown, earlier: Readonly<Record<string, unknown>>): string {
  const { value: draft, problems } = parsedDraft(value);
  if (problems.length > 0) {
    return OK;
  }
  const uncovered = reviewsIn(earlier)
    .filter((entry) => entry.project === draft.project)
    .flatMap((entry) => entry.rules.filter((rule) => !coveredBy(rule, draft)));
  return uncovered.length === 0
    ? OK
    : `names no story whose acceptance criteria cover ${uncovered.join(', ')}, which the size step said the work touches`;
}

async function entryProblem(entry: ReviewEntry, rulesDirectory: string): Promise<string> {
  const actual = await classificationOf(entry.project, rulesDirectory);
  if (actual !== entry.discovery) {
    return `"${entry.project}" is "${actual}" in its project sheet, not "${entry.discovery}"`;
  }
  if (actual === 'unclassified') {
    return entry.rules.length === 0 ? OK : `"${entry.project}" has no Discovery in its sheet, so it takes no SEO or ASO rule; ask the user instead of guessing`;
  }
  const known = await ruleIdsOf(actual, rulesDirectory);
  const unknown = entry.rules.filter((rule) => !known.has(rule));
  return unknown.length === 0 ? OK : `${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not in rules/discovery/${actual}.md`;
}

async function classificationOf(project: string, rulesDirectory: string): Promise<DiscoveryClass> {
  try {
    return discoveryOf(await new SheetReader(join(rulesDirectory, 'projects')).read(project));
  } catch {
    return 'unclassified';
  }
}

async function ruleIdsOf(discovery: 'seo' | 'aso', rulesDirectory: string): Promise<ReadonlySet<string>> {
  const markdown = await readFile(join(rulesDirectory, 'discovery', `${discovery}.md`), 'utf8').catch(() => '');
  const ids = rowsUnderHeading(markdown, 'Rules').map(([id]) => codeSpans(id ?? '')[0] ?? id ?? '');
  return new Set(ids.filter((id) => RULE_ID[discovery].test(id)));
}

function reviewsIn(earlier: Readonly<Record<string, unknown>>): ReviewEntry[] {
  return Object.values(earlier)
    .flatMap((result) => (typeof result === 'object' && result !== null ? Object.values(result) : []))
    .flatMap((field) => {
      const parsed = reviewSchema.safeParse(field);
      return parsed.success ? parsed.data : [];
    });
}

function coveredBy(rule: string, draft: BacklogDraft): boolean {
  return draft.items.some((item) => item.kind === 'story' && new RegExp(`\\b${rule}\\b`).test(item.body));
}
