/**
 * Routes
 *
 * See this https://github.com/mateothegreat/svelte5-router/blob/main/docs/getting-started.md
 */

import Handbook from '@/views/Handbook.svelte';
import Map from '@/views/Map.svelte';
import About from '@/views/About.svelte';
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
    path: /^\/articles\/(.+)$/,
    component: PopupArticle,
  },
];
