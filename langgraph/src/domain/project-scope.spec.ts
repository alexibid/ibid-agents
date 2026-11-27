import { describe, expect, it } from 'vitest';
import { affectsProject } from './project-scope.js';
import type { ProjectSheet } from './sheet.js';

const sheetOf = (path: string, reuses: readonly string[] = []): ProjectSheet => ({
  project: 'demo',
  path,
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses,
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [],
  commands: {},
});

describe('affectsProject', () => {
  it('should include files inside the app, shared libraries, and workspace root while ignoring sibling apps and outside repos', () => {
    const website = sheetOf('apps/ibid-website');

    expect(affectsProject('apps/ibid-website/src/styles/components/_book-base.scss', website, [])).toBe(true);
    expect(affectsProject('firebase.json', website, [])).toBe(true);
    expect(affectsProject('libs/utils/src/index.ts', website, [])).toBe(true);
    expect(affectsProject('apps/oh-save-me/src/app/app.ts', website, [])).toBe(false);
    expect(affectsProject('../ibid-agents/langgraph/src/server.ts', website, [])).toBe(false);
  });

  it('should always keep files explicitly owned by the story or epic', () => {
    const website = sheetOf('apps/ibid-website');

    expect(affectsProject('../ibid-agents/rules/projects/ibid-website.md', website, ['../ibid-agents/rules/projects/ibid-website.md'])).toBe(true);
  });

  it('should scope outside-workspace projects to their own folder', () => {
    const agents = sheetOf('../ibid-agents');

    expect(affectsProject('../ibid-agents/langgraph/src/flow/graph.ts', agents, [])).toBe(true);
    expect(affectsProject('apps/ibid-website/src/app/app.ts', agents, [])).toBe(false);
  });

  it('should scope library projects to themselves, utils, reused libs, and root configs', () => {
    const ui = sheetOf('libs/ibid-ui', ['ibid-ui']);

    expect(affectsProject('libs/ibid-ui/src/lib/chip.ts', ui, [])).toBe(true);
    expect(affectsProject('libs/utils/src/date.ts', ui, [])).toBe(true);
    expect(affectsProject('libs/services/src/auth.ts', ui, [])).toBe(false);
    expect(affectsProject('apps/papikapi/src/app/app.ts', ui, [])).toBe(false);
    expect(affectsProject('package.json', ui, [])).toBe(true);
  });
});
