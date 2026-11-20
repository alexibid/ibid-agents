import { changeTrackerOf } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import { buildCoachGraph } from './coach/graph.js';
import { contractsDirectoryPath, readConfiguration } from './configuration.js';
import { buildFlowGraph } from './flow/graph.js';
import { SheetReader } from './sheets/sheet-reader.js';

const { workspaceRoot, projectsDirectory, contractsDirectory } = readConfiguration();

export const graph = buildFlowGraph({
  workspaceRoot,
  sheets: new SheetReader(projectsDirectory),
  contractsDirectory,
  changesOf: changeTrackerOf(workspaceRoot),
  activeStories: NO_OTHER_STORIES,
});
export const coachGraph = buildCoachGraph({ contractsDirectory: contractsDirectoryPath() });
