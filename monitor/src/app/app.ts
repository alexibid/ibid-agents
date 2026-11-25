import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MonitorGateway } from './application/monitor-gateway';
import { LimitsStore } from './application/records-stores';
import { menuBarTextOf } from './domain/menu-bar';
import { MenuBar } from './infrastructure/menu-bar';
import { EngineStrip } from './ui/organisms/engine-strip';
import { LimitsStrip } from './ui/organisms/limits-strip';

const SCREENS = [
  { path: '/quadro', label: 'Quadro', exact: false },
  { path: '/', label: 'Pedidos', exact: true },
  { path: '/agentes', label: 'Agentes', exact: false },
  { path: '/telemetria', label: 'Telemetria', exact: false },
  { path: '/erros', label: 'Erros', exact: false },
  { path: '/planos', label: 'Planos', exact: false },
  { path: '/backlog', label: 'Backlog', exact: false },
] as const;

@Component({
  selector: 'monitor-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EngineStrip, LimitsStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly gateway = inject(MonitorGateway);
  protected readonly screens = SCREENS;

  constructor() {
    const limits = inject(LimitsStore).limits;
    const menuBar = inject(MenuBar);
    effect(() => menuBar.show(menuBarTextOf(limits())));
  }
}
