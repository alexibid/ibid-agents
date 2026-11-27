import type { ProjectSheet } from '../domain/sheet.js';
import { EMPTY_PLAN, NO_ORIGIN, type FlowStateValue } from './state.js';

const websiteSheet: ProjectSheet = {
  project: 'site',
  path: 'apps/site',
  commitScope: 'site',
  sheetFile: '/repo/rules/projects/site.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [{ step: 'implement', when: 'always' }],
  commands: {},
  discovery: 'seo',
};

export const unclassifiedSheet: ProjectSheet = {
  project: 'tool',
  path: 'apps/tool',
  commitScope: 'tool',
  sheetFile: '/repo/rules/projects/tool.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [{ step: 'implement', when: 'always' }],
  commands: {},
};

export function storyState(sheet: ProjectSheet = websiteSheet): FlowStateValue {
  return {
    story: { project: sheet.project, title: 'Translated pages', criteria: ['Every page lists its translations'] },
    origin: NO_ORIGIN,
    epicMembers: [],
    commitRequested: false,
    commitConfirmed: undefined,
    lastPasses: {},
    sheet,
    baseline: {},
    implementBaseline: undefined,
    contractsDirectory: '/repo/agents',
    plan: EMPTY_PLAN,
    testFiles: [],
    queue: ['implement'],
    position: 0,
    attempts: {},
    followUps: [],
    status: 'working',
    history: [],
  };
}

export const appState = (): FlowStateValue => storyState({ ...websiteSheet, project: 'phone', discovery: 'aso' });
