/**
 * Routes
 */

import Home from '@/pages/Home.svelte';
import Handbook from '@/pages/Handbook.svelte';
import About from '@/pages/About.svelte';
import PopupArticle from '@/components/Ui/PopupArticle.svelte';

// Router params (paths, components & etc.)
export const routes = [
  {
    path: '/',
    component: Home,
  },
  {
    path: '/handbook',
    component: Handbook,
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
