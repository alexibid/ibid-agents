import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localePortuguese from '@angular/common/locales/pt-PT';
import { type ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { MonitorGateway } from './application/monitor-gateway';
import { HttpMonitorGateway } from './infrastructure/http-monitor-gateway';

registerLocaleData(localePortuguese);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    { provide: LOCALE_ID, useValue: 'pt-PT' },
    { provide: MonitorGateway, useClass: HttpMonitorGateway },
  ],
};
