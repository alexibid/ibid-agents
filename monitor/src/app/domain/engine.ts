export interface EngineServer {
  readonly pid: number;
  readonly startedOn: string;
  readonly session: string;
  readonly outdated: boolean;
  readonly restartsInPlace: boolean;
}

export interface EngineStatus {
  readonly builtOn: string;
  readonly monitorOutdated: boolean;
  readonly servers: readonly EngineServer[];
}

export interface EngineSummary {
  readonly text: string;
  readonly outdated: number;
  readonly canRestart: boolean;
  readonly oldStyle: number;
}

export const NO_ENGINE: EngineStatus = { builtOn: '', monitorOutdated: false, servers: [] };

export function engineSummaryOf(status: EngineStatus): EngineSummary {
  const outdated = status.servers.filter((server) => server.outdated).length;
  const oldStyle = status.servers.filter((server) => !server.restartsInPlace).length;
  return { text: summaryText(status.servers.length, outdated), outdated, canRestart: outdated > 0, oldStyle };
}

function summaryText(running: number, outdated: number): string {
  if (running === 0) {
    return 'Nenhum servidor ligado';
  }
  const servers = running === 1 ? '1 servidor ligado' : `${running} servidores ligados`;
  if (outdated === 0) {
    return `${servers}, todos atualizados`;
  }
  return `${servers}, ${outdated === 1 ? '1 desatualizado' : `${outdated} desatualizados`}`;
}
