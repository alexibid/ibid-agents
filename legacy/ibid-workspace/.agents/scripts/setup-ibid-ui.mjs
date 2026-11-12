import fs from 'fs';
import path from 'path';

const ROOT = '/Users/alexsantos/Projects/ibid-ui';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

console.log('🚀 Iniciando setup consolidado do ibid-ui...');

// 1. Scan icons and generate icon types & catalog
const iconDir = path.join(ROOT, 'public/icons');
const iconFiles = fs.readdirSync(iconDir).filter(f => f.endsWith('.svg'));
const iconNames = iconFiles.map(f => f.replace('.svg', '')).sort();

const iconTypesContent = `export const IBID_ICONS = [
  ${iconNames.map(name => `'${name}'`).join(',\n  ')}
] as const;

export type IbidIconName = (typeof IBID_ICONS)[number];

export type IbidIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export const IBID_ICON_SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48
};
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/icon/icon.types.ts'), iconTypesContent);

// 2. Icon Component
const iconComponentContent = `import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IbidIconName, IbidIconSize, IBID_ICON_SIZE_MAP } from './icon.types';

@Component({
  selector: 'ibid-icon',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <img
      [src]="iconPath()"
      [alt]="altText()"
      [style.width.px]="computedSize()"
      [style.height.px]="computedSize()"
      class="ibid-icon"
      [class.ibid-icon--muted]="muted()"
      loading="lazy"
    />
  \`,
  styles: [\`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
    }

    .ibid-icon {
      display: block;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
    }

    .ibid-icon--muted {
      opacity: 0.6;
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IbidIconComponent {
  readonly name = input.required<IbidIconName>();
  readonly size = input<IbidIconSize>('md');
  readonly alt = input<string>('');
  readonly muted = input<boolean>(false);

  readonly computedSize = computed(() => {
    const s = this.size();
    if (typeof s === 'number') {
      return s;
    }
    return IBID_ICON_SIZE_MAP[s] ?? 24;
  });

  readonly iconPath = computed(() => \`/icons/\${this.name()}.svg\`);
  readonly altText = computed(() => this.alt() || \`\${this.name()} icon\`);
}
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/icon/icon.component.ts'), iconComponentContent);

// 3. Icon Gallery Story
const iconStoryContent = `import type { Meta, StoryObj } from '@storybook/angular';
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IbidIconComponent } from './icon.component';
import { IBID_ICONS, IbidIconName } from './icon.types';

@Component({
  selector: 'ibid-icon-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, IbidIconComponent],
  template: \`
    <div style="font-family: inherit; padding: 24px; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">IBID Icon Library</h2>
        <p style="color: var(--color-text-muted, #8A8A85); margin: 0 0 16px 0;">
          Total: {{ allIcons.length }} line-art vector icons (512x512 viewBox, responsive).
        </p>
        <input
          type="text"
          [ngModel]="searchTerm()"
          (ngModelChange)="searchTerm.set($event)"
          placeholder="Filter icons by name..."
          style="width: 100%; max-width: 400px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--color-border, #E5E3DC); font-size: 14px;"
        />
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px;">
        @for (icon of filteredIcons(); track icon) {
          <div
            (click)="copyIcon(icon)"
            style="background: #ffffff; border: 1px solid #E5E3DC; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;"
            [style.border-color]="copiedIcon() === icon ? 'var(--color-success, #0E9B70)' : '#E5E3DC'"
          >
            <div style="margin-bottom: 12px;">
              <ibid-icon [name]="icon" [size]="32"></ibid-icon>
            </div>
            <span style="font-size: 12px; font-weight: 500; text-align: center; color: #2C2C2A; word-break: break-all;">
              {{ icon }}
            </span>
            @if (copiedIcon() === icon) {
              <span style="font-size: 10px; color: #0E9B70; margin-top: 4px; font-weight: 600;">Copied!</span>
            }
          </div>
        }
      </div>
    </div>
  \`
})
class IbidIconGalleryComponent {
  readonly allIcons = IBID_ICONS;
  readonly searchTerm = signal('');
  readonly copiedIcon = signal<string | null>(null);

  readonly filteredIcons = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.allIcons;
    return this.allIcons.filter(name => name.toLowerCase().includes(term));
  });

  copyIcon(name: string) {
    navigator.clipboard?.writeText(name);
    this.copiedIcon.set(name);
    setTimeout(() => {
      if (this.copiedIcon() === name) this.copiedIcon.set(null);
    }, 1500);
  }
}

const meta: Meta<IbidIconComponent> = {
  title: 'Atoms/Icon',
  component: IbidIconComponent,
  tags: ['autodocs']
};
export default meta;

export const SingleIcon: StoryObj<IbidIconComponent> = {
  args: {
    name: 'wallet',
    size: 'lg',
    muted: false
  }
};

export const Gallery: StoryObj = {
  render: () => ({
    component: IbidIconGalleryComponent
  })
};
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/icon/icon.stories.ts'), iconStoryContent);
writeFile(path.join(ROOT, 'src/app/components/atoms/icon/index.ts'), `export * from './icon.types';\nexport * from './icon.component';\n`);

// 4. Button Component & Story
const buttonComponentContent = `import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IbidIconComponent } from '../icon/icon.component';
import { IbidIconName } from '../icon/icon.types';

export type IbidButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'hand-drawn';
export type IbidButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ibid-button',
  standalone: true,
  imports: [CommonModule, IbidIconComponent],
  template: \`
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      class="ibid-button"
      [class.ibid-button--primary]="variant() === 'primary'"
      [class.ibid-button--secondary]="variant() === 'secondary'"
      [class.ibid-button--ghost]="variant() === 'ghost'"
      [class.ibid-button--danger]="variant() === 'danger'"
      [class.ibid-button--hand-drawn]="variant() === 'hand-drawn'"
      [class.ibid-button--sm]="size() === 'sm'"
      [class.ibid-button--md]="size() === 'md'"
      [class.ibid-button--lg]="size() === 'lg'"
      [class.ibid-button--full-width]="fullWidth()"
      (click)="onClick($event)"
    >
      @if (iconPrefix()) {
        <ibid-icon [name]="iconPrefix()!" [size]="size() === 'sm' ? 16 : 20"></ibid-icon>
      }
      <span class="ibid-button__label"><ng-content></ng-content></span>
      @if (iconSuffix()) {
        <ibid-icon [name]="iconSuffix()!" [size]="size() === 'sm' ? 16 : 20"></ibid-icon>
      }
    </button>
  \`,
  styles: [\`
    :host {
      display: inline-block;
    }

    .ibid-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      font-weight: 600;
      border-radius: 12px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      user-select: none;
      text-decoration: none;
      box-sizing: border-box;

      &:focus-visible {
        outline: 2px solid var(--color-ink, #2C2C2A);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    }

    .ibid-button--sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    .ibid-button--md {
      padding: 10px 18px;
      font-size: 14px;
    }

    .ibid-button--lg {
      padding: 14px 24px;
      font-size: 16px;
    }

    .ibid-button--primary {
      background-color: var(--color-primary, #2C2C2A);
      color: #FFFFFF;
      border-color: var(--color-primary, #2C2C2A);

      &:hover:not(:disabled) {
        background-color: var(--color-primary-hover, #424240);
      }
    }

    .ibid-button--secondary {
      background-color: #FFFFFF;
      color: var(--color-text, #2C2C2A);
      border-color: var(--color-border, #E5E3DC);

      &:hover:not(:disabled) {
        background-color: var(--color-surface-hover, #F8FAFC);
        border-color: #D1CFCA;
      }
    }

    .ibid-button--ghost {
      background-color: transparent;
      color: var(--color-text, #2C2C2A);

      &:hover:not(:disabled) {
        background-color: rgba(44, 44, 42, 0.05);
      }
    }

    .ibid-button--danger {
      background-color: var(--color-danger, #C4432B);
      color: #FFFFFF;

      &:hover:not(:disabled) {
        background-color: #A33520;
      }
    }

    .ibid-button--hand-drawn {
      background-color: #FFFFFF;
      color: var(--color-text, #2C2C2A);
      border: 1.5px solid var(--color-ink, #2C2C2A);
      box-shadow: 2px 2px 0px var(--color-ink, #2C2C2A);

      &:hover:not(:disabled) {
        transform: translate(-1px, -1px);
        box-shadow: 3px 3px 0px var(--color-ink, #2C2C2A);
      }

      &:active:not(:disabled) {
        transform: translate(1px, 1px);
        box-shadow: 1px 1px 0px var(--color-ink, #2C2C2A);
      }
    }

    .ibid-button--full-width {
      width: 100%;
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IbidButtonComponent {
  readonly variant = input<IbidButtonVariant>('primary');
  readonly size = input<IbidButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly iconPrefix = input<IbidIconName | null>(null);
  readonly iconSuffix = input<IbidIconName | null>(null);

  readonly clicked = output<MouseEvent>();

  onClick(event: MouseEvent) {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/button/button.component.ts'), buttonComponentContent);

const buttonStoryContent = `import type { Meta, StoryObj } from '@storybook/angular';
import { IbidButtonComponent } from './button.component';

const meta: Meta<IbidButtonComponent> = {
  title: 'Atoms/Button',
  component: IbidButtonComponent,
  tags: ['autodocs']
};
export default meta;

export const Primary: StoryObj<IbidButtonComponent> = {
  args: {
    variant: 'primary',
    size: 'md'
  },
  render: (args) => ({
    props: args,
    template: '<ibid-button [variant]="variant" [size]="size">Primary Action</ibid-button>'
  })
};

export const HandDrawn: StoryObj<IbidButtonComponent> = {
  args: {
    variant: 'hand-drawn',
    size: 'md',
    iconPrefix: 'sparkle'
  },
  render: (args) => ({
    props: args,
    template: '<ibid-button [variant]="variant" [size]="size" [iconPrefix]="iconPrefix">Line Art Button</ibid-button>'
  })
};

export const SecondaryWithIcon: StoryObj<IbidButtonComponent> = {
  args: {
    variant: 'secondary',
    size: 'md',
    iconPrefix: 'wallet'
  },
  render: (args) => ({
    props: args,
    template: '<ibid-button [variant]="variant" [size]="size" [iconPrefix]="iconPrefix">Accounts</ibid-button>'
  })
};
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/button/button.stories.ts'), buttonStoryContent);
writeFile(path.join(ROOT, 'src/app/components/atoms/button/index.ts'), `export * from './button.component';\n`);

// 5. Badge Component
const badgeComponentContent = `import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IbidIconComponent } from '../icon/icon.component';
import { IbidIconName } from '../icon/icon.types';

export type IbidBadgeVariant = 'neutral' | 'success' | 'coral' | 'amber' | 'teal' | 'pink';

@Component({
  selector: 'ibid-badge',
  standalone: true,
  imports: [CommonModule, IbidIconComponent],
  template: \`
    <span
      class="ibid-badge"
      [class.ibid-badge--neutral]="variant() === 'neutral'"
      [class.ibid-badge--success]="variant() === 'success'"
      [class.ibid-badge--coral]="variant() === 'coral'"
      [class.ibid-badge--amber]="variant() === 'amber'"
      [class.ibid-badge--teal]="variant() === 'teal'"
      [class.ibid-badge--pink]="variant() === 'pink'"
    >
      @if (icon()) {
        <ibid-icon [name]="icon()!" [size]="14"></ibid-icon>
      }
      <span class="ibid-badge__text"><ng-content></ng-content></span>
    </span>
  \`,
  styles: [\`
    :host {
      display: inline-flex;
    }

    .ibid-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
    }

    .ibid-badge--neutral {
      background-color: #E5E3DC;
      color: #2C2C2A;
    }

    .ibid-badge--success {
      background-color: var(--color-teal-bg, #E1F5EE);
      color: var(--color-teal-text, #085041);
    }

    .ibid-badge--coral {
      background-color: var(--color-coral-bg, #FAECE7);
      color: var(--color-coral-text, #712B13);
    }

    .ibid-badge--amber {
      background-color: var(--color-amber-bg, #FAEEDA);
      color: var(--color-amber-text, #633806);
    }

    .ibid-badge--teal {
      background-color: var(--color-teal-bg, #E1F5EE);
      color: var(--color-teal-text, #085041);
    }

    .ibid-badge--pink {
      background-color: var(--color-pink-bg, #FBEAF0);
      color: var(--color-pink-text, #72243E);
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IbidBadgeComponent {
  readonly variant = input<IbidBadgeVariant>('neutral');
  readonly icon = input<IbidIconName | null>(null);
}
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/badge/badge.component.ts'), badgeComponentContent);

const badgeStoryContent = `import type { Meta, StoryObj } from '@storybook/angular';
import { IbidBadgeComponent } from './badge.component';

const meta: Meta<IbidBadgeComponent> = {
  title: 'Atoms/Badge',
  component: IbidBadgeComponent,
  tags: ['autodocs']
};
export default meta;

export const Default: StoryObj<IbidBadgeComponent> = {
  args: {
    variant: 'teal',
    icon: 'verified'
  },
  render: (args) => ({
    props: args,
    template: '<ibid-badge [variant]="variant" [icon]="icon">Active</ibid-badge>'
  })
};
`;

writeFile(path.join(ROOT, 'src/app/components/atoms/badge/badge.stories.ts'), badgeStoryContent);
writeFile(path.join(ROOT, 'src/app/components/atoms/badge/index.ts'), `export * from './badge.component';\n`);

// 6. Card Component
const cardComponentContent = `import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ibid-card',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div
      class="ibid-card"
      [class.ibid-card--hand-drawn]="handDrawn()"
      [class.ibid-card--interactive]="interactive()"
    >
      <ng-content></ng-content>
    </div>
  \`,
  styles: [\`
    :host {
      display: block;
    }

    .ibid-card {
      background: #FFFFFF;
      border: 1px solid var(--color-border, #E5E3DC);
      border-radius: 16px;
      padding: 20px;
      box-sizing: border-box;
      transition: all 0.2s ease-in-out;
    }

    .ibid-card--hand-drawn {
      border: 1.5px solid var(--color-ink, #2C2C2A);
      box-shadow: 3px 3px 0px var(--color-ink, #2C2C2A);
    }

    .ibid-card--interactive {
      cursor: pointer;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(44, 44, 42, 0.08);
      }
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IbidCardComponent {
  readonly handDrawn = input<boolean>(false);
  readonly interactive = input<boolean>(false);
}
`;

writeFile(path.join(ROOT, 'src/app/components/molecules/card/card.component.ts'), cardComponentContent);

const cardStoryContent = `import type { Meta, StoryObj } from '@storybook/angular';
import { IbidCardComponent } from './card.component';
import { IbidButtonComponent } from '../../atoms/button/button.component';
import { IbidBadgeComponent } from '../../atoms/badge/badge.component';
import { IbidIconComponent } from '../../atoms/icon/icon.component';

const meta: Meta<IbidCardComponent> = {
  title: 'Molecules/Card',
  component: IbidCardComponent,
  tags: ['autodocs']
};
export default meta;

export const Default: StoryObj<IbidCardComponent> = {
  args: {
    handDrawn: true,
    interactive: false
  },
  render: (args) => ({
    props: args,
    moduleMetadata: {
      imports: [IbidButtonComponent, IbidBadgeComponent, IbidIconComponent]
    },
    template: \`
      <ibid-card [handDrawn]="handDrawn" [interactive]="interactive">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <ibid-badge variant="teal" icon="wallet">Local-First Balance</ibid-badge>
          <ibid-icon name="sparkle" [size]="20"></ibid-icon>
        </div>
        <div style="font-size: 32px; font-weight: 800; color: #2C2C2A; margin-bottom: 8px;">
          € 12,450.80
        </div>
        <p style="color: #8A8A85; font-size: 14px; margin: 0 0 16px 0;">
          +14.2% em relação ao mês anterior
        </p>
        <ibid-button variant="hand-drawn" size="sm" iconPrefix="receipt_long">
          Ver Movimentos
        </ibid-button>
      </ibid-card>
    \`
  })
};
`;

writeFile(path.join(ROOT, 'src/app/components/molecules/card/card.stories.ts'), cardStoryContent);
writeFile(path.join(ROOT, 'src/app/components/molecules/card/index.ts'), `export * from './card.component';\n`);

// 7. Header Organism
const headerComponentContent = `import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IbidIconComponent } from '../../atoms/icon/icon.component';
import { IbidButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'ibid-header',
  standalone: true,
  imports: [CommonModule, IbidIconComponent, IbidButtonComponent],
  template: \`
    <header class="ibid-header">
      <div class="ibid-header__brand">
        <div class="ibid-header__logo">
          <ibid-icon name="sparkle" [size]="28"></ibid-icon>
        </div>
        <div class="ibid-header__title-group">
          <span class="ibid-header__title">{{ title() }}</span>
          @if (subtitle()) {
            <span class="ibid-header__subtitle">{{ subtitle() }}</span>
          }
        </div>
      </div>

      <div class="ibid-header__actions">
        <ng-content></ng-content>
      </div>
    </header>
  \`,
  styles: [\`
    :host {
      display: block;
      width: 100%;
    }

    .ibid-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #FFFFFF;
      border-bottom: 1px solid var(--color-border, #E5E3DC);
      box-sizing: border-box;
    }

    .ibid-header__brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ibid-header__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid var(--color-ink, #2C2C2A);
      box-shadow: 2px 2px 0px var(--color-ink, #2C2C2A);
      background: #FFFFFF;
    }

    .ibid-header__title-group {
      display: flex;
      flex-direction: column;
    }

    .ibid-header__title {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text, #2C2C2A);
      line-height: 1.2;
    }

    .ibid-header__subtitle {
      font-size: 12px;
      color: var(--color-text-muted, #8A8A85);
    }

    .ibid-header__actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IbidHeaderComponent {
  readonly title = input<string>('IBID Application');
  readonly subtitle = input<string>('');
}
`;

writeFile(path.join(ROOT, 'src/app/components/organisms/header/header.component.ts'), headerComponentContent);
writeFile(path.join(ROOT, 'src/app/components/organisms/header/index.ts'), `export * from './header.component';\n`);

// 8. Barrel Export for @ibid/ui
const uiBarrelContent = `export * from './atoms/icon';
export * from './atoms/button';
export * from './atoms/badge';
export * from './molecules/card';
export * from './organisms/header';
`;

writeFile(path.join(ROOT, 'src/app/components/index.ts'), uiBarrelContent);

// 9. Showcase Page & App Entry
const showcaseComponentContent = `import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IbidHeaderComponent } from './components/organisms/header/header.component';
import { IbidCardComponent } from './components/molecules/card/card.component';
import { IbidButtonComponent } from './components/atoms/button/button.component';
import { IbidBadgeComponent } from './components/atoms/badge/badge.component';
import { IbidIconComponent } from './components/atoms/icon/icon.component';
import { IBID_ICONS } from './components/atoms/icon/icon.types';

@Component({
  selector: 'ibid-showcase',
  standalone: true,
  imports: [
    CommonModule,
    IbidHeaderComponent,
    IbidCardComponent,
    IbidButtonComponent,
    IbidBadgeComponent,
    IbidIconComponent
  ],
  template: \`
    <div class="showcase-layout">
      <ibid-header title="ibid UI Design System" subtitle="Line Art Design & Component Showcase">
        <ibid-badge variant="teal" icon="verified">v1.0.0 Ready</ibid-badge>
        <ibid-button variant="hand-drawn" size="sm" iconPrefix="sparkle">Storybook Mode</ibid-button>
      </ibid-header>

      <main class="showcase-content">
        <section class="showcase-hero">
          <h1>Identidade Visual & Biblioteca de Componentes</h1>
          <p>Design minimalista com estilo line art desenhado à mão, tipagem estrita e integração total com .agents.</p>
        </section>

        <div class="showcase-grid">
          <!-- Card 1: Cards & Typography -->
          <ibid-card [handDrawn]="true">
            <div class="card-header">
              <ibid-badge variant="coral" icon="wallet">Cartão de Destaque</ibid-badge>
              <ibid-icon name="sparkle" [size]="20"></ibid-icon>
            </div>
            <div class="metric-value">€ 4,890.50</div>
            <p class="metric-caption">Saldo Seguro Disponível Hoje</p>
            <div class="card-actions">
              <ibid-button variant="primary" size="sm" iconPrefix="add">Nova Transação</ibid-button>
              <ibid-button variant="secondary" size="sm" iconPrefix="wallet">Contas</ibid-button>
            </div>
          </ibid-card>

          <!-- Card 2: Buttons & Variants -->
          <ibid-card [handDrawn]="false">
            <h3>Variantes de Botões</h3>
            <div class="button-matrix">
              <ibid-button variant="primary" size="md">Primary</ibid-button>
              <ibid-button variant="secondary" size="md">Secondary</ibid-button>
              <ibid-button variant="hand-drawn" size="md" iconPrefix="sparkle">Line Art</ibid-button>
              <ibid-button variant="ghost" size="md">Ghost</ibid-button>
              <ibid-button variant="danger" size="md" iconPrefix="delete-outline">Delete</ibid-button>
            </div>
          </ibid-card>

          <!-- Card 3: Badges -->
          <ibid-card [handDrawn]="false">
            <h3>Badges & Categorias</h3>
            <div class="badge-matrix">
              <ibid-badge variant="teal" icon="check-circle">Aprovado</ibid-badge>
              <ibid-badge variant="amber" icon="warning">Pendente</ibid-badge>
              <ibid-badge variant="coral" icon="receipt_long">Despesa</ibid-badge>
              <ibid-badge variant="pink" icon="card_giftcard">Presentes</ibid-badge>
              <ibid-badge variant="neutral" icon="settings">Configuração</ibid-badge>
            </div>
          </ibid-card>

          <!-- Card 4: Icon Library Stats -->
          <ibid-card [handDrawn]="true">
            <div class="card-header">
              <ibid-badge variant="teal" icon="grid">Coleção SVG 512x512</ibid-badge>
            </div>
            <div class="metric-value">{{ totalIcons }} Ícones</div>
            <p class="metric-caption">Catálogo completo de vetores line art integrados e tipados.</p>
            <div class="icon-preview-row">
              <ibid-icon name="wallet" [size]="28"></ibid-icon>
              <ibid-icon name="savings" [size]="28"></ibid-icon>
              <ibid-icon name="credit_card" [size]="28"></ibid-icon>
              <ibid-icon name="trending_up" [size]="28"></ibid-icon>
              <ibid-icon name="sparkle" [size]="28"></ibid-icon>
              <ibid-icon name="bank" [size]="28"></ibid-icon>
              <ibid-icon name="verified" [size]="28"></ibid-icon>
            </div>
          </ibid-card>
        </div>
      </main>
    </div>
  \`,
  styles: [\`
    .showcase-layout {
      min-height: 100vh;
      background-color: var(--color-bg, #F1EFE8);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .showcase-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    .showcase-hero {
      margin-bottom: 32px;
      h1 {
        font-size: 32px;
        font-weight: 800;
        color: #2C2C2A;
        margin: 0 0 8px 0;
      }
      p {
        color: #8A8A85;
        font-size: 16px;
        margin: 0;
      }
    }

    .showcase-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .metric-value {
      font-size: 36px;
      font-weight: 800;
      color: #2C2C2A;
      margin-bottom: 4px;
    }

    .metric-caption {
      color: #8A8A85;
      font-size: 14px;
      margin: 0 0 16px 0;
    }

    .card-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .button-matrix {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .badge-matrix {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .icon-preview-row {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-top: 16px;
    }
  \`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShowcaseComponent {
  readonly totalIcons = IBID_ICONS.length;
}
`;

writeFile(path.join(ROOT, 'src/app/showcase.component.ts'), showcaseComponentContent);

// 10. Main.ts, App Config, Index.html
const mainTsContent = `import { bootstrapApplication } from '@angular/platform-browser';
import { ShowcaseComponent } from './app/showcase.component';

bootstrapApplication(ShowcaseComponent, {
  providers: []
}).catch((err) => console.error(err));
`;

writeFile(path.join(ROOT, 'src/main.ts'), mainTsContent);

const indexHtmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ibid UI - Line Art Design System</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <ibid-showcase></ibid-showcase>
</body>
</html>
`;

writeFile(path.join(ROOT, 'src/index.html'), indexHtmlContent);

// 11. Storybook Config
ensureDir(path.join(ROOT, '.storybook'));

const storybookMainContent = `import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook'
  ],
  framework: {
    name: '@storybook/angular-vite',
    options: {}
  },
  staticDirs: ['../public']
};

export default config;
`;

writeFile(path.join(ROOT, '.storybook/main.ts'), storybookMainContent);

const storybookPreviewContent = `import type { Preview } from '@storybook/angular';
import '../src/styles.scss';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'ibid-bg',
      values: [
        { name: 'ibid-bg', value: '#F1EFE8' },
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark', value: '#2C2C2A' }
      ]
    }
  }
};

export default preview;
`;

writeFile(path.join(ROOT, '.storybook/preview.ts'), storybookPreviewContent);

// 12. Setup .agents/ governance
ensureDir(path.join(ROOT, '.agents/skills'));

const agentsMdContent = `# ibid UI Design System Rules

Este repositório (**\`ibid-ui\`**) é a **Single Source of Truth** visual e de componentes para todos os projetos da empresa **ibid** (ex: SavvyJar, Camila, etc.).

## 🎨 Identidade Visual (Line Art & ITCSS)
- **Prefixo Obrigatório:** Todos os componentes atómicos e de layout devem ter o prefixo **\`ibid-\`** (ex: \`<ibid-button>\`, \`<ibid-card>\`, \`<ibid-icon>\`, \`<ibid-header>\`).
- **Estilo Visual:** Minimalista com estética *Line Art* (contornos desenhados à mão com \`clip-path\`, viewBox de ícones \`512x512\`, fundo base \`#F1EFE8\`).
- **Arquitetura de Estilos:** ITCSS (\`src/styles/\`) com convenção BEM estrita (\`.ibid-bloco__elemento--modificador\`).
- **Biblioteca de Ícones:** Todos os ícones SVG residem em \`public/icons/\` e são tipados estritamente via \`IbidIconName\`.

## 📦 Como Outros Projetos Devem Usar Este Repositório
1. **Referência de Design & Tokens:** Os projetos sob \`~/Projects/\` devem replicar ou importar a arquitetura de \`ibid-ui\`.
2. **Visualização no Storybook:**
   - Para inspecionar componentes isolados: \`npm run storybook\` (Porto 6006).
   - Para inspecionar a aplicação completa de Showcase: \`npm start\` (Porto 4200).

## 💎 Padrões de Código & IA
- TypeScript estrito: Proibido \`any\`, uso de readonly e union types.
- Zero comentários em português no código (apenas inglês).
- Micro-passos incrementais de 12 a 20 ficheiros.
- Gestão exclusiva de Git pelo utilizador (Conventional Commits).
`;

writeFile(path.join(ROOT, '.agents/AGENTS.md'), agentsMdContent);

const currentMdContent = `# .agents/current.md - ibid-ui Work Plan

## 📌 Estado Atual: Fase 1 Concluída (Repositório & Base Estabelecida)

- [x] Repositório inicializado em \`~/Projects/ibid-ui\`
- [x] Arquitetura ITCSS completa (\`src/styles/\`) e tokens corporativos
- [x] Catálogo de 132 ícones line art tipados (\`IbidIconName\`)
- [x] Componentes atómicos de base (\`ibid-icon\`, \`ibid-button\`, \`ibid-badge\`, \`ibid-card\`, \`ibid-header\`)
- [x] Storybook configurado com galeria interativa de ícones e histórias
- [x] Aplicação Showcase viva em \`src/app/showcase.component.ts\`
- [x] Governança de IA com \`.agents/AGENTS.md\`
`;

writeFile(path.join(ROOT, '.agents/current.md'), currentMdContent);

// Copy key skills safely
const skillsToCopy = ['design-system-specialist', 'code-auditor', 'qa-tester', 'solution-architect'];
for (const skill of skillsToCopy) {
  const srcSkill = path.join('/Users/alexsantos/Projects/SavvyJar/.agents/skills', skill);
  const destSkill = path.join(ROOT, '.agents/skills', skill);
  if (fs.existsSync(srcSkill)) {
    fs.cpSync(srcSkill, destSkill, { recursive: true });
  }
}

// 13. Readme
const readmeContent = `# ibid UI Design System & Component Library

Design System oficial da marca **ibid** com estética *Line Art*, arquitetura ITCSS, componentes Angular modernos e ambiente Storybook integrado.

## 🚀 Como Iniciar

### Iniciar Aplicação Showcase
\`\`\`bash
npm install
npm start
\`\`\`
Abre [http://localhost:4200](http://localhost:4200) para ver o Showcase completo.

### Iniciar Storybook Interativo
\`\`\`bash
npm run storybook
\`\`\`
Abre [http://localhost:6006](http://localhost:6006) para explorar a galeria de ícones e componentes isolados.

## 🏛️ Estrutura
- \`src/app/components/atoms/\`: Átomos (\`ibid-button\`, \`ibid-icon\`, \`ibid-badge\`).
- \`src/app/components/molecules/\`: Moléculas (\`ibid-card\`).
- \`src/app/components/organisms/\`: Organismos (\`ibid-header\`).
- \`src/styles/\`: Arquitetura ITCSS global (tokens, hand-drawn clip-paths, reset).
- \`public/icons/\`: 132 ícones SVG line art (512x512).
`;

writeFile(path.join(ROOT, 'README.md'), readmeContent);

console.log('✅ Setup do ibid-ui concluído com sucesso!');
