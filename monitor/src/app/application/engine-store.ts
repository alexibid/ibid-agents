import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, interval, merge, startWith, Subject, switchMap, tap, type Observable } from 'rxjs';
import { NO_ENGINE, type EngineStatus } from '../domain/engine';
import { MonitorGateway } from './monitor-gateway';

const READ_EVERY_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class EngineStore {
  private readonly gateway = inject(MonitorGateway);
  private readonly afterRestart = new Subject<EngineStatus>();

  private readonly polled$ = merge(this.gateway.changes$, interval(READ_EVERY_MS)).pipe(
    startWith(undefined),
    switchMap(() => this.gateway.engine().pipe(catchError(() => EMPTY))),
  );

  readonly status = toSignal(merge(this.polled$, this.afterRestart), { initialValue: NO_ENGINE });

  restartOutdated(): Observable<EngineStatus> {
    return this.gateway.restartEngine().pipe(tap((status) => this.afterRestart.next(status)));
  }
}
