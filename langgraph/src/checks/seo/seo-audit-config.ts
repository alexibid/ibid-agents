import { SheetError } from '../../domain/sheet.js';
import { matchesPattern } from '../../domain/triggers.js';
import { codeSpans, rowsUnderHeading } from '../../sheets/markdown-tables.js';
import type { SeoIssue } from './seo-audit-contract.js';

export const SEO_AUDIT_HEADING = 'SEO audit';

export interface SeoAuditConfig {
  readonly pages: string;
  readonly routes: string;
  readonly hosting: string;
  readonly templates: string;
  readonly pageSources: readonly string[];
}

const DEBT_LEAD = 'Existing debt this story does not touch: ';

export function seoAuditConfigOf(markdown: string, sheetFile: string): SeoAuditConfig {
  const fields = new Map(
    rowsUnderHeading(markdown, SEO_AUDIT_HEADING).map(([name, value]) => [codeSpans(name ?? '')[0] ?? '', codeSpans(value ?? '')]),
  );
  const single = (name: string): string => {
    const value = fields.get(name)?.[0];
    if (value === undefined) {
      throw new SheetError(sheetFile, `the "${SEO_AUDIT_HEADING}" table has no \`${name}\``);
    }
    return value;
  };
  return {
    pages: single('pages'),
    routes: single('routes'),
    hosting: single('hosting'),
    templates: single('templates'),
    pageSources: fields.get('page sources') ?? [],
  };
}

export function scopedToStory(issues: readonly SeoIssue[], changedFiles: readonly string[], config: SeoAuditConfig): SeoIssue[] {
  const changed = new Set(changedFiles);
  const pagesTouched = changedFiles.some((file) => config.pageSources.some((pattern) => matchesPattern(file, pattern)));
  return issues.map((issue) => {
    const touched = isBuiltOrHosting(issue.filePath, config) ? pagesTouched || changed.has(issue.filePath) : changed.has(issue.filePath);
    return issue.severity !== 'BLOCK' || touched ? issue : { ...issue, severity: 'WARN', message: `${DEBT_LEAD}${issue.message}` };
  });
}

function isBuiltOrHosting(filePath: string, config: SeoAuditConfig): boolean {
  return filePath === config.hosting || filePath === config.pages || filePath.startsWith(`${config.pages}/`);
}
