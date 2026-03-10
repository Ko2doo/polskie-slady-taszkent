/**
 * Routes
 *
 * See this https://github.com/mateothegreat/svelte5-router/blob/main/docs/getting-started.md
 */

import Handbook from '@/views/Handbook/Handbook.svelte';
import Map from '@/views/Map/Map.svelte';
import More from '@/views/More/More.svelte';
import Settings from '@/views/Settings/Settings.svelte';
import About from '@/views/About/About.svelte';
import TechnicalInfo from '@/views/TechnicalInfo/TechnicalInfo.svelte';
import PopupArticle from '@/components/PopupArticle.svelte';

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
    path: '/more',
    component: More,
  },
  {
    path: '/settings',
    component: Settings,
  },
  {
    path: '/about',
    component: About,
  },
  {
    path: '/technical-info',
    component: TechnicalInfo,
  },
  {
    path: /^\/articles\/(.+)$/,
    component: PopupArticle,
  },
];
