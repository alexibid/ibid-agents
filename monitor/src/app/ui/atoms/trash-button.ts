import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'monitor-trash-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="trash-button" type="button" [attr.aria-label]="label()" [title]="label()">
      <svg class="trash-button__icon" viewBox="0 0 512 512" aria-hidden="true">
        <path
          d="M176 64h160l16 32h96v48H64V96h96l16-32zm-80 112h320l-24 272c-2 22-20 40-42 40H162c-22 0-40-18-42-40L96 176zm104 56v192h40V232h-40zm72 0v192h40V232h-40z"
        />
      </svg>
    </button>
  `,
  styleUrl: './trash-button.scss',
})
export class TrashButton {
  readonly label = input.required<string>();
}
