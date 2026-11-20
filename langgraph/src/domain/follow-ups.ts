import { z } from 'zod';
import type { StepName } from './steps.js';

const declared = z.object({ followUps: z.array(z.string().min(1)) });
const reviewFindings = z.object({
  findings: z.array(z.object({ rule: z.string(), file: z.string(), description: z.string(), blocking: z.boolean() })),
});
const critiqueFindings = z.object({
  findings: z.array(z.object({ severity: z.enum(['high', 'medium', 'low']), description: z.string() })),
});

export function followUpsIn(step: StepName | 'plan', evidence: unknown): string[] {
  return [...declaredIn(evidence), ...findingsLeftOpen(step, evidence)];
}

export function withoutRepeats(earlier: readonly string[], later: readonly string[]): string[] {
  return [...new Set([...earlier, ...later])];
}

function declaredIn(evidence: unknown): string[] {
  const parsed = declared.safeParse(evidence);
  return parsed.success ? parsed.data.followUps : [];
}

function findingsLeftOpen(step: StepName | 'plan', evidence: unknown): string[] {
  if (step === 'review') {
    const parsed = reviewFindings.safeParse(evidence);
    const open = parsed.success ? parsed.data.findings.filter(({ blocking }) => !blocking) : [];
    return open.map(({ rule, file, description }) => `${rule} in ${file}: ${description}`);
  }
  if (step === 'ux-critique') {
    const parsed = critiqueFindings.safeParse(evidence);
    const open = parsed.success ? parsed.data.findings.filter(({ severity }) => severity !== 'high') : [];
    return open.map(({ severity, description }) => `UX (${severity}): ${description}`);
  }
  return [];
}
