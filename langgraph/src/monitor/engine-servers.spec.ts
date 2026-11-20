import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineServers, type RunningProcess, type ServerProcesses } from './engine-servers.js';

const BUILT_ON = new Date('2026-11-19T11:20:00.373Z');

class FakeProcesses implements ServerProcesses {
  readonly stopped: number[] = [];

  constructor(private processes: RunningProcess[]) {}

  async running(): Promise<readonly RunningProcess[]> {
    return this.processes;
  }

  stop(pid: number): void {
    this.stopped.push(pid);
    this.processes = this.processes.filter((entry) => entry.pid !== pid);
  }
}

const relay = (pid: number, startedOn: string, folder: string): RunningProcess => ({ pid, parent: 1, kind: 'relay', startedOn: new Date(startedOn), folder });
const engine = (pid: number, parent: number, startedOn: string): RunningProcess => ({ pid, parent, kind: 'engine', startedOn: new Date(startedOn), folder: '' });
const clock = (monitorStartedOn: string) => ({ builtOn: async () => BUILT_ON, monitorStartedOn: new Date(monitorStartedOn) });

describe('EngineServers', () => {
  let folder = '';
  let signal = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'engine-servers-'));
    signal = join(folder, 'engine-restart.signal');
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should judge each session by the engine its relay runs, and name the session', async () => {
    const processes = new FakeProcesses([
      relay(10, '2026-11-18T21:48:00.000Z', '/Users/me/Projects/ibid-workspace'),
      engine(20, 10, '2026-11-19T11:25:00.000Z'),
      relay(11, '2026-11-18T21:00:00.000Z', '/'),
    ]);

    const status = await new EngineServers(processes, clock('2026-11-19T11:30:00.000Z'), signal).status();

    expect(status.servers).toEqual([
      { pid: 10, startedOn: '2026-11-19T11:25:00.000Z', session: 'ibid-workspace', outdated: false, restartsInPlace: true },
      { pid: 11, startedOn: '2026-11-18T21:00:00.000Z', session: 'sessão sem pasta', outdated: true, restartsInPlace: false },
    ]);
  });

  it('should signal every relay to restart its engine, and stop only servers that cannot restart in place', async () => {
    const processes = new FakeProcesses([
      relay(10, '2026-11-18T21:48:00.000Z', ''),
      engine(20, 10, '2026-11-18T21:48:00.000Z'),
      relay(11, '2026-11-18T21:00:00.000Z', ''),
    ]);

    await new EngineServers(processes, clock('2026-11-19T11:30:00.000Z'), signal).restartOutdated();

    expect(processes.stopped).toEqual([11]);
    expect(await readFile(signal, 'utf8')).not.toBe('');
  });

  it('should not call an engine outdated for starting in the same second as the build', async () => {
    const processes = new FakeProcesses([relay(10, '2026-11-19T11:00:00.000Z', ''), engine(20, 10, '2026-11-19T11:20:00.000Z')]);

    const status = await new EngineServers(processes, clock('2026-11-19T11:30:00.000Z'), signal).status();

    expect(status.servers[0]?.outdated).toBe(false);
  });

  it('should say when the monitor itself runs code older than the build', async () => {
    const status = await new EngineServers(new FakeProcesses([]), clock('2026-11-19T09:00:00.000Z'), signal).status();

    expect(status.monitorOutdated).toBe(true);
  });
});
