import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'monitor-list-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="list-button" [class.list-button--current]="current()" type="button" [attr.aria-pressed]="current()"><ng-content /></button>`,
  styleUrl: './list-button.scss',
})
export class ListButton {
  readonly current = input(false);
}
