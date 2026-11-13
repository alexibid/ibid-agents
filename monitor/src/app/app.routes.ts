import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./ui/pages/prompts-page').then((page) => page.PromptsPage) },
  { path: 'pedido/:promptId', loadComponent: () => import('./ui/pages/prompt-page').then((page) => page.PromptPage) },
  { path: 'telemetria', loadComponent: () => import('./ui/pages/telemetry-page').then((page) => page.TelemetryPage) },
  { path: 'erros', loadComponent: () => import('./ui/pages/problems-page').then((page) => page.ProblemsPage) },
  { path: 'memoria', loadComponent: () => import('./ui/pages/memory-page').then((page) => page.MemoryPage) },
  { path: '**', redirectTo: '' },
];
