<template>
  <div class="form-step">
    <h2>LINE OA Configuration</h2>

    <div class="integration-note">
      <div class="note-icon">&#x2139;&#xFE0F;</div>
      <div class="note-content">
        <strong>How to get LINE credentials:</strong>
        <ol>
          <li>Go to <a href="https://developers.line.biz/console/" target="_blank">LINE Developers Console</a></li>
          <li>Create or select a Messaging API channel</li>
          <li>Copy the Channel Access Token, Channel Secret, and Bot ID</li>
          <li>(Optional) Create a LIFF app for team binding feature</li>
        </ol>
      </div>
    </div>

    <!-- LINE Bot ID -->
    <div class="form-group">
      <label for="lineBotId" class="form-label">
        LINE Bot ID (Basic ID)
        <span v-if="!skipLineConfig" class="badge badge-required">Required</span>
        <span v-else class="badge badge-optional">Optional</span>
        <span class="form-hint">Format: @xxxxxxxxx</span>
      </label>
      <input
        id="lineBotId"
        :value="formData.lineBotId"
        type="text"
        class="form-input"
        :class="{
          error: errors.lineBotId,
          'is-valid': formData.lineBotId && /^@[a-z0-9]+$/.test(formData.lineBotId)
        }"
        placeholder="@110xsqef"
        pattern="^@[a-z0-9]+$"
        :required="formData.enableLineIntegration && !skipLineConfig"
        @input="onFieldInput('lineBotId', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="errors.lineBotId" class="form-error">
        {{ errors.lineBotId }}
      </div>
      <div class="form-hint">
        &#x1F4CC; Required for QR Code generation. Find it in <strong>Channel Settings &#x2192; Basic settings</strong>
      </div>

      <!-- Phase 2: Inline Help -->
      <div class="help-section">
        <button type="button" @click="toggleHelp('lineBotId')" class="help-toggle">
          <span class="help-icon">&#x2139;&#xFE0F;</span>
          <span>How to find LINE Bot ID?</span>
          <span class="help-arrow">{{ showHelp.lineBotId ? '\u25BC' : '\u25B6' }}</span>
        </button>
        <div v-show="showHelp.lineBotId" class="help-content">
          <h4>Finding Your LINE Bot ID (Basic ID)</h4>
          <ol class="help-steps">
            <li>Go to <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console</a></li>
            <li>Select your <strong>Provider</strong> (or create one if needed)</li>
            <li>Select your <strong>Messaging API Channel</strong></li>
            <li>Navigate to <strong>Channel Settings</strong> &#x2192; <strong>Basic settings</strong> tab</li>
            <li>Look for <strong>Basic ID</strong> section</li>
            <li>Copy the ID that starts with <code>@</code></li>
          </ol>
          <div class="help-example">
            <strong>Example:</strong> <code>@110xsqef</code>
          </div>
          <div class="help-note">
            &#x1F4DD; <strong>Note:</strong> The Basic ID is different from the Channel ID (numeric). Make sure to copy the one that starts with @.
          </div>
        </div>
      </div>
    </div>

    <!-- LINE Channel Access Token -->
    <div class="form-group">
      <label for="lineChannelAccessToken" class="form-label">
        Channel Access Token
        <span v-if="formData.enableLineIntegration" class="badge badge-required">Required</span>
        <span v-else class="badge badge-optional">Optional</span>
      </label>
      <div class="input-with-toggle">
        <input
          id="lineChannelAccessToken"
          :value="formData.lineChannelAccessToken"
          :type="showLineToken ? 'text' : 'password'"
          class="form-input"
          :class="{
            error: errors.lineChannelAccessToken,
            'is-valid': formData.lineChannelAccessToken && formData.lineChannelAccessToken.length > 0
          }"
          placeholder="Enter your LINE Channel Access Token"
          :required="formData.enableLineIntegration"
          @input="onFieldInput('lineChannelAccessToken', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="toggle-visibility"
          @click="showLineToken = !showLineToken"
        >
          {{ showLineToken ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F' }}
        </button>
      </div>
      <div v-if="errors.lineChannelAccessToken" class="form-error">
        {{ errors.lineChannelAccessToken }}
      </div>
    </div>

    <!-- LINE Channel Secret -->
    <div class="form-group">
      <label for="lineChannelSecret" class="form-label">
        Channel Secret
        <span v-if="formData.enableLineIntegration" class="badge badge-required">Required</span>
        <span v-else class="badge badge-optional">Optional</span>
      </label>
      <div class="input-with-toggle">
        <input
          id="lineChannelSecret"
          :value="formData.lineChannelSecret"
          :type="showLineSecret ? 'text' : 'password'"
          class="form-input"
          :class="{
            error: errors.lineChannelSecret,
            'is-valid': formData.lineChannelSecret && formData.lineChannelSecret.length > 0
          }"
          placeholder="Enter your LINE Channel Secret"
          :required="formData.enableLineIntegration"
          @input="onFieldInput('lineChannelSecret', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="toggle-visibility"
          @click="showLineSecret = !showLineSecret"
        >
          {{ showLineSecret ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F' }}
        </button>
      </div>
      <div v-if="errors.lineChannelSecret" class="form-error">
        {{ errors.lineChannelSecret }}
      </div>
    </div>

    <!-- LINE LIFF ID -->
    <div class="form-group">
      <label for="lineLiffId" class="form-label">
        LINE LIFF ID
        <span class="badge badge-optional">Optional</span>
        <span class="form-hint">Required for team binding feature</span>
      </label>
      <input
        id="lineLiffId"
        :value="formData.lineLiffId"
        type="text"
        class="form-input"
        :class="{
          error: errors.lineLiffId,
          'is-valid': formData.lineLiffId && formData.lineLiffId.length >= 10
        }"
        placeholder="2008756115-vWtFyDMA"
        @input="onFieldInput('lineLiffId', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="errors.lineLiffId" class="form-error">
        {{ errors.lineLiffId }}
      </div>
      <div v-if="formData.lineLiffId" class="char-counter" :class="{
        danger: formData.lineLiffId.length < 10
      }">
        {{ formData.lineLiffId.length }} characters (min 10)
      </div>
      <div class="form-hint">
        &#x1F4A1; Create a LIFF app in <strong>LINE Developers Console &#x2192; LIFF tab</strong>
      </div>

      <div class="help-section">
        <button type="button" @click="toggleHelp('lineLiffId')" class="help-toggle">
          <span class="help-icon">&#x2139;&#xFE0F;</span>
          <span>How to create and find LINE LIFF ID?</span>
          <span class="help-arrow">{{ showHelp.lineLiffId ? '\u25BC' : '\u25B6' }}</span>
        </button>
        <div v-show="showHelp.lineLiffId" class="help-content">
          <h4>Creating and Finding Your LINE LIFF ID</h4>
          <ol class="help-steps">
            <li>Go to <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console</a></li>
            <li>Select your Messaging API Channel</li>
            <li>Click on the <strong>LIFF</strong> tab in the top navigation</li>
            <li>Click <strong>Add</strong> button to create a new LIFF app</li>
            <li>Configure LIFF app settings:
              <ul>
                <li><strong>Size:</strong> Choose "Full" for best experience</li>
                <li><strong>Endpoint URL:</strong> Enter your frontend URL (will be provided after deployment)</li>
                <li><strong>Scope:</strong> Select "profile" and "openid"</li>
              </ul>
            </li>
            <li>After creation, copy the <strong>LIFF ID</strong> (format: xxxxxxxxxx-xxxxxxxx)</li>
          </ol>
          <div class="help-example">
            <strong>Example:</strong> <code>2008756115-vWtFyDMA</code>
          </div>
          <div class="help-note">
            &#x1F4DD; <strong>Note:</strong> You can create the LIFF app later and update the configuration. It's only needed for the team member binding feature.
          </div>
          <div class="help-link">
            &#x1F4DA; <a href="https://developers.line.biz/en/docs/liff/overview/" target="_blank" rel="noopener noreferrer">Learn more about LINE LIFF</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Skip LINE Configuration -->
    <div class="skip-option">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="skipLineConfig"
          @change="$emit('update:skipLineConfig', ($event.target as HTMLInputElement).checked)"
        />
        <span>Skip LINE configuration (configure later in settings)</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ConfigFormData, ConfigFormTextField } from './types';
import type { FormErrors } from '@/types';

// ========================================
// PROPS & EMITS
// ========================================

defineProps<{
  formData: ConfigFormData;
  errors: FormErrors;
  skipLineConfig: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:field', field: ConfigFormTextField, value: string): void;
  (e: 'clearError', field: keyof FormErrors): void;
  (e: 'update:skipLineConfig', value: boolean): void;
}>();

// ========================================
// LOCAL STATE
// ========================================

const showLineToken = ref(false);
const showLineSecret = ref(false);
const showHelp = ref<Record<string, boolean>>({
  lineBotId: false,
  lineLiffId: false,
});

// ========================================
// METHODS
// ========================================

function toggleHelp(field: string): void {
  showHelp.value[field] = !showHelp.value[field];
}

function onFieldInput(field: ConfigFormTextField, value: string): void {
  emit('update:field', field, value);
  emit('clearError', field as keyof FormErrors);
}
</script>

<style scoped>
/* Form Step */
.form-step h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
}

/* Form Group */
.form-group {
  margin-bottom: var(--spacing-xl);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.form-input {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-base);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input.error {
  border-color: var(--color-error);
}

.form-input.is-valid {
  border-color: #10b981;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2310b981'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25rem;
  padding-right: 3rem;
}

.form-error {
  margin-top: var(--spacing-xs);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.form-hint {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-weight: var(--font-weight-normal);
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-left: var(--spacing-xs);
  vertical-align: middle;
}

.badge-required {
  background: #fee2e2;
  color: #dc2626;
}

.badge-optional {
  background: #dbeafe;
  color: #2563eb;
}

/* Character Counter */
.char-counter {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.char-counter.danger {
  color: #dc2626;
}

/* Input with Toggle */
.input-with-toggle {
  position: relative;
  display: flex;
}

.input-with-toggle .form-input {
  padding-right: 50px;
}

.toggle-visibility {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  padding: var(--spacing-xs);
}

/* Integration Note */
.integration-note {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-primary-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.note-icon {
  font-size: 1.5em;
}

.note-content {
  flex: 1;
}

.note-content ol {
  margin: var(--spacing-sm) 0 0 var(--spacing-lg);
  padding: 0;
}

.note-content li {
  margin-bottom: var(--spacing-xs);
}

.note-content a {
  color: var(--color-primary);
  text-decoration: underline;
}

/* Skip Option */
.skip-option {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

/* Help Section */
.help-section {
  margin-top: var(--spacing-md);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.help-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-gray-50);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-gray-700);
  transition: background var(--transition-base);
}

.help-toggle:hover {
  background: var(--color-gray-100);
}

.help-icon {
  font-size: 1rem;
  color: var(--color-primary);
}

.help-arrow {
  margin-left: auto;
  color: var(--color-gray-500);
  transition: transform var(--transition-base);
  font-size: 0.75rem;
}

.help-content {
  padding: var(--spacing-md);
  background: white;
  border-top: 1px solid var(--color-gray-200);
  animation: slideIn 0.2s ease-out;
}

.help-content h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 0.9375rem;
  color: var(--color-gray-800);
  font-weight: 600;
}

.help-steps {
  margin: 0 0 var(--spacing-md) 0;
  padding-left: var(--spacing-lg);
  color: var(--color-gray-700);
  font-size: 0.875rem;
  line-height: 1.6;
}

.help-steps li {
  margin-bottom: var(--spacing-xs);
}

.help-steps ul {
  margin-top: var(--spacing-xs);
  padding-left: var(--spacing-lg);
}

.help-example {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-gray-100);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  margin-bottom: var(--spacing-sm);
}

.help-example code {
  padding: 0.125rem 0.375rem;
  background: white;
  border-radius: var(--radius-sm);
  font-family: 'Courier New', monospace;
  color: var(--color-primary);
}

.help-note {
  padding: var(--spacing-sm) var(--spacing-md);
  background: #dbeafe;
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-gray-700);
  margin-bottom: var(--spacing-sm);
}

.help-link {
  font-size: 0.875rem;
  color: var(--color-gray-700);
}

.help-link a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.help-link a:hover {
  text-decoration: underline;
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
