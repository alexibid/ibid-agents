import { describe, expect, it } from 'vitest';
import { engineSummaryOf, NO_ENGINE, type EngineServer } from './engine';

const server = (pid: number, outdated: boolean, restartsInPlace = true): EngineServer => ({
  pid,
  startedOn: '2026-11-19T10:00:00.000Z',
  session: 'ibid-website',
  outdated,
  restartsInPlace,
});

describe('engineSummaryOf', () => {
  it('should say no server is running and offer no restart', () => {
    expect(engineSummaryOf(NO_ENGINE)).toEqual({ text: 'Nenhum servidor ligado', outdated: 0, canRestart: false, oldStyle: 0 });
  });

  it('should count the outdated servers and offer the restart', () => {
    const summary = engineSummaryOf({ ...NO_ENGINE, servers: [server(1, true, false), server(2, false), server(3, true)] });

    expect(summary).toEqual({ text: '3 servidores ligados, 2 desatualizados', outdated: 2, canRestart: true, oldStyle: 1 });
  });

  it('should say when every server runs the latest build', () => {
    expect(engineSummaryOf({ ...NO_ENGINE, servers: [server(1, false)] }).text).toBe('1 servidor ligado, todos atualizados');
  });
});
