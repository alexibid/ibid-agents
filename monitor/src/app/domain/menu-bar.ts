import { TOOL_NAMES, type Tool } from './prompt';
import type { LimitReading, TimeWindow } from './records';

const TOOLS: readonly Tool[] = ['claude', 'antigravity'];
const WINDOWS: readonly (readonly [TimeWindow, string])[] = [
  ['5h', '5h'],
  ['weekly', 'sem'],
];
const NOTHING_KNOWN = 'ibid';

export function menuBarTextOf(limits: readonly LimitReading[]): string {
  const perTool = TOOLS.flatMap((tool) => {
    const figures = WINDOWS.flatMap(([window, short]) => {
      const used = limits.filter((reading) => reading.tool === tool && reading.window === window).map((reading) => reading.usedPercent);
      return used.length === 0 ? [] : [`${short} ${Math.round(Math.max(...used))}%`];
    });
    return figures.length === 0 ? [] : [`${TOOL_NAMES[tool]} ${figures.join(' ')}`];
  });
  return perTool.length === 0 ? NOTHING_KNOWN : perTool.join(' · ');
}
