export interface EngineChild {
  send(line: string): void;
  stop(): void;
}

export interface EngineEvents {
  readonly line: (line: string) => void;
  readonly exit: () => void;
}

export type EngineLauncher = (events: EngineEvents) => EngineChild;

export interface ClientLink {
  send(line: string): void;
}

type Message = Readonly<Record<string, unknown>>;
type Phase = 'running' | 'replaying' | 'stopping' | 'closed';

const REPLAY_ID = 'relay-initialize';
const RESTARTED = 'The flow engine restarted while this call ran. Call it again.';
const INTERNAL_ERROR = -32603;
const TOOLS_CHANGED = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });

export class StdioRelay {
  private child: EngineChild;
  private phase: Phase = 'running';
  private initialize: Message | undefined;
  private initialized: string | undefined;
  private restartWanted = false;
  private readonly pending = new Set<string>();
  private readonly waiting: string[] = [];

  constructor(
    private readonly launch: EngineLauncher,
    private readonly client: ClientLink,
    private readonly afterCrash: (relaunch: () => void) => void,
  ) {
    this.child = this.started();
  }

  fromClient(line: string): void {
    const message = parsed(line);
    if (message?.['method'] === 'initialize') {
      this.initialize = message;
    } else if (message?.['method'] === 'notifications/initialized') {
      this.initialized = line;
    }
    if (this.phase !== 'running') {
      this.waiting.push(line);
      return;
    }
    if (message !== undefined && 'method' in message && 'id' in message) {
      this.pending.add(keyOf(message['id']));
    }
    this.child.send(line);
  }

  restart(): void {
    if (this.phase !== 'running') {
      return;
    }
    this.restartWanted = true;
    if (this.pending.size === 0) {
      this.replaceEngine();
    }
  }

  shutDown(): void {
    this.phase = 'closed';
    this.child.stop();
  }

  private started(): EngineChild {
    return this.launch({ line: (line) => this.fromEngine(line), exit: () => this.engineExited() });
  }

  private fromEngine(line: string): void {
    const message = parsed(line);
    if (this.phase === 'replaying' && message?.['id'] === REPLAY_ID) {
      this.finishReplay();
      return;
    }
    if (message !== undefined && !('method' in message) && 'id' in message) {
      this.pending.delete(keyOf(message['id']));
    }
    this.client.send(line);
    if (this.restartWanted && this.pending.size === 0) {
      this.replaceEngine();
    }
  }

  private replaceEngine(): void {
    this.restartWanted = false;
    this.phase = 'stopping';
    this.child.stop();
  }

  private engineExited(): void {
    if (this.phase === 'closed') {
      return;
    }
    this.answerPendingWithRestart();
    if (this.phase === 'stopping') {
      this.relaunch();
      return;
    }
    this.phase = 'stopping';
    this.afterCrash(() => this.relaunch());
  }

  private relaunch(): void {
    this.child = this.started();
    if (this.initialize === undefined) {
      this.phase = 'running';
      this.flushWaiting();
      return;
    }
    this.phase = 'replaying';
    this.child.send(JSON.stringify({ ...this.initialize, id: REPLAY_ID }));
  }

  private finishReplay(): void {
    if (this.initialized !== undefined) {
      this.child.send(this.initialized);
    }
    this.phase = 'running';
    this.client.send(TOOLS_CHANGED);
    this.flushWaiting();
  }

  private flushWaiting(): void {
    this.waiting.splice(0).forEach((line) => this.fromClient(line));
  }

  private answerPendingWithRestart(): void {
    for (const id of this.pending) {
      this.client.send(JSON.stringify({ jsonrpc: '2.0', id: JSON.parse(id), error: { code: INTERNAL_ERROR, message: RESTARTED } }));
    }
    this.pending.clear();
  }
}

function parsed(line: string): Message | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Message) : undefined;
  } catch {
    return undefined;
  }
}

function keyOf(id: unknown): string {
  return JSON.stringify(id);
}
