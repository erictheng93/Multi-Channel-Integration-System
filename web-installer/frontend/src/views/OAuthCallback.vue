<template>
  <div class="oauth-callback">
    <div class="container container-sm">
      <div class="callback-card">
        <div v-if="isLoading" class="callback-loading">
          <div class="spinner-large"></div>
          <h2>Connecting to Cloudflare...</h2>
          <p>Please wait while we verify your authorization</p>
        </div>

        <div v-else-if="error" class="callback-error">
          <div class="error-icon">❌</div>
          <h2>Authorization Failed</h2>
          <p class="error-message">{{ error }}</p>
          <button @click="goBack" class="btn btn-primary">
            ← Back to Home
          </button>
        </div>

        <div v-else-if="success" class="callback-success">
          <div class="success-icon">✓</div>
          <h2>Successfully Connected!</h2>
          <p>Redirecting to configuration...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { oauthAPI } from '@/api/installer';
import type { RouteParams } from '@/types';

// ========================================
// COMPOSABLES
// ========================================

const router = useRouter();
const route = useRoute();

// ========================================
// STATE
// ========================================

const isLoading = ref(true);
const success = ref(false);
const error = ref<string | null>(null);

// ========================================
// LIFECYCLE
// ========================================

onMounted(async () => {
  await handleOAuthCallback();
});

// ========================================
// METHODS
// ========================================

async function handleOAuthCallback(): Promise<void> {
  try {
    // Extract query parameters
    const code = route.query.code as string;
    const state = route.query.state as string;
    const errorParam = route.query.error as string;
    const errorDescription = route.query.error_description as string;

    // Check for OAuth errors
    if (errorParam) {
      throw new Error(errorDescription || errorParam);
    }

    // Validate required parameters
    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    // Retrieve stored OAuth data from session storage
    const storedState = sessionStorage.getItem('oauth_state');
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    const redirectUri = sessionStorage.getItem('oauth_redirect_uri');

    // Validate state to prevent CSRF attacks
    if (state !== storedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    if (!codeVerifier || !redirectUri) {
      throw new Error('Missing OAuth session data. Please try again from the beginning.');
    }

    // Exchange authorization code for access token
    const response = await oauthAPI.exchangeToken({
      code,
      state,
      codeVerifier,
      redirectUri
    });

    // Store access token and user data in session storage
    sessionStorage.setItem('oauth_token', response.accessToken);
    sessionStorage.setItem('user_email', response.user.email);

    // If user has multiple accounts, let them choose
    if (response.accounts && response.accounts.length > 0) {
      // For simplicity, use the first account
      // In production, you might want to show an account selector
      sessionStorage.setItem('account_id', response.accounts[0].id);
      sessionStorage.setItem('account_name', response.accounts[0].name);
    }

    // Clean up OAuth session data
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_redirect_uri');

    // Mark as successful
    success.value = true;
    isLoading.value = false;

    // Redirect to configuration page after short delay
    setTimeout(() => {
      router.push({ name: 'configure' });
    }, 1500);

  } catch (err) {
    console.error('OAuth callback error:', err);
    error.value = err instanceof Error ? err.message : 'Failed to complete authorization';
    isLoading.value = false;

    // Clean up session storage on error
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_redirect_uri');
  }
}

function goBack(): void {
  router.push({ name: 'landing' });
}
</script>

<style scoped>
.oauth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
}

.callback-card {
  width: 100%;
  max-width: 500px;
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl);
  box-shadow: var(--shadow-xl);
  text-align: center;
}

.callback-loading,
.callback-error,
.callback-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

/* Loading State */
.spinner-large {
  width: 60px;
  height: 60px;
  border: 4px solid var(--color-gray-200);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.callback-loading h2 {
  margin: 0;
  color: var(--color-gray-900);
}

.callback-loading p {
  margin: 0;
  color: var(--color-gray-600);
}

/* Error State */
.error-icon {
  font-size: 4rem;
}

.callback-error h2 {
  margin: 0;
  color: var(--color-error);
}

.error-message {
  margin: 0;
  padding: var(--spacing-md);
  background: var(--color-gray-100);
  border-radius: var(--radius-md);
  color: var(--color-gray-700);
  font-size: var(--font-size-sm);
}

/* Success State */
.success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  font-size: 3rem;
  color: white;
  background: var(--gradient-success);
  border-radius: 50%;
  animation: successPulse 0.6s ease;
}

@keyframes successPulse {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.callback-success h2 {
  margin: 0;
  color: var(--color-success);
}

.callback-success p {
  margin: 0;
  color: var(--color-gray-600);
}
</style>
