import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LimitsStore } from '../../application/records-stores';
import { TOOL_NAMES, type Tool } from '../../domain/prompt';
import { POOL_NAMES, WINDOW_NAMES, type LimitReading } from '../../domain/records';
import { Meter } from '../atoms/meter';

const TOOLS: readonly Tool[] = ['claude', 'antigravity'];

@Component({
  selector: 'monitor-limits-strip',
  imports: [Meter, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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

  protected readonly groups = computed(() =>
    TOOLS.map((tool) => ({ tool, name: TOOL_NAMES[tool], readings: this.store.limits().filter((reading) => reading.tool === tool) })),
  );

  protected windowName(reading: LimitReading): string {
    return WINDOW_NAMES[reading.window];
  }

  protected poolName(reading: LimitReading): string {
    return POOL_NAMES[reading.pool] ?? reading.pool;
  }
}
