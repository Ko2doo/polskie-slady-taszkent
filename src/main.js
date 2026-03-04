import { mount } from 'svelte';
import { SplashScreen } from '@capacitor/splash-screen';

import { getThemeManager } from '@/lib/theme/themeManager';

import './App.css';
import App from './App.svelte';

async function bootstrap() {
  // Theme init
  await getThemeManager().init();

  // Svelte app mount
  const app = mount(App, {
    target: document.getElementById('app'),
  });

  // hide system splash
  await SplashScreen.hide();

  return app;
}

bootstrap();
