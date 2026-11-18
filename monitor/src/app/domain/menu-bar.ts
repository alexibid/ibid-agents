import { TOOL_NAMES, type Tool } from './prompt';
import type { LimitReading, TimeWindow } from './records';

const TOOLS: readonly Tool[] = ['claude', 'antigravity'];
const WINDOWS: readonly (readonly [TimeWindow, string])[] = [
  ['5h', '5h'],
  ['weekly', 'sem'],
];
const NOTHING_KNOWN = 'ibid';

const PERCENT = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });

function percentText(percent: number): string {
  return `${PERCENT.format(percent)}%`;
}

export function menuBarTextOf(limits: readonly LimitReading[]): string {
  const perTool = TOOLS.flatMap((tool) => {
    const figures = WINDOWS.flatMap(([window, short]) => {
      const used = limits.filter((reading) => reading.tool === tool && reading.window === window).map((reading) => reading.usedPercent);
      return used.length === 0 ? [] : [`${short} ${percentText(Math.max(...used))}`];
    });
    return figures.length === 0 ? [] : [`${TOOL_NAMES[tool]} ${figures.join(' ')}`];
  });
  return perTool.length === 0 ? NOTHING_KNOWN : perTool.join(' · ');
}
