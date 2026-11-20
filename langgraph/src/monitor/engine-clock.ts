import { stat } from 'node:fs/promises';

export interface EngineClock {
  readonly builtOn: () => Promise<Date>;
  readonly monitorStartedOn: Date;
}

export function fileClock(engineScript: string, monitorStartedOn: Date): EngineClock {
  return { builtOn: async () => (await stat(engineScript)).mtime, monitorStartedOn };
}
