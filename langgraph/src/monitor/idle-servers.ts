import type { RunningProcess, ServerProcesses } from './engine-servers.js';

export interface ServerActivity {
  lastActivityOf(relayPid: number, unrecorded: Date): Promise<Date>;
}

export interface IdleLimits {
  readonly openForMs: number;
  readonly idleForMs: number;
}

const HOUR_MS = 3_600_000;

export const TWO_DAYS_OPEN_ONE_DAY_IDLE: IdleLimits = { openForMs: 48 * HOUR_MS, idleForMs: 24 * HOUR_MS };

export class IdleServerSweep {
  constructor(
    private readonly processes: ServerProcesses,
    private readonly activity: ServerActivity,
    private readonly limits: IdleLimits,
  ) {}

  async retire(now: Date): Promise<readonly number[]> {
    const relays = (await this.processes.running()).filter(({ kind }) => kind === 'relay');
    const idle = await Promise.all(relays.map(async (relay) => ((await this.isIdle(relay, now)) ? [relay.pid] : [])));
    const retired = idle.flat();
    retired.forEach((pid) => this.processes.stop(pid));
    return retired;
  }

  private async isIdle(relay: RunningProcess, now: Date): Promise<boolean> {
    if (now.getTime() - relay.startedOn.getTime() <= this.limits.openForMs) {
      return false;
    }
    const lastActivity = await this.activity.lastActivityOf(relay.pid, now);
    return now.getTime() - lastActivity.getTime() > this.limits.idleForMs;
  }
}
