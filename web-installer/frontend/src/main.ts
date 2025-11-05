/**
 * Main Application Entry Point
 *
 * Initializes Vue 3, Pinia, Router, and global styles
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './assets/styles/global.css';

// Create Vue application
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);

// Mount application
app.mount('#app');

// Development logging
if (import.meta.env.DEV) {
  console.log('🚀 CRM Web Installer started in development mode');
  console.log('📦 Environment:', import.meta.env.MODE);
}
