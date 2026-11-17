import type { PassedStep, ResultKeeper } from '../agent-runs/result-keeper.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from '../store/database-settings.js';
import type { BacklogArchive } from './backlog-archive.js';
import { draftsIn, parsedDraft, parsedLinks, type BacklogDraft } from './backlog.js';

export class BacklogKeeper implements ResultKeeper {
  constructor(private readonly archive: BacklogArchive) {}

  async keep({ runId, step, handedBack, earlier }: PassedStep): Promise<boolean> {
    const writes = Object.entries(step.fields).flatMap(([field, kind]) => {
      if (kind === 'backlog') {
        return [() => this.archive.keepDraft(runId, parsedDraft(handedBack[field]).value)];
      }
      if (kind === 'published-issues') {
        const draft = draftIn(earlier);
        return [() => this.archive.recordPublished(draft.id, parsedLinks(handedBack[field], draft).value)];
      }
      return [];
    });
    try {
      for (const write of writes) {
        await write();
      }
      return true;
    } catch (error) {
      if (error instanceof DatabaseUnavailableError || error instanceof DatabaseNotInstalledError) {
        return false;
      }
      throw error;
    }
  }
}

function draftIn(earlier: Readonly<Record<string, unknown>>): BacklogDraft {
  const found = draftsIn(earlier).at(0);
  if (found === undefined) {
    throw new Error('No earlier step handed back a backlog to publish.');
  }
  return found;
}
