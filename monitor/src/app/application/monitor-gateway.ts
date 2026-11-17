import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AgentRun, RosterEntry } from '../domain/agent-roster';
import type { Epic } from '../domain/backlog';
import type { CaseReport } from '../domain/evals';
import type { FlowMap, Story } from '../domain/flow-map';
import type { PromptDetail, PromptSummary } from '../domain/prompt';
import type { LimitReading, Note, Problem, Telemetry } from '../domain/records';

export abstract class MonitorGateway {
  abstract readonly online: Signal<boolean>;
  abstract readonly changes$: Observable<void>;
  abstract prompts(limit: number): Observable<PromptSummary[]>;
  abstract promptsWithId(promptId: string): Observable<PromptDetail[]>;
  abstract limits(): Observable<LimitReading[]>;
  abstract refreshLimits(): Observable<LimitReading[]>;
  abstract telemetry(days: number): Observable<Telemetry>;
  abstract problems(): Observable<Problem[]>;
  abstract plans(text: string): Observable<Note[]>;
  abstract forgetPlan(planId: string): Observable<unknown>;
  abstract backlog(): Observable<Epic[]>;
  abstract flowMap(): Observable<FlowMap>;
  abstract stories(limit: number): Observable<Story[]>;
  abstract runs(agent: string): Observable<Story[]>;
  abstract agentRoster(): Observable<RosterEntry[]>;
  abstract agentActivity(agent: string): Observable<AgentRun[]>;
  abstract removeSkill(name: string): Observable<unknown>;
  abstract evals(agent: string): Observable<CaseReport[]>;
}
