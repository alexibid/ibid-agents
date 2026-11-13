import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Percent as PercentValue } from '../../domain/prompt';

@Component({
  selector: 'monitor-percent',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let percent = value();
    @if (percent === 'unknown') {
      <span class="u-muted" title="Sem leituras do limite antes e depois deste pedido">desconhecido</span>
    } @else {
      <span [title]="estimated() ? 'Estimativa, calculada a partir das vezes em que o limite foi atingido' : 'Medido'">
        {{ estimated() ? '≈ ' : '' }}{{ percent | number: '1.3-3' }} %
      </span>
    }
  `,
})
export class Percent {
  readonly value = input.required<PercentValue>();
  readonly estimated = input(false);
}
