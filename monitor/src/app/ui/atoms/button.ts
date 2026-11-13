import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'monitor-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="button" [class.button--quiet]="look() === 'quiet'" type="button"><ng-content /></button>`,
  styleUrl: './button.scss',
})
export class Button {
  readonly look = input<'solid' | 'quiet'>('solid');
}
