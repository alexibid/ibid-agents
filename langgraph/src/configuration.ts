import { join, resolve } from 'node:path';

export interface Configuration {
  readonly workspaceRoot: string;
  readonly projectsDirectory: string;
  readonly contractsDirectory: string;
  readonly stateFile: string;
  readonly coachStateFile: string;
}

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const WORKSPACE_VARIABLE = 'IBID_WORKSPACE_ROOT';

export class MissingWorkspaceError extends Error {
  constructor() {
    super(`Set ${WORKSPACE_VARIABLE} to the absolute path of ibid-workspace.`);
    this.name = 'MissingWorkspaceError';
  }
}

export function contractsDirectoryPath(): string {
  return process.env['IBID_AGENT_CONTRACTS'] ?? join(PACKAGE_ROOT, '..', 'agents');
}

export function storiesStateFile(): string {
  return process.env['IBID_LANGGRAPH_STATE'] ?? join(PACKAGE_ROOT, 'state', 'stories.sqlite');
}

export function workspaceRootBesideAgents(): string {
  return process.env[WORKSPACE_VARIABLE] || resolve(PACKAGE_ROOT, '..', '..', 'ibid-workspace');
}

export function readConfiguration(): Configuration {
  const workspaceRoot = process.env[WORKSPACE_VARIABLE];
  if (workspaceRoot === undefined || workspaceRoot === '') {
    throw new MissingWorkspaceError();
  }
  return {
    workspaceRoot,
    projectsDirectory: process.env['IBID_PROJECT_SHEETS'] ?? join(PACKAGE_ROOT, '..', 'rules', 'projects'),
    contractsDirectory: contractsDirectoryPath(),
    stateFile: storiesStateFile(),
    coachStateFile: process.env['IBID_COACH_STATE'] ?? join(PACKAGE_ROOT, 'state', 'coach.sqlite'),
  };
}
