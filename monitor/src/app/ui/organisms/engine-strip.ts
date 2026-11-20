import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { EngineStore } from '../../application/engine-store';
import { engineSummaryOf } from '../../domain/engine';
import { Button } from '../atoms/button';

@Component({
  selector: 'monitor-engine-strip',
  imports: [Button, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="engine" aria-label="Motor de fluxo">
      <h2 class="engine__title">Motor</h2>
      <p class="engine__summary" [class.engine__summary--outdated]="summary().outdated > 0" role="status">
        {{ summary().text }}
        @if (status().builtOn) {
          · build de {{ status().builtOn | date: 'd MMM, HH:mm' }}
        }
      </p>
      <ul class="engine__servers">
        @for (server of status().servers; track server.pid) {
          <li class="engine__server" [class.engine__server--outdated]="server.outdated">
            {{ server.session }} · {{ server.outdated ? 'desatualizado' : 'atualizado' }}, motor desde
            {{ server.startedOn | date: 'd MMM, HH:mm' }}
            @if (!server.restartsInPlace) {
              · versão antiga, liga-se uma última vez na próxima chamada
            }
          </li>
        }
      </ul>
      @if (status().monitorOutdated) {
        <p class="engine__note">O próprio monitor corre um build antigo: fecha e reabre a app.</p>
      }
      @if (message()) {
        <p class="engine__note">{{ message() }}</p>
      }
      @if (summary().canRestart) {
        <monitor-button [attr.aria-busy]="restarting()" (click)="restart()">
          {{ restarting() ? 'A reiniciar…' : 'Reiniciar motor' }}
        </monitor-button>
      }
    </section>
  `,
  styleUrl: './engine-strip.scss',
})
export class EngineStrip {
  private readonly store = inject(EngineStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = this.store.status;
  protected readonly summary = computed(() => engineSummaryOf(this.status()));
  protected readonly restarting = signal(false);
  protected readonly message = signal('');

  protected restart(): void {
    if (this.restarting()) {
      return;
    }
    this.restarting.set(true);
    this.message.set('');
    this.store
      .restartOutdated()
      .pipe(
        finalize(() => this.restarting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.message.set('Motor reiniciado em todas as sessões. O estado atualiza em segundos.'),
        error: () => this.message.set('Não consegui reiniciar: o serviço do monitor não respondeu.'),
      });
  }
}
