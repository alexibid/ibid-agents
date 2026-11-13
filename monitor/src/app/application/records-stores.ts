import { computed, inject, Injectable, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { matchesProblem, NO_TELEMETRY, type LimitReading, type Note, type Problem, type Telemetry } from '../domain/records';
import { keptFresh } from './kept-fresh';
import { MonitorGateway } from './monitor-gateway';

const ALWAYS = signal(true).asReadonly();
const DEFAULT_DAYS = 14;

@Injectable({ providedIn: 'root' })
export class LimitsStore {
  private readonly gateway = inject(MonitorGateway);

  readonly limits = keptFresh<boolean, readonly LimitReading[]>({
    gateway: this.gateway,
    choice: ALWAYS,
    load: () => this.gateway.limits(),
    whileLoading: [],
  });
}

@Injectable({ providedIn: 'root' })
export class TelemetryStore {
  private readonly gateway = inject(MonitorGateway);

  readonly days = signal(DEFAULT_DAYS);
  readonly telemetry = keptFresh<number, Telemetry>({
    gateway: this.gateway,
    choice: this.days,
    load: (days) => this.gateway.telemetry(days),
    whileLoading: NO_TELEMETRY,
  });
}

@Injectable({ providedIn: 'root' })
export class ProblemsStore {
  private readonly gateway = inject(MonitorGateway);
  private readonly all = keptFresh<boolean, readonly Problem[]>({
    gateway: this.gateway,
    choice: ALWAYS,
    load: () => this.gateway.problems(),
    whileLoading: [],
  });

  readonly tool = signal('');
  readonly text = signal('');
  readonly problems = computed(() => {
    const filter = { tool: this.tool(), text: this.text() };
    return this.all().filter((problem) => matchesProblem(problem, filter));
  });
}

@Injectable({ providedIn: 'root' })
export class PlansStore {
  private readonly gateway = inject(MonitorGateway);

  readonly text = signal('');
  readonly plans = keptFresh<string, readonly Note[]>({
    gateway: this.gateway,
    choice: this.text,
    load: (text) => this.gateway.plans(text),
    whileLoading: [],
  });

  forget(planId: string): Observable<unknown> {
    return this.gateway.forgetPlan(planId);
  }
}
