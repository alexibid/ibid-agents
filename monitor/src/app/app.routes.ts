import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./ui/pages/prompts-page').then((page) => page.PromptsPage) },
  { path: 'pedido/:promptId', loadComponent: () => import('./ui/pages/prompt-page').then((page) => page.PromptPage) },
  { path: 'agentes', loadComponent: () => import('./ui/pages/agents-page').then((page) => page.AgentsPage) },
  { path: 'telemetria', loadComponent: () => import('./ui/pages/telemetry-page').then((page) => page.TelemetryPage) },
  { path: 'erros', loadComponent: () => import('./ui/pages/problems-page').then((page) => page.ProblemsPage) },
  { path: 'planos', loadComponent: () => import('./ui/pages/plans-page').then((page) => page.PlansPage) },
  { path: 'backlog', loadComponent: () => import('./ui/pages/backlog-page').then((page) => page.BacklogPage) },
  { path: 'memoria', redirectTo: 'planos' },
  { path: '**', redirectTo: '' },
];
