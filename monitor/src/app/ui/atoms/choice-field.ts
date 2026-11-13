import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface Choice {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'monitor-choice-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field">
      <span class="field__label">{{ label() }}</span>
      <select class="field__control" [value]="value()" (change)="value.set($any($event.target).value)">
        @for (choice of choices(); track choice.value) {
          <option [value]="choice.value" [selected]="choice.value === value()">{{ choice.label }}</option>
        }
      </select>
    </label>
  `,
  styleUrl: './field.scss',
})
export class ChoiceField {
  readonly label = input.required<string>();
  readonly choices = input.required<readonly Choice[]>();
  readonly value = model('');
}
