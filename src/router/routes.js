// Route table. Add new pages here, keep this file readable.

import { useAuthStore } from 'src/stores/auth';

// Guard for DM-only routes. Runs after the auth store is hydrated.
function requireDM(to, from, next) {
  const auth = useAuthStore();
  if (auth.actualBucket === 'dm') return next();
  // Anyone else gets sent home. Unsigned users land on landing.
  if (auth.user) return next({ name: 'home' });
  return next({ name: 'landing' });
}

const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '',      name: 'home',  component: () => import('pages/HomePage.vue') },
      { path: 'notes', name: 'notes', component: () => import('pages/NotesPage.vue') },
      {
        path: 'dm',
        name: 'dm',
        component: () => import('pages/DmPage.vue'),
        beforeEnter: requireDM
      },
      {
        path: 'admin/usage',
        name: 'admin-usage',
        component: () => import('pages/AdminUsagePage.vue'),
        beforeEnter: requireDM
      }
    ]
  },
  {
    path: '/landing',
    name: 'landing',
    component: () => import('pages/LandingPage.vue')
  },
  // Legacy redirects — old bookmarks of /sessions or /threads land on Notes.
  { path: '/sessions', redirect: { name: 'notes' } },
  { path: '/threads',  redirect: { name: 'notes' } },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/NotFoundPage.vue')
  }
];

export default routes;
