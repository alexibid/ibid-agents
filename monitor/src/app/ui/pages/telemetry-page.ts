import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TelemetryStore } from '../../application/records-stores';
import { largestDayOf } from '../../domain/records';
import { ChoiceField, type Choice } from '../atoms/choice-field';
import { ToolBadge } from '../atoms/tool-badge';

const PERIODS: readonly Choice[] = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '30', label: 'Últimos 30 dias' },
];

@Component({
  selector: 'monitor-telemetry-page',
  imports: [DatePipe, DecimalPipe, ChoiceField, ToolBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './telemetry-page.html',
  styleUrl: './telemetry-page.scss',
})
export class TelemetryPage {
  protected readonly store = inject(TelemetryStore);
  protected readonly periods = PERIODS;
  protected readonly days = computed(() => String(this.store.days()));
  protected readonly largestDay = computed(() => largestDayOf(this.store.telemetry().tokensByDay));

  protected choosePeriod(days: string): void {
    this.store.days.set(Number(days));
  }

  protected shareOf(tokens: number): number {
    return this.largestDay() === 0 ? 0 : (tokens / this.largestDay()) * 100;
  }
}
