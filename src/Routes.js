/**
 * Routes
 */

import Handbook from '@/pages/Handbook.svelte';
import Map from '@/pages/Map.svelte';
import About from '@/pages/About.svelte';
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
