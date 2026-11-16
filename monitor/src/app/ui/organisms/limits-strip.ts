import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { LimitsStore } from '../../application/records-stores';
import { TOOL_NAMES, type Tool } from '../../domain/prompt';
import { POOL_NAMES, WINDOW_NAMES, type LimitReading } from '../../domain/records';
import { Button } from '../atoms/button';
import { Meter } from '../atoms/meter';

const TOOLS: readonly Tool[] = ['claude', 'antigravity'];

@Component({
  selector: 'monitor-limits-strip',
  imports: [Button, Meter, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="limits-refresh">
      @if (refreshFailed()) {
        <p class="limits-refresh__message">Não consegui atualizar: o serviço do monitor não respondeu.</p>
      }
      <monitor-button look="quiet" [attr.aria-busy]="refreshing()" (click)="refresh()">
        {{ refreshing() ? 'A atualizar…' : 'Atualizar limites' }}
      </monitor-button>
    </div>
    @for (group of groups(); track group.tool) {
      <section class="limits">
        <h2 class="limits__tool">{{ group.name }}</h2>
        @for (reading of group.readings; track reading.pool + reading.window) {
          <monitor-meter
            [label]="windowName(reading) + ' · ' + poolName(reading)"
            [usedPercent]="reading.usedPercent"
            [caption]="'renova ' + (reading.resetsOn | date: 'EEE d, HH:mm')"
          />
        } @empty {
          <p class="limits__unknown">Limites desconhecidos: a ferramenta ainda não os entregou.</p>
        }
      </section>
    }
  `,
  styleUrl: './limits-strip.scss',
})
export class LimitsStrip {
  private readonly store = inject(LimitsStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly refreshing = signal(false);
  protected readonly refreshFailed = signal(false);

  protected readonly groups = computed(() =>
    TOOLS.map((tool) => ({ tool, name: TOOL_NAMES[tool], readings: this.store.limits().filter((reading) => reading.tool === tool) })),
  );

  protected refresh(): void {
    if (this.refreshing()) {
      return;
    }
    this.refreshing.set(true);
    this.refreshFailed.set(false);
    this.store
      .refresh()
      .pipe(
        finalize(() => this.refreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => this.refreshFailed.set(true) });
  }

  protected windowName(reading: LimitReading): string {
    return WINDOW_NAMES[reading.window];
  }

  protected poolName(reading: LimitReading): string {
    return POOL_NAMES[reading.pool] ?? reading.pool;
  }
}
