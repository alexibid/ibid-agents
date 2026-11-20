import { describe, expect, it } from 'vitest';
import { StdioRelay, type EngineChild, type EngineEvents } from './stdio-relay.js';

class FakeEngine implements EngineChild {
  readonly received: string[] = [];
  stopped = false;

  constructor(readonly events: EngineEvents) {}

  send(line: string): void {
    this.received.push(line);
  }

  stop(): void {
    this.stopped = true;
    this.events.exit();
  }

  answer(message: object): void {
    this.events.line(JSON.stringify(message));
  }
}

function relayed() {
  const engines: FakeEngine[] = [];
  const toClient: string[] = [];
  const crashes: (() => void)[] = [];
  const relay = new StdioRelay(
    (events) => {
      const engine = new FakeEngine(events);
      engines.push(engine);
      return engine;
    },
    { send: (line) => toClient.push(line) },
    (relaunch) => crashes.push(relaunch),
  );
  return { relay, engines, toClient, crashes };
}

const INITIALIZE = JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
const INITIALIZED = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
const call = (id: number) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'story_status' } });

function connected() {
  const parts = relayed();
  parts.relay.fromClient(INITIALIZE);
  parts.engines[0]?.answer({ jsonrpc: '2.0', id: 0, result: {} });
  parts.relay.fromClient(INITIALIZED);
  return parts;
}

describe('StdioRelay', () => {
  it('should start a new engine and replay the handshake without the session noticing', () => {
    const { relay, engines, toClient } = connected();

    relay.restart();
    engines[1]?.answer({ jsonrpc: '2.0', id: 'relay-initialize', result: {} });

    expect(engines[0]?.stopped).toBe(true);
    expect(JSON.parse(engines[1]?.received[0] ?? '{}')).toMatchObject({ method: 'initialize', id: 'relay-initialize' });
    expect(engines[1]?.received[1]).toBe(INITIALIZED);
    expect(toClient.filter((line) => line.includes('relay-initialize'))).toEqual([]);
    expect(toClient.at(-1)).toContain('notifications/tools/list_changed');
  });

  it('should wait for a call in progress before restarting', () => {
    const { relay, engines, toClient } = connected();
    relay.fromClient(call(7));

    relay.restart();
    expect(engines[0]?.stopped).toBe(false);

    engines[0]?.answer({ jsonrpc: '2.0', id: 7, result: { content: [] } });
    expect(toClient.some((line) => JSON.parse(line).id === 7)).toBe(true);
    expect(engines[0]?.stopped).toBe(true);
  });

  it('should hold calls made during the restart and hand them to the new engine', () => {
    const { relay, engines } = connected();
    relay.restart();

    relay.fromClient(call(8));
    expect(engines[1]?.received.some((line) => line.includes('"id":8'))).toBe(false);

    engines[1]?.answer({ jsonrpc: '2.0', id: 'relay-initialize', result: {} });
    expect(engines[1]?.received.at(-1)).toBe(call(8));
  });

  it('should answer a call lost in a crash and start the engine again after the pause', () => {
    const { relay, engines, toClient, crashes } = connected();
    relay.fromClient(call(9));

    engines[0]?.events.exit();

    expect(JSON.parse(toClient.at(-1) ?? '{}')).toMatchObject({ id: 9, error: { code: -32603 } });
    expect(engines).toHaveLength(1);
    crashes[0]?.();
    expect(engines).toHaveLength(2);
  });

  it('should not start another engine once the session has gone', () => {
    const { relay, engines } = connected();

    relay.shutDown();

    expect(engines).toHaveLength(1);
  });
});
