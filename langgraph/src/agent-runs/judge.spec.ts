import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FlowStep } from './definition.js';
import { handBackShapeOf, judgeHandBack } from './judge.js';

const step = (fields: FlowStep['fields']): FlowStep => ({
  id: 'deliver',
  name: 'Entregar',
  doneBy: 'job',
  task: 'Deliver.',
  fields,
  calls: [],
});

describe('judgeHandBack', () => {
  it('should pass a hand-back that fills every field', async () => {
    const verdict = await judgeHandBack(step({ summary: 'text', points: 'list', userApproved: 'yes' }), {
      summary: 'done',
      points: ['one'],
      userApproved: true,
    });

    expect(verdict).toEqual({ passed: true, details: [] });
  });

  it('should name every field that is missing or empty', async () => {
    const verdict = await judgeHandBack(step({ summary: 'text', points: 'list', userApproved: 'yes' }), {
      summary: ' ',
      points: [],
      userApproved: 'yes',
    });

    expect(verdict.details).toEqual([
      '"summary" must be a text that is not empty.',
      '"points" must be a list with at least one entry.',
      '"userApproved" must be true, and only after the user said so in their own words.',
    ]);
  });

  it.each([undefined, 'text', 42])('should fail every field when the hand-back is %j', async (handedBack) => {
    expect((await judgeHandBack(step({ summary: 'text', points: 'list' }), handedBack)).details).toHaveLength(2);
  });

  it('should accept a file that exists and refuse one that does not', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'judge-'));
    const real = join(folder, 'cv.html');
    await writeFile(real, '<html></html>');

    expect((await judgeHandBack(step({ file: 'file' }), { file: real })).passed).toBe(true);
    expect((await judgeHandBack(step({ file: 'file' }), { file: join(folder, 'missing.html') })).details[0]).toContain('does not exist');
    expect((await judgeHandBack(step({ files: 'files' }), { files: ['relative/cv.html'] })).details[0]).toContain('not an absolute path');
  });

  it('should accept an empty list of optional links and still check any link given', async () => {
    expect((await judgeHandBack(step({ legalSources: 'optional-urls' }), { legalSources: [] })).passed).toBe(true);
    expect((await judgeHandBack(step({ legalSources: 'optional-urls' }), { legalSources: ['DL 93/2025'] })).details[0]).toContain(
      'not a link',
    );
    expect((await judgeHandBack(step({ legalSources: 'optional-urls' }), {})).details[0]).toContain('empty when there is nothing to cite');
  });

  it('should accept an empty list of optional files and still check any file given', async () => {
    expect((await judgeHandBack(step({ changed: 'optional-files' }), { changed: [] })).passed).toBe(true);
    expect((await judgeHandBack(step({ changed: 'optional-files' }), { changed: ['relative.yml'] })).details[0]).toContain(
      'not an absolute path',
    );
    expect((await judgeHandBack(step({ changed: 'optional-files' }), {})).details[0]).toContain('empty when nothing changed');
  });

  it('should refuse passing runs that are not GitHub Actions run links', async () => {
    expect((await judgeHandBack(step({ greenRuns: 'passing-runs' }), { greenRuns: [] })).details[0]).toContain('run links');
    expect((await judgeHandBack(step({ greenRuns: 'passing-runs' }), { greenRuns: ['https://example.com'] })).details[0]).toContain(
      'not the link of a GitHub Actions run',
    );
  });

  it('should refuse text that is not a web link without opening anything', async () => {
    const verdict = await judgeHandBack(step({ sources: 'urls' }), { sources: ['Bloomberg, yesterday'] });

    expect(verdict.details).toEqual(['"sources" has "Bloomberg, yesterday", which is not a link.']);
  });
});

describe('handBackShapeOf', () => {
  it('should describe the shape the agent must hand back', () => {
    expect(handBackShapeOf(step({ summary: 'text', sources: 'urls', userApproved: 'yes' }))).toBe(
      '{"summary":"<text>","sources":["https://<source that opens>"],"userApproved":true}',
    );
  });

  it('should refuse published issues when no earlier step handed back a backlog', async () => {
    const verdict = await judgeHandBack(step({ issueLinks: 'published-issues' }), { issueLinks: [] }, {});

    expect(verdict.details).toEqual(['"issueLinks" cannot be judged, because no earlier step handed back a backlog.']);
  });

  it('should name the keys of the backlog that have no link', async () => {
    const backlog = {
      id: 'drive',
      project: 'papikapi',
      items: [{ key: 'Épico', kind: 'epic', title: 'Drive', body: 'Texto', size: 'L', repository: 'alexibid/papikapi' }],
    };

    const verdict = await judgeHandBack(
      step({ issueLinks: 'published-issues' }),
      { issueLinks: [{ key: 'S1', url: 'https://github.com/alexibid/papikapi/issues/2' }] },
      { 'draft-issues': { backlog } },
    );

    expect(verdict.details).toEqual(['"issueLinks" has no link for "Épico"; has "S1", which is not in the backlog.']);
  });
});
