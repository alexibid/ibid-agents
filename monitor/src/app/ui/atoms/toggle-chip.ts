import { ChangeDetectionStrategy, Component, model } from '@angular/core';

@Component({
  selector: 'monitor-toggle-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="toggle-chip" [class.toggle-chip--on]="on()" type="button" [attr.aria-pressed]="on()" (click)="on.set(!on())">
      <ng-content />
    </button>
  `,
  styleUrl: './toggle-chip.scss',
})
export class ToggleChip {
  readonly on = model(false);
}
