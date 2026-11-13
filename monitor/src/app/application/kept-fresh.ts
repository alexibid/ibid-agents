import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { Signal } from '@angular/core';
import { catchError, combineLatest, EMPTY, startWith, switchMap, type Observable } from 'rxjs';
import type { MonitorGateway } from './monitor-gateway';

export interface Freshness<Choice, Value> {
  readonly gateway: MonitorGateway;
  readonly choice: Signal<Choice>;
  readonly load: (choice: Choice) => Observable<Value>;
  readonly whileLoading: Value;
}

export function keptFresh<Choice, Value>({ gateway, choice, load, whileLoading }: Freshness<Choice, Value>): Signal<Value> {
  const reloads = combineLatest([toObservable(choice), gateway.changes$.pipe(startWith(undefined))]);
  const values = reloads.pipe(switchMap(([chosen]) => load(chosen).pipe(catchError(() => EMPTY))));
  return toSignal(values, { initialValue: whileLoading });
}
