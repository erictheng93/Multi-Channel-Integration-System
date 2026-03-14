<template>
  <div class="credentials-box">
    <div class="credentials-header">
      <h3 class="credentials-title">
        <span class="credentials-icon"></span>
        Admin Credentials
      </h3>
      <span class="credentials-badge">Important - Save These!</span>
    </div>

    <div class="credentials-warning">
       <strong>Important:</strong> Save these credentials now. They won't be shown again!
    </div>

    <div class="credentials-list">
      <div class="credential-item">
        <label class="credential-label">Username</label>
        <div class="credential-value-group">
          <input
            :value="credentials.username"
            readonly
            class="credential-value"
            ref="usernameInput"
          />
          <button @click="copyToClipboard(credentials.username, 'username')" class="btn-copy">
            {{ copiedField === 'username' ? ' Copied' : ' Copy' }}
          </button>
        </div>
      </div>

      <div class="credential-item">
        <label class="credential-label">Password</label>
        <div class="credential-value-group">
          <input
            :type="showPassword ? 'text' : 'password'"
            :value="credentials.password"
            readonly
            class="credential-value"
            ref="passwordInput"
          />
          <button @click="togglePassword" class="btn-toggle">
            {{ showPassword ? ' Hide' : ' Show' }}
          </button>
          <button @click="copyToClipboard(credentials.password, 'password')" class="btn-copy">
            {{ copiedField === 'password' ? ' Copied' : ' Copy' }}
          </button>
        </div>
      </div>

      <div class="credential-item">
        <label class="credential-label">Email</label>
        <div class="credential-value-group">
          <input
            :value="credentials.email"
            readonly
            class="credential-value"
            ref="emailInput"
          />
          <button @click="copyToClipboard(credentials.email, 'email')" class="btn-copy">
            {{ copiedField === 'email' ? ' Copied' : ' Copy' }}
          </button>
        </div>
      </div>
    </div>

    <div class="credentials-actions">
      <button @click="downloadCredentials" class="btn btn-secondary btn-sm">
         Download as Text File
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AdminCredentials } from '@/types';

// ========================================
// PROPS
// ========================================

interface Props {
  credentials: AdminCredentials;
}

const props = defineProps<Props>();

// ========================================
// STATE
// ========================================

const showPassword = ref(false);
const copiedField = ref<string | null>(null);

// ========================================
// METHODS
// ========================================

function togglePassword(): void {
  showPassword.value = !showPassword.value;
}

async function copyToClipboard(text: string, field: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;

    // Reset after 2 seconds
    setTimeout(() => {
      copiedField.value = null;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    alert('Failed to copy to clipboard. Please copy manually.');
  }
}

function downloadCredentials(): void {
  const content = `
CRM Admin Credentials
=====================

Username: ${props.credentials.username}
Password: ${props.credentials.password}
Email: ${props.credentials.email}

Generated: ${new Date().toLocaleString()}

 IMPORTANT: Keep these credentials secure and do not share them with unauthorized users.
  `.trim();

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'crm-admin-credentials.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.credentials-box {
  background: white;
  border: 2px solid var(--color-warning);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-lg);
}

.credentials-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.credentials-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--color-gray-900);
}

.credentials-icon {
  font-size: var(--font-size-2xl);
}

.credentials-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-warning);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  border-radius: var(--radius-full);
}

.credentials-warning {
  padding: var(--spacing-md);
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: var(--radius-md);
  color: #856404;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.credentials-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.credential-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.credential-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-700);
}

.credential-value-group {
  display: flex;
  gap: var(--spacing-sm);
}

.credential-value {
  flex: 1;
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-md);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  color: var(--color-gray-900);
}

.btn-toggle,
.btn-copy {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: white;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-toggle:hover,
.btn-copy:hover {
  background: var(--color-gray-50);
  border-color: var(--color-primary);
}

.credentials-actions {
  display: flex;
  justify-content: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-gray-200);
}

@media (max-width: 768px) {
  .credential-value-group {
    flex-wrap: wrap;
  }

  .credential-value {
    width: 100%;
  }

  .btn-toggle,
  .btn-copy {
    flex: 1;
  }
}
</style>
