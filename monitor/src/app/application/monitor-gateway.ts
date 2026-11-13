import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { PromptDetail, PromptSummary } from '../domain/prompt';
import type { LimitReading, Note, Problem, Telemetry } from '../domain/records';

export abstract class MonitorGateway {
  abstract readonly online: Signal<boolean>;
  abstract readonly changes$: Observable<void>;
  abstract prompts(limit: number): Observable<PromptSummary[]>;
  abstract promptsWithId(promptId: string): Observable<PromptDetail[]>;
  abstract limits(): Observable<LimitReading[]>;
  abstract telemetry(days: number): Observable<Telemetry>;
  abstract problems(): Observable<Problem[]>;
  abstract notes(text: string): Observable<Note[]>;
}
