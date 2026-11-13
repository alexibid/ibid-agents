import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, share } from 'rxjs';
import { MonitorGateway } from '../application/monitor-gateway';
import type { PromptDetail, PromptSummary } from '../domain/prompt';
import type { LimitReading, Note, Problem, Telemetry } from '../domain/records';

const SERVICE = 'http://127.0.0.1:4710/api';
const PROBLEMS_READ = 200;

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

  override telemetry(days: number): Observable<Telemetry> {
    return this.http.get<Telemetry>(`${SERVICE}/telemetry`, { params: { days } });
  }

  override problems(): Observable<Problem[]> {
    return this.http.get<Problem[]>(`${SERVICE}/errors`, { params: { limit: PROBLEMS_READ } });
  }

  override notes(text: string): Observable<Note[]> {
    return this.http.get<Note[]>(`${SERVICE}/notes`, { params: { text } });
  }
}
