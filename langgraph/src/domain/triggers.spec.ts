import { describe, expect, it } from 'vitest';
import type { ProjectSheet } from './sheet.js';
import { conditionsOfFiles, matchesPattern } from './triggers.js';

const generalist: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [
    { step: 'implement', when: 'always' },
    { step: 'browser-qa', when: 'ui' },
    { step: 'browser-qa', when: 'behaviour' },
    { step: 'review', when: 'workflows' },
  ],
  commands: {},
};

const figureProject: ProjectSheet = {
  ...generalist,
  triggers: [{ condition: 'figures', patterns: ['.glb', '.blend', 'figures/'] }],
  mandatorySteps: [...generalist.mandatorySteps, { step: 'visual-gate', when: 'figures' }],
};

describe('matchesPattern', () => {
  it('should match a folder pattern as a whole path segment', () => {
    expect(matchesPattern('apps/demo/public/figures/cat.png', 'figures/')).toBe(true);
    expect(matchesPattern('apps/demo/ui/figure-thumbnail/a.ts', 'figures/')).toBe(false);
  });

  it('should match any other pattern as the end of the path', () => {
    expect(matchesPattern('apps/demo/cat.glb', '.glb')).toBe(true);
    expect(matchesPattern('apps/demo/cat.glb.ts', '.glb')).toBe(false);
  });
});

describe('conditionsOfFiles', () => {
  it('should always include the always condition', () => {
    expect(conditionsOfFiles(['apps/demo/src/total.ts'], generalist)).toEqual(['always']);
  });

  it('should detect the general interface and workflow conditions in any project', () => {
    const conditions = conditionsOfFiles(['apps/demo/src/a.html', '.github/workflows/ci.yml'], generalist);

    expect(conditions).toEqual(['always', 'ui', 'workflows']);
  });

  it('should never trigger figures in a project whose sheet has no figure triggers', () => {
    const files = ['apps/demo/src/app/domain/models/cover-motion.model.ts', 'apps/demo/figures/cat.glb'];

    expect(conditionsOfFiles(files, generalist)).toEqual(['always']);
  });

  it('should trigger figures from real figure files in a project that declares them', () => {
    expect(conditionsOfFiles(['apps/demo/figures/cat.glb'], figureProject)).toEqual(['always', 'figures']);
    expect(conditionsOfFiles(['apps/demo/src/cat.blend'], figureProject)).toEqual(['always', 'figures']);
  });

  it('should not treat a code model as a figure even in a project that declares figures', () => {
    expect(conditionsOfFiles(['apps/demo/src/app/domain/models/figure.model.ts'], figureProject)).toEqual(['always']);
  });

  it('should ignore a general condition the sheet gives no step to', () => {
    const noInterface = { ...generalist, mandatorySteps: [{ step: 'implement', when: 'always' }] } as const;

    expect(conditionsOfFiles(['apps/demo/src/a.html'], noInterface)).toEqual(['always']);
  });

  it('should trigger behaviour, not ui, for component code that changes nothing visual', () => {
    const files = ['apps/demo/src/app/ui/pages/admin/admin.facade.ts', 'apps/demo/src/app/app.routes.ts'];

    expect(conditionsOfFiles(files, generalist)).toEqual(['always', 'behaviour']);
  });

  it('should never trigger a screen condition from tests, mocks or stories', () => {
    const files = [
      'apps/demo/src/app/ui/pages/admin/admin.routes.spec.ts',
      'apps/demo/src/mocks/cms-route.mock.ts',
      'apps/demo/src/app/ui/atoms/button/button.stories.ts',
    ];

    expect(conditionsOfFiles(files, generalist)).toEqual(['always']);
  });
});
