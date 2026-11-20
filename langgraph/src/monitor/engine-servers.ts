import { utimes, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { EngineClock } from './engine-clock.js';

export type ProcessKind = 'relay' | 'engine';

export interface RunningProcess {
  readonly pid: number;
  readonly parent: number;
  readonly kind: ProcessKind;
  readonly startedOn: Date;
  readonly folder: string;
}

export interface ServerProcesses {
  running(): Promise<readonly RunningProcess[]>;
  stop(pid: number): void;
}

export interface ServerState {
  readonly pid: number;
  readonly startedOn: string;
  readonly session: string;
  readonly outdated: boolean;
  readonly restartsInPlace: boolean;
}

export interface EngineStatus {
  readonly builtOn: string;
  readonly monitorOutdated: boolean;
  readonly servers: readonly ServerState[];
}

const SECOND_MS = 1000;
const NO_FOLDER = 'sessão sem pasta';

export class EngineServers {
  constructor(
    private readonly processes: ServerProcesses,
    private readonly clock: EngineClock,
    private readonly signalFile: string,
  ) {}

  async status(): Promise<EngineStatus> {
    const builtOn = await this.clock.builtOn();
    const running = await this.processes.running();
    const relays = running.filter(({ kind }) => kind === 'relay');
    return {
      builtOn: builtOn.toISOString(),
      monitorOutdated: this.clock.monitorStartedOn < builtOn,
      servers: relays.map((relay) => stateOf(relay, running.find(({ parent }) => parent === relay.pid), builtOn)),
    };
  }

  async restartOutdated(): Promise<EngineStatus> {
    const servers = (await this.status()).servers;
    await touch(this.signalFile);
    servers.filter(({ restartsInPlace }) => !restartsInPlace).forEach(({ pid }) => this.processes.stop(pid));
    return this.status();
  }
}

function stateOf(relay: RunningProcess, engine: RunningProcess | undefined, builtOn: Date): ServerState {
  const running = engine ?? relay;
  return {
    pid: relay.pid,
    startedOn: running.startedOn.toISOString(),
    session: basename(relay.folder) || NO_FOLDER,
    outdated: running.startedOn.getTime() < wholeSecondOf(builtOn),
    restartsInPlace: engine !== undefined,
  };
}

function wholeSecondOf(moment: Date): number {
  return Math.floor(moment.getTime() / SECOND_MS) * SECOND_MS;
}

async function touch(file: string): Promise<void> {
  const now = new Date();
  await writeFile(file, now.toISOString());
  await utimes(file, now, now);
}
