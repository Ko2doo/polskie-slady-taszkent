/**
 * Routes
 *
 * See this https://github.com/mateothegreat/svelte5-router/blob/main/docs/getting-started.md
 */

import Handbook from '@/views/Handbook/Handbook.svelte';
import Map from '@/views/Map/Map.svelte';
import About from '@/views/About/About.svelte';
import Settings from '@/views/Settings/Settings.svelte';
import PopupArticle from '@/components/Ui/PopupArticle.svelte';

// Router params (paths, components & etc.)
export const routes = [
  {
    path: '/',
    component: Handbook,
  },
  {
    path: '/map',
    component: Map,
  },
  {
    path: '/about',
    component: About,
  },
  {
    path: '/settings',
    component: Settings,
  },
  {
    path: /^\/articles\/(.+)$/,
    component: PopupArticle,
  },
];
