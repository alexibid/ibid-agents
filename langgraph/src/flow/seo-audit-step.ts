import type { ChangedFile } from '../checks/workspace-changes.js';
import { auditSeo, type SeoAuditScope } from '../checks/seo/seo-audit.js';
import { failed, passed, type StepResult } from './evidence.js';

export interface SeoAuditOutcome {
  readonly result: StepResult;
  readonly followUps: readonly string[];
}

export async function seoAuditStep(changedFiles: readonly ChangedFile[], scope: SeoAuditScope): Promise<SeoAuditOutcome> {
  try {
    const verdict = await auditSeo(
      changedFiles.map(({ file }) => file),
      scope,
    );
    return verdict.audit.status === 'BLOCK'
      ? { result: failed(verdict.details), followUps: [] }
      : { result: passed(verdict.details), followUps: verdict.followUps };
  } catch (error) {
    return { result: failed([error instanceof Error ? error.message : String(error)]), followUps: [] };
  }
}
