import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const NEARLY_SPENT = 80;
const HALF_SPENT = 50;

@Component({
  selector: 'monitor-meter',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" [class]="'meter meter--' + level()">
      <div class="meter__heading">
        <span>{{ label() }}</span>
        <strong>{{ usedPercent() | number: '1.3-3' }} %</strong>
      </div>
      <div class="meter__track" role="img" [attr.aria-label]="label() + ': ' + usedPercent() + ' % gasto'">
        <div class="meter__fill" [style.inline-size.%]="usedPercent()"></div>
      </div>
      <span class="meter__caption">{{ caption() }}</span>
    </div>
  `,
  styleUrl: './meter.scss',
})
export class Meter {
  readonly label = input.required<string>();
  readonly usedPercent = input.required<number>();
  readonly caption = input('');

  protected readonly level = computed(() => {
    const used = this.usedPercent();
    return used >= NEARLY_SPENT ? 'high' : used >= HALF_SPENT ? 'medium' : 'low';
  });
}
