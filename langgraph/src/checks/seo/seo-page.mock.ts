import { readHtml } from './html-tags.js';
import { completePageHtml, type MockHead } from './seo-pages.mock.js';
import type { SeoPage } from './seo-rules.js';
import type { SeoIssue } from './seo-audit-contract.js';

export function mockPage(head: MockHead, extraHead = ''): SeoPage {
  return { route: head.path, filePath: `dist/site/browser${head.path}/index.html`, document: readHtml(completePageHtml(head, extraHead)) };
}

export function rulesFound(issues: readonly SeoIssue[]): string[] {
  return issues.map(({ ruleId, severity }) => `${severity} ${ruleId}`);
}
