import { readFile } from 'node:fs/promises';
import type { ProjectSheet } from '../../domain/sheet.js';
import { checkAssetOptimization } from './asset-optimization.js';
import { validateHreflangGraph } from './hreflang-graph.js';
import { inspectMetadata } from './inspect-metadata.js';
import { scopedToStory, seoAuditConfigOf, type SeoAuditConfig } from './seo-audit-config.js';
import { auditOf, type SeoAudit, type SeoIssue } from './seo-audit-contract.js';
import { loadSite } from './seo-site-loader.js';
import { checkSiteFiles, trailingSlashPolicyOf } from './site-files.js';

export interface SeoAuditScope {
  readonly workspaceRoot: string;
  readonly sheet: ProjectSheet;
}

export interface SeoVerdict {
  readonly audit: SeoAudit;
  readonly details: readonly string[];
  readonly followUps: readonly string[];
}

const EXAMPLES_PER_RULE = 5;

export async function auditSeo(changedFiles: readonly string[], { workspaceRoot, sheet }: SeoAuditScope): Promise<SeoVerdict> {
  const config = seoAuditConfigOf(await readFile(sheet.sheetFile, 'utf8'), sheet.sheetFile);
  const audit = await auditSite(config, workspaceRoot, changedFiles);
  return { audit, details: detailsOf(audit), followUps: followUpsOf(audit) };
}

async function auditSite(config: SeoAuditConfig, workspaceRoot: string, changedFiles: readonly string[]): Promise<SeoAudit> {
  const { checkedUrls, pages, templates, site, missing } = await loadSite(config, workspaceRoot);
  const policy = trailingSlashPolicyOf(site.hosting);
  const changedTemplates = templates.filter(({ filePath }) => changedFiles.includes(filePath));
  const issues = [
    ...missing,
    ...pages.flatMap((page) => inspectMetadata(page, policy)),
    ...validateHreflangGraph(pages),
    ...checkAssetOptimization(pages, changedTemplates),
    ...checkSiteFiles(site),
  ];
  return auditOf(checkedUrls, scopedToStory(issues, changedFiles, config));
}

function detailsOf(audit: SeoAudit): string[] {
  const blocking = audit.issues.filter(({ severity }) => severity === 'BLOCK');
  return [`SEO audit ${audit.status}: ${audit.checkedUrls.length} pages checked.`, ...grouped(blocking)];
}

function followUpsOf(audit: SeoAudit): string[] {
  return grouped(audit.issues.filter(({ severity }) => severity === 'WARN'));
}

function grouped(issues: readonly SeoIssue[]): string[] {
  const byRule = new Map<string, SeoIssue[]>();
  for (const issue of issues) {
    const rule = `${issue.severity} ${issue.ruleId} ${issue.category}`;
    byRule.set(rule, [...(byRule.get(rule) ?? []), issue]);
  }
  return [...byRule.entries()].map(([rule, ruleIssues]) => {
    const examples = ruleIssues.slice(0, EXAMPLES_PER_RULE).map(({ filePath, message }) => `${filePath}: ${message}`);
    const more = ruleIssues.length > EXAMPLES_PER_RULE ? ` (and ${ruleIssues.length - EXAMPLES_PER_RULE} more)` : '';
    return `[${rule}] ${examples.join(' | ')}${more} Fix: ${ruleIssues[0]?.fixHint ?? ''}`;
  });
}
