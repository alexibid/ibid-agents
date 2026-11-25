import { describe, expect, it } from 'vitest';
import { boardByProject, issueNumberOf, percentDone, type BoardCard, type BoardEpic } from './board';

const card = (fields: Partial<BoardCard>): BoardCard => ({
  key: 'S1',
  kind: 'story',
  title: 'Open the book',
  size: 'M',
  url: 'https://github.com/demo/site/issues/51',
  state: 'open',
  stage: '',
  tasks: [],
  ...fields,
});

const epic = (id: string, state: BoardCard['state'], done: number, total: number): BoardEpic => ({
  id,
  project: 'site',
  updatedOn: '2026-11-24T10:00:00Z',
  epic: card({ key: 'Epic', kind: 'epic', state }),
  done,
  total,
  stories: [],
});

describe('boardByProject', () => {
  const site = (id: string, state: BoardCard['state'], stories: BoardCard[] = []): BoardEpic => ({ ...epic(id, state, 0, 1), stories });
  const workspace: BoardEpic = { ...epic('deps', 'open', 0, 1), project: 'workspace' };
  const board = [site('layout', 'open', [card({ key: 'S1' }), card({ key: 'S2', state: 'closed' })]), site('done', 'closed'), workspace];

  it('should show only open work by default, grouped by project', () => {
    const shown = boardByProject(board, { open: true, closed: false });

    expect(shown.map(({ project, epics }) => ({ project, epics: epics.map(({ id }) => id) }))).toEqual([
      { project: 'site', epics: ['layout'] },
      { project: 'workspace', epics: ['deps'] },
    ]);
    expect(shown[0]?.epics[0]?.stories.map(({ key }) => key)).toEqual(['S1']);
  });

  it('should show only closed work when only the closed chip is on', () => {
    const shown = boardByProject(board, { open: false, closed: true });

    expect(shown.flatMap(({ epics }) => epics.map(({ id }) => id))).toEqual(['done']);
  });
});

describe('percentDone', () => {
  it('should say how much of the epic is done, and zero for an empty one', () => {
    expect(percentDone(epic('open', 'open', 1, 3))).toBe(33);
    expect(percentDone(epic('empty', 'open', 0, 0))).toBe(0);
  });
});

describe('issueNumberOf', () => {
  it('should read the issue number from its link, and nothing for a draft', () => {
    expect(issueNumberOf(card({}))).toBe('51');
    expect(issueNumberOf(card({ url: '' }))).toBe('');
  });
});
