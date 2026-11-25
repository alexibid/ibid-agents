import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, share } from 'rxjs';
import { MonitorGateway } from '../application/monitor-gateway';
import type { AgentRun, RosterEntry } from '../domain/agent-roster';
import type { Epic } from '../domain/backlog';
import type { BoardEpic } from '../domain/board';
import type { EngineStatus } from '../domain/engine';
import type { CaseReport } from '../domain/evals';
import type { FlowMap, Story } from '../domain/flow-map';
import type { PromptDetail, PromptSummary } from '../domain/prompt';
import type { LimitReading, Note, Problem, Telemetry } from '../domain/records';

const SERVICE = 'http://127.0.0.1:4710/api';
const PROBLEMS_READ = 200;
const RUNS_READ = 200;

@Injectable()
export class HttpMonitorGateway extends MonitorGateway {
  private readonly http = inject(HttpClient);
  private readonly connected = signal(false);

  override readonly online = this.connected.asReadonly();

  override readonly changes$ = new Observable<void>((listener) => {
    const events = new EventSource(`${SERVICE}/events`);
    const announce = () => {
      this.connected.set(true);
      listener.next();
    };
    events.addEventListener('open', announce);
    events.addEventListener('changed', announce);
    events.addEventListener('error', () => this.connected.set(false));
    return () => events.close();
  }).pipe(share());

  override prompts(limit: number): Observable<PromptSummary[]> {
    return this.http.get<PromptSummary[]>(`${SERVICE}/prompts`, { params: { limit } });
  }

  override promptsWithId(promptId: string): Observable<PromptDetail[]> {
    return this.http.get<PromptDetail[]>(`${SERVICE}/prompt`, { params: { id: promptId } });
  }

  override limits(): Observable<LimitReading[]> {
    return this.http.get<LimitReading[]>(`${SERVICE}/limits`);
  }

  override refreshLimits(): Observable<LimitReading[]> {
    return this.http.post<LimitReading[]>(`${SERVICE}/limits/refresh`, null);
  }

  override telemetry(days: number): Observable<Telemetry> {
    return this.http.get<Telemetry>(`${SERVICE}/telemetry`, { params: { days } });
  }

  override problems(): Observable<Problem[]> {
    return this.http.get<Problem[]>(`${SERVICE}/errors`, { params: { limit: PROBLEMS_READ } });
  }

  override plans(text: string): Observable<Note[]> {
    return this.http.get<Note[]>(`${SERVICE}/plans`, { params: { text } });
  }

  override forgetPlan(planId: string): Observable<unknown> {
    return this.http.post(`${SERVICE}/plans/forget`, null, { params: { id: planId } });
  }

  override backlog(): Observable<Epic[]> {
    return this.http.get<Epic[]>(`${SERVICE}/backlog`);
  }

  override board(): Observable<BoardEpic[]> {
    return this.http.get<BoardEpic[]>(`${SERVICE}/board`);
  }

  override flowMap(): Observable<FlowMap> {
    return this.http.get<FlowMap>(`${SERVICE}/flow-map`);
  }

  override stories(limit: number): Observable<Story[]> {
    return this.http.get<Story[]>(`${SERVICE}/stories`, { params: { limit } });
  }

  override agentRoster(): Observable<RosterEntry[]> {
    return this.http.get<RosterEntry[]>(`${SERVICE}/agents`);
  }

  override agentActivity(agent: string): Observable<AgentRun[]> {
    return this.http.get<AgentRun[]>(`${SERVICE}/agent-activity`, { params: { agent, limit: RUNS_READ } });
  }

  override removeSkill(name: string): Observable<unknown> {
    return this.http.post(`${SERVICE}/skills/remove`, null, { params: { name } });
  }

  override runs(agent: string): Observable<Story[]> {
    return this.http.get<Story[]>(`${SERVICE}/runs`, { params: { agent, limit: RUNS_READ } });
  }

  override evals(agent: string): Observable<CaseReport[]> {
    return this.http.get<CaseReport[]>(`${SERVICE}/evals`, { params: { agent } });
  }

  override engine(): Observable<EngineStatus> {
    return this.http.get<EngineStatus>(`${SERVICE}/engine`);
  }

  override restartEngine(): Observable<EngineStatus> {
    return this.http.post<EngineStatus>(`${SERVICE}/engine/restart`, null);
  }
}
