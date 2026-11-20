import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { EngineChild, EngineEvents } from './stdio-relay.js';

export function engineProcess(engineScript: string): (events: EngineEvents) => EngineChild {
  return (events) => {
    const child = spawn(process.execPath, [engineScript], { stdio: ['pipe', 'pipe', 'inherit'], env: process.env });
    createInterface({ input: child.stdout }).on('line', events.line);
    child.on('exit', events.exit);
    return {
      send: (line) => child.stdin.write(`${line}\n`),
      stop: () => child.kill('SIGTERM'),
    };
  };
}
