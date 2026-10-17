import { mount } from 'svelte';

// Capacitor
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

import { getThemeManager } from '@/lib/theme/themeManager';

import appLogo from '@/assets/icons/app-icon.png';
import './App.css';
import App from './App.svelte';

import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mainLogger = createLogger('Main');

/**
 * Apply the stored/system theme before the first paint. A failure is not fatal: the app starts
 * in the default theme rather than not at all.
 */
async function initTheme() {
  try {
    await getThemeManager().init();
  } catch (error) {
    IS_DEBUG && mainLogger.error('Theme init failed, starting with the default theme:', error);
  }
}

/**
 * Name and version shown in the app: the installed app's on a device (one bridge call), the
 * build's on the web — and the build's as a fallback if the device can't tell.
 * @returns {Promise<{ name: string, version: string }>}
 */
async function resolveAppInfo() {
  const buildInfo = { name: __APP_NAME__ ?? 'dev', version: __APP_VERSION__ ?? 'dev' };
  if (!Capacitor.isNativePlatform()) return buildInfo;

  try {
    const { name, version } = await CapApp.getInfo();
    return { name, version };
  } catch (error) {
    IS_DEBUG && mainLogger.error('App info unavailable, using the build values:', error);
    return buildInfo;
  }
}

async function bootstrap() {
  try {
    await initTheme();
    const { name: appName, version } = await resolveAppInfo();

    // Svelte app mount
    return mount(App, {
      target: document.getElementById('app'),
      props: {
        version,
        appName,
        appLogo,
      },
    });
  } catch (error) {
    IS_DEBUG && mainLogger.error('Bootstrap failed:', error);
  } finally {
    // capacitor.config.json has launchAutoHide: false — nothing else hides the native splash, so it
    // is hidden whatever happened above, or the user would be stuck on it for good
    await SplashScreen.hide().catch((error) => IS_DEBUG && mainLogger.error('Splash hide failed:', error));
  }
}

bootstrap();
