import { isObject, numberIn, objectIn, objectsIn, textIn, type JsonObject } from '../usage/json-reading.js';
import type { Tool } from '../usage/prompt-record.js';

export type TimeWindow = '5h' | 'weekly';

export interface LimitSample {
  readonly tool: Tool;
  readonly pool: string;
  readonly window: TimeWindow;
  readonly usedPercent: number;
  readonly resetsOn: string;
}

const CLAUDE_POOL = 'all models';
const CLAUDE_WINDOWS: readonly (readonly [string, TimeWindow])[] = [
  ['five_hour', '5h'],
  ['seven_day', 'weekly'],
];
const WINDOW_SUFFIX = /-(5h|weekly)$/;

export function usedPercentOf(remainingFraction: number): number {
  const used = (1 - Math.min(Math.max(remainingFraction, 0), 1)) * 100;
  return Math.round(used * 100) / 100;
}

export function samplesOfAntigravitySummary(summary: unknown): LimitSample[] {
  const response = isObject(summary) ? objectIn(summary, 'response') : {};
  return objectsIn(response, 'groups').flatMap((group) => objectsIn(group, 'buckets').flatMap(sampleOfBucket));
}

export function samplesOfClaudeStatusLine(statusLine: unknown): LimitSample[] {
  const limits = isObject(statusLine) ? objectIn(statusLine, 'rate_limits') : {};
  return CLAUDE_WINDOWS.flatMap(([key, window]) => {
    const reading = objectIn(limits, key);
    return typeof reading['used_percentage'] === 'number' && typeof reading['resets_at'] === 'number'
      ? [
          {
            tool: 'claude' as const,
            pool: CLAUDE_POOL,
            window,
            usedPercent: Math.round(reading['used_percentage'] * 100) / 100,
            resetsOn: new Date(reading['resets_at'] * 1000).toISOString(),
          },
        ]
      : [];
  });
}

function sampleOfBucket(bucket: JsonObject): LimitSample[] {
  const window = textIn(bucket, 'window');
  const resetsOn = textIn(bucket, 'resetTime');
  if ((window !== '5h' && window !== 'weekly') || resetsOn === '' || typeof bucket['remainingFraction'] !== 'number') {
    return [];
  }
  return [
    {
      tool: 'antigravity',
      pool: textIn(bucket, 'bucketId').replace(WINDOW_SUFFIX, ''),
      window,
      usedPercent: usedPercentOf(numberIn(bucket, 'remainingFraction')),
      resetsOn,
    },
  ];
}
