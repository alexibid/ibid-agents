import { isObject, numberIn, objectIn, objectsIn, textIn, type JsonObject } from '../usage/json-reading.js';
import type { TimeWindow, Tool } from '../usage/prompt-record.js';

export interface LimitSample {
  readonly tool: Tool;
  readonly pool: string;
  readonly window: TimeWindow;
  readonly usedPercent: number;
  readonly resetsOn: string;
}

export interface Spending {
  readonly askedOn: Date;
  readonly percent: number;
}

export const ESTIMATE_POOL = 'estimate';

const CLAUDE_POOL = 'all models';
const FIVE_HOURS_MS = 5 * 3_600_000;
const CLAUDE_WINDOWS: readonly (readonly [string, TimeWindow])[] = [
  ['five_hour', '5h'],
  ['seven_day', 'weekly'],
];
const WINDOW_SUFFIX = /-(5h|weekly)$/;

const PRECISION = 10_000;

export function roundedPercent(percent: number): number {
  return Math.round(percent * PRECISION) / PRECISION;
}

export function usedPercentOf(remainingFraction: number): number {
  return roundedPercent((1 - Math.min(Math.max(remainingFraction, 0), 1)) * 100);
}

export function currentWindowOf(spending: readonly Spending[], now: Date): LimitSample[] {
  let opensAt = Number.NEGATIVE_INFINITY;
  let usedPercent = 0;
  for (const { askedOn, percent } of spending) {
    if (askedOn.getTime() >= opensAt + FIVE_HOURS_MS) {
      opensAt = askedOn.getTime();
      usedPercent = 0;
    }
    usedPercent += percent;
  }
  if (now.getTime() >= opensAt + FIVE_HOURS_MS) {
    return [];
  }
  return [
    {
      tool: 'claude',
      pool: ESTIMATE_POOL,
      window: '5h',
      usedPercent: roundedPercent(Math.min(usedPercent, 100)),
      resetsOn: new Date(opensAt + FIVE_HOURS_MS).toISOString(),
    },
  ];
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
      ? [claudeSample(window, reading['used_percentage'], new Date(reading['resets_at'] * 1000))]
      : [];
  });
}

export function samplesOfClaudeUsage(usage: unknown): LimitSample[] {
  const windows = isObject(usage) ? usage : {};
  return CLAUDE_WINDOWS.flatMap(([key, window]) => {
    const reading = objectIn(windows, key);
    const resetsOn = new Date(textIn(reading, 'resets_at'));
    return typeof reading['utilization'] === 'number' && !Number.isNaN(resetsOn.getTime())
      ? [claudeSample(window, reading['utilization'], resetsOn)]
      : [];
  });
}

function claudeSample(window: TimeWindow, usedPercent: number, resetsOn: Date): LimitSample {
  return { tool: 'claude', pool: CLAUDE_POOL, window, usedPercent: roundedPercent(usedPercent), resetsOn: resetsOn.toISOString() };
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
