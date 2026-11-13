import type { ServerResponse } from 'node:http';

const KEEP_ALIVE_MS = 25_000;

export class ChangeFeed {
  readonly #listeners = new Set<ServerResponse>();

  constructor() {
    setInterval(() => this.#send(': still here\n\n'), KEEP_ALIVE_MS).unref();
  }

  follow(response: ServerResponse): void {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write('retry: 3000\n\n');
    this.#listeners.add(response);
    response.on('close', () => this.#listeners.delete(response));
  }

  announce(): void {
    this.#send(`event: changed\ndata: ${Date.now()}\n\n`);
  }

  #send(message: string): void {
    for (const listener of this.#listeners) {
      listener.write(message);
    }
  }
}
