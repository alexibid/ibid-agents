import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'monitor-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field">
      <span class="field__label">{{ label() }}</span>
      <input
        class="field__control"
        type="search"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
      />
    </label>
  `,
  styleUrl: './field.scss',
})
export class TextField {
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly value = model('');
}
