import { describe, expect, it } from 'vitest';
import type { RunningProcess, ServerProcesses } from './engine-servers.js';
import { IdleServerSweep, TWO_DAYS_OPEN_ONE_DAY_IDLE, type ServerActivity } from './idle-servers.js';

const NOW = new Date('2026-11-26T12:00:00.000Z');

class FakeProcesses implements ServerProcesses {
  readonly stopped: number[] = [];

  constructor(private readonly processes: readonly RunningProcess[]) {}

  async running(): Promise<readonly RunningProcess[]> {
    return this.processes;
  }

  stop(pid: number): void {
    this.stopped.push(pid);
  }
}

class FakeActivity implements ServerActivity {
  constructor(private readonly recorded: ReadonlyMap<number, string>) {}

  async lastActivityOf(relayPid: number, unrecorded: Date): Promise<Date> {
    const moment = this.recorded.get(relayPid);
    return moment === undefined ? unrecorded : new Date(moment);
  }
}

const relay = (pid: number, startedOn: string): RunningProcess => ({ pid, parent: 1, kind: 'relay', startedOn: new Date(startedOn), folder: '' });
const engine = (pid: number, parent: number, startedOn: string): RunningProcess => ({ pid, parent, kind: 'engine', startedOn: new Date(startedOn), folder: '' });

async function retiredAmong(processes: readonly RunningProcess[], recorded: ReadonlyMap<number, string>): Promise<readonly number[]> {
  const fake = new FakeProcesses(processes);
  await new IdleServerSweep(fake, new FakeActivity(recorded), TWO_DAYS_OPEN_ONE_DAY_IDLE).retire(NOW);
  return fake.stopped;
}

describe('IdleServerSweep', () => {
  it('should stop a server open for more than two days whose client has been silent for more than a day', async () => {
    const stopped = await retiredAmong([relay(10, '2026-11-23T08:00:00.000Z')], new Map([[10, '2026-11-24T08:00:00.000Z']]));

    expect(stopped).toEqual([10]);
  });

  it('should keep a server open for more than two days whose client spoke within the last day', async () => {
    const stopped = await retiredAmong([relay(10, '2026-11-20T08:00:00.000Z')], new Map([[10, '2026-11-26T09:00:00.000Z']]));

    expect(stopped).toEqual([]);
  });

  it('should keep a server open for less than two days even when its client is silent', async () => {
    const stopped = await retiredAmong([relay(10, '2026-11-24T13:00:00.000Z')], new Map([[10, '2026-11-24T13:00:00.000Z']]));

    expect(stopped).toEqual([]);
  });

  it('should keep an old server whose activity was never recorded, as if it were in use now', async () => {
    const stopped = await retiredAmong([relay(10, '2026-11-20T08:00:00.000Z')], new Map());

    expect(stopped).toEqual([]);
  });

  it('should stop only relays, never an engine on its own', async () => {
    const stopped = await retiredAmong(
      [relay(10, '2026-11-20T08:00:00.000Z'), engine(20, 10, '2026-11-20T08:00:00.000Z')],
      new Map([
        [10, '2026-11-21T08:00:00.000Z'],
        [20, '2026-11-21T08:00:00.000Z'],
      ]),
    );

    expect(stopped).toEqual([10]);
  });
});
