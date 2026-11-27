import type { TeamStep } from './project-team.js';
import type { ProjectSheet } from './sheet.js';

export const DISCOVERIES = ['seo', 'aso'] as const;

export type Discovery = (typeof DISCOVERIES)[number];

export type DiscoveryClass = Discovery | 'unclassified';

export const DISCOVERY_FIELD = 'Discovery';

const RULES_FILES: Readonly<Record<Discovery, string>> = {
  seo: 'rules/discovery/seo.md',
  aso: 'rules/discovery/aso.md',
};

const STEPS_THAT_READ_DISCOVERY: ReadonlySet<TeamStep> = new Set(['plan', 'author-tests', 'validate-tests', 'implement', 'review']);

export function isDiscovery(value: string): value is Discovery {
  return DISCOVERIES.some((discovery) => discovery === value);
}

export function discoveryOf(sheet: ProjectSheet): DiscoveryClass {
  return sheet.discovery ?? 'unclassified';
}

export function discoveryRulesFor(step: TeamStep, sheet: ProjectSheet): readonly string[] {
  const discovery = discoveryOf(sheet);
  if (discovery === 'unclassified' || !STEPS_THAT_READ_DISCOVERY.has(step)) {
    return [];
  }
  return [RULES_FILES[discovery]];
}
