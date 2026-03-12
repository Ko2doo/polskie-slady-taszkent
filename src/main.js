import { mount } from 'svelte';

// Capacitor
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

import { getThemeManager } from '@/lib/theme/themeManager';

import './App.css';
import App from './App.svelte';

async function bootstrap() {
  // Theme init
  await getThemeManager().init();

  /* prettier-ignore */
  const version = Capacitor.isNativePlatform()
    ? (await CapApp.getInfo()).version
    : __APP_VERSION__ ?? "dev";

  /* prettier-ignore */
  const appName = Capacitor.isNativePlatform()
    ? (await CapApp.getInfo()).name
    : __APP_NAME__ ?? 'dev';

  // Svelte app mount
  const app = mount(App, {
    target: document.getElementById('app'),
    props: {
      version,
      appName,
    },
  });

  // hide system splash
  await SplashScreen.hide();

  return app;
}

bootstrap();
