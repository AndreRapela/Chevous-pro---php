import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeFr from '@angular/common/locales/fr';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

registerLocaleData(localeEn);
registerLocaleData(localeFr);

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error('ChezVoust Pro could not be started.', error);
});
