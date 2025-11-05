/**
 * Vue Router Configuration
 *
 * Defines routes and navigation logic for the Web Installer
 */

import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// ========================================
// ROUTE DEFINITIONS
// ========================================

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingPage.vue'),
    meta: {
      title: 'CRM Installer - Deploy in Minutes'
    }
  },
  {
    path: '/oauth/callback',
    name: 'oauth-callback',
    component: () => import('@/views/OAuthCallback.vue'),
    meta: {
      title: 'Connecting to Cloudflare...'
    }
  },
  {
    path: '/configure',
    name: 'configure',
    component: () => import('@/views/ConfigForm.vue'),
    meta: {
      title: 'Configure Your CRM',
      requiresAuth: true
    }
  },
  {
    path: '/deploy/:projectName',
    name: 'deploy',
    component: () => import('@/views/DeployProgress.vue'),
    meta: {
      title: 'Deployment in Progress...',
      requiresAuth: true
    },
    props: true
  },
  {
    path: '/success/:projectName',
    name: 'success',
    component: () => import('@/views/SuccessPage.vue'),
    meta: {
      title: 'Deployment Successful!'
    },
    props: true
  },
  {
    path: '/error',
    name: 'error',
    component: () => import('@/views/ErrorPage.vue'),
    meta: {
      title: 'Deployment Failed'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

// ========================================
// ROUTER INSTANCE
// ========================================

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  }
});

// ========================================
// NAVIGATION GUARDS
// ========================================

router.beforeEach((to, from, next) => {
  // Update document title
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }

  // Check authentication requirement
  if (to.meta.requiresAuth) {
    const oauthToken = sessionStorage.getItem('oauth_token');
    const accountId = sessionStorage.getItem('account_id');

    if (!oauthToken || !accountId) {
      // Redirect to landing page if not authenticated
      next({ name: 'landing' });
      return;
    }
  }

  next();
});

export default router;
