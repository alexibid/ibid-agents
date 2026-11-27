import { describe, expect, it } from 'vitest';
import { filterOutline, issueNameOf, outlineOf, type BacklogItem, type Epic } from './backlog';

const item = (changes: Partial<BacklogItem>): BacklogItem => ({
  key: 'S1',
  kind: 'story',
  title: 'Entrar com Google',
  body: 'Critérios',
  size: 'M',
  repository: 'alexibid/services',
  parent: 'Épico',
  issueType: 'Feature',
  labels: ['user-story', 'size:M'],
  issueUrl: '',
  state: 'draft',
  ...changes,
});

const epicOf = (...items: BacklogItem[]): Epic => ({
  id: 'drive-e-creditos',
  project: 'papikapi',
  title: 'Drive e créditos',
  runId: 'project-manager~1',
  updatedOn: '2026-11-17T10:00:00Z',
  items,
});

const HEAD = item({ key: 'Épico', kind: 'epic', parent: '', state: 'published', issueUrl: 'https://github.com/alexibid/papikapi/issues/1' });

describe('outlineOf', () => {
  it('should put each task under its story and count what is published', () => {
    const outline = outlineOf(
      epicOf(HEAD, item({ key: 'D0', kind: 'task' }), item({}), item({ key: 'T1', kind: 'task', parent: 'S1' }), item({ key: 'S2' })),
    );

    expect(outline.head.key).toBe('Épico');
    expect(outline.epicTasks.map((task) => task.key)).toEqual(['D0']);
    expect(outline.stories.map(({ story, tasks }) => [story.key, tasks.map((task) => task.key)])).toEqual([
      ['S1', ['T1']],
      ['S2', []],
    ]);
    expect([outline.published, outline.total]).toEqual([1, 5]);
  });

  it('should refuse an epic without issues', () => {
    expect(() => outlineOf(epicOf())).toThrow('has no issues');
  });
});

describe('issueNameOf', () => {
  it('should name a published issue by repository and number, and a draft by repository only', () => {
    expect([issueNameOf(HEAD), issueNameOf(item({}))]).toEqual(['papikapi#1', 'services']);
  });
});

describe('filterOutline', () => {
  const fullOutline = () =>
    outlineOf(
      epicOf(
        item({ key: 'Épico', kind: 'epic', title: 'Drive e créditos', body: 'Sincronização', parent: '' }),
        item({ key: 'D0', kind: 'task', title: 'Desenho', parent: 'Épico' }),
        item({ key: 'S1', title: 'Entrar com Google', body: 'Autenticação OAuth' }),
        item({ key: 'T1', kind: 'task', title: 'Configurar cliente', parent: 'S1' }),
        item({ key: 'S2', title: 'Comprar créditos', body: 'Pagamento Stripe' }),
      ),
    );

  it('should return the full outline when the query is empty or whitespace', () => {
    const outline = fullOutline();
    expect(filterOutline(outline, '')).toBe(outline);
    expect(filterOutline(outline, '   ')).toBe(outline);
  });

  it('should return the full outline when the epic title or body matches case-insensitively', () => {
    const outline = fullOutline();
    expect(filterOutline(outline, 'DRIVE')).toBe(outline);
    expect(filterOutline(outline, 'sincronização')).toBe(outline);
  });

  it('should keep only matching stories when the epic does not match directly', () => {
    const filtered = filterOutline(fullOutline(), 'oauth');
    expect(filtered?.epicTasks).toEqual([]);
    expect(filtered?.stories.map((branch) => branch.story.key)).toEqual(['S1']);
    expect(filtered?.stories[0]?.tasks.map((task) => task.key)).toEqual(['T1']);
  });

  it('should return null when neither the epic nor any story matches', () => {
    expect(filterOutline(fullOutline(), 'inexistente')).toBeNull();
  });
});
