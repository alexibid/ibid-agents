import { z } from 'zod';

export const SEO_SEVERITIES = ['BLOCK', 'WARN', 'INFO'] as const;
export const SEO_CATEGORIES = ['SEO', 'SOCIAL', 'HINTS', 'A11Y', 'CWV'] as const;
export const SEO_STATUSES = ['PASS', 'WARN', 'BLOCK'] as const;

export const SeoIssueSchema = z.object({
  ruleId: z.string().regex(/^SEO\d{2}$/),
  severity: z.enum(SEO_SEVERITIES),
  category: z.enum(SEO_CATEGORIES),
  filePath: z.string().min(1),
  message: z.string().min(1),
  fixHint: z.string().min(1),
});

export const SeoAuditSchema = z.object({
  status: z.enum(SEO_STATUSES),
  checkedUrls: z.array(z.string()),
  issues: z.array(SeoIssueSchema),
});

export type SeoIssue = z.infer<typeof SeoIssueSchema>;
export type SeoAudit = z.infer<typeof SeoAuditSchema>;
export type SeoStatus = SeoAudit['status'];
export type SeoCategory = SeoIssue['category'];

export function statusOf(issues: readonly SeoIssue[]): SeoStatus {
  if (issues.some(({ severity }) => severity === 'BLOCK')) {
    return 'BLOCK';
  }
  return issues.some(({ severity }) => severity === 'WARN') ? 'WARN' : 'PASS';
}

export function auditOf(checkedUrls: readonly string[], issues: readonly SeoIssue[]): SeoAudit {
  return SeoAuditSchema.parse({ status: statusOf(issues), checkedUrls, issues });
}
