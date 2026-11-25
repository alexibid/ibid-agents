import { askAntigravity, isAntigravityRunning } from './antigravity-language-server.js';
import { samplesOfAntigravitySummary, type LimitSample } from './limit-sample.js';

const QUOTA_SUMMARY = 'RetrieveUserQuotaSummary';
const QUOTA_REQUEST = { metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } };

export async function readAntigravityLimits(): Promise<LimitSample[]> {
  if (!(await isAntigravityRunning())) {
    return [];
  }
  return askAntigravity(QUOTA_SUMMARY, QUOTA_REQUEST, samplesWhenAny);
}

function samplesWhenAny(answer: unknown): LimitSample[] | undefined {
  const samples = samplesOfAntigravitySummary(answer);
  return samples.length > 0 ? samples : undefined;
}
