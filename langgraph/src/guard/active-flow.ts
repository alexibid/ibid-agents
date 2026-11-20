import { join, resolve } from 'node:path';
import { isWorking, latestStoryThreads, latestThreads } from '../store/story-threads.js';

const DEFAULT_STATE_DIRECTORY = resolve(import.meta.dirname, '..', '..', 'state');
const WORKING = 'working';
const WAITING_FOR_APPROVAL = 'branch:to:approval';

export function hasActiveFlow(stateDirectory: string = DEFAULT_STATE_DIRECTORY): boolean {
  return isStoryWorking(join(stateDirectory, 'stories.sqlite')) || isAgentRunWorking(join(stateDirectory, 'agent-runs.sqlite'));
}

function isStoryWorking(file: string): boolean {
  return latestStoryThreads(file).some(isWorking);
}

function isAgentRunWorking(file: string): boolean {
  return latestThreads(file).some(({ values }) => values['status'] === WORKING && !(WAITING_FOR_APPROVAL in values));
}
