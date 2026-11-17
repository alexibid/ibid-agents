import { describe, expect, it } from 'vitest';
import { draftsIn, labelsOf, parsedDraft, parsedLinks, type BacklogItem } from './backlog.js';

const item = (changes: Partial<BacklogItem>): BacklogItem => ({
  key: 'S1',
  kind: 'story',
  title: 'Entrar com Google',
  body: 'Critérios de aceitação',
  size: 'M',
  repository: 'alexibid/services',
  parent: 'Épico',
  issue: '',
  ...changes,
});

const EPIC = item({ key: 'Épico', kind: 'epic', size: 'L', parent: '', repository: 'alexibid/papikapi' });
const draftOf = (...items: BacklogItem[]) => ({ id: 'drive-e-creditos', project: 'papikapi', items: [EPIC, ...items] });

describe('parsedDraft', () => {
  it('should accept an epic with its stories and tasks', () => {
    const parsed = parsedDraft(draftOf(item({}), item({ key: 'T1', kind: 'task', size: 'S', parent: 'S1' })));

    expect(parsed.problems).toEqual([]);
    expect(parsed.value.items).toHaveLength(3);
  });

  it('should refuse a backlog without exactly one epic', () => {
    expect(parsedDraft({ id: 'x', project: 'papikapi', items: [item({ parent: '' })] }).problems).toContain('must have exactly one epic');
  });

  it('should refuse a story of size L', () => {
    expect(parsedDraft(draftOf(item({ size: 'L' }))).problems).toEqual(['"S1" is a story of size L, which must be split']);
  });

  it('should refuse a parent that does not exist and two issues with the same key', () => {
    const parsed = parsedDraft(draftOf(item({ parent: 'S9' }), item({ parent: 'Épico' })));

    expect(parsed.problems).toEqual(['has two issues with the same key', '"S1" has a parent that is not a epic']);
  });

  it('should refuse an issue link that is not a link', () => {
    expect(parsedDraft(draftOf(item({ issue: 'issue 4' }))).problems).toHaveLength(1);
  });
});

describe('parsedLinks', () => {
  const draft = parsedDraft(draftOf(item({}))).value;

  it('should name every key without a link and every link without a key', () => {
    const parsed = parsedLinks(
      [
        { key: 'S1', url: 'https://github.com/alexibid/services/issues/1' },
        { key: 'S7', url: 'https://github.com/a/b/issues/7' },
      ],
      draft,
    );

    expect(parsed.problems).toEqual(['has no link for "Épico"', 'has "S7", which is not in the backlog']);
  });

  it('should refuse a hand-back that is not a list of links', () => {
    expect(parsedLinks(['https://github.com/a/b/issues/1'], draft).problems).toHaveLength(1);
  });
});

describe('draftsIn', () => {
  it('should find the backlog among the results of earlier steps', () => {
    const earlier = { size: { size: 'L' }, 'draft-issues': { backlog: draftOf(item({})), closedIssues: [] } };

    expect(draftsIn(earlier).map((draft) => draft.id)).toEqual(['drive-e-creditos']);
  });
});

describe('labelsOf', () => {
  it('should label each kind with its size', () => {
    expect([labelsOf(EPIC), labelsOf(item({})), labelsOf(item({ kind: 'task', size: 'S' }))]).toEqual([
      ['epic', 'size:L'],
      ['user-story', 'size:M'],
      ['task', 'size:S'],
    ]);
  });
});
