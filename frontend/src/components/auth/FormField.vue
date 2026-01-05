<template>
  <div class="field-group">
    <div
      class="field-wrapper"
      :class="{
        'is-focused': isFocused,
        'has-value': modelValue,
        'has-error': showError
      }"
    >
      <input
        :id="id"
        :value="modelValue"
        :type="computedType"
        class="field-input"
        placeholder=" "
        :autocomplete="autocomplete"
        :required="required"
        :disabled="disabled"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      >
      <label
        :for="id"
        class="field-label"
      >{{ label }}</label>

      <!-- Password Visibility Toggle -->
      <button
        v-if="type === 'password'"
        type="button"
        class="visibility-toggle"
        :disabled="disabled"
        @click="toggleVisibility"
      >
        <svg
          v-if="!showPassword"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle
            cx="12"
            cy="12"
            r="3"
          />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line
            x1="2"
            x2="22"
            y1="2"
            y2="22"
          />
        </svg>
      </button>

      <div class="field-line" />
    </div>

    <Transition name="error-reveal">
      <span
        v-if="showError"
        class="field-error"
      >{{ error }}</span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  id: string
  label: string
  type?: 'text' | 'email' | 'password'
  modelValue: string
  error?: string | null
  touched?: boolean
  submitted?: boolean
  autocomplete?: string
  required?: boolean
  disabled?: boolean
}

interface Emits {
  (_e: 'update:modelValue', _value: string): void
  (_e: 'focus'): void
  (_e: 'blur'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  error: null,
  touched: false,
  submitted: false,
  autocomplete: 'off',
  required: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const isFocused = ref(false)
const showPassword = ref(false)

const computedType = computed(() => {
  if (props.type === 'password') {
    return showPassword.value ? 'text' : 'password'
  }
  return props.type
})

const showError = computed(() =>
  (props.touched || props.submitted) && props.error
)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
}

const toggleVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<style scoped>
/* Field Group */
.field-group {
  position: relative;
}

/* Field Wrapper */
.field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  height: 56px;
  background: transparent;
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
}

/* Field Input */
.field-input {
  width: 100%;
  height: 100%;
  padding: 24px 16px 8px;
  font-family: var(--font-text, -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: 17px;
  font-weight: 400;
  color: var(--text-primary, #f5f5f7);
  background: var(--input-bg, rgba(160, 160, 165, 0.08));
  border: none;
  border-radius: var(--radius-md, 12px);
  outline: none;
  transition:
    background-color 200ms ease,
    color 200ms ease;
}

.field-input::placeholder {
  color: transparent;
}

.field-input:hover {
  background: var(--input-bg-hover, rgba(160, 160, 165, 0.12));
}

.field-input:focus {
  background: var(--input-bg-focus, rgba(180, 180, 185, 0.16));
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Field Label */
.field-label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 17px;
  font-weight: 400;
  color: var(--text-secondary, #86868b);
  pointer-events: none;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.field-wrapper.is-focused .field-label,
.field-wrapper.has-value .field-label {
  top: 14px;
  transform: translateY(0);
  font-size: 12px;
  color: var(--text-tertiary, #6e6e73);
}

/* Field Line */
.field-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text-primary, #f5f5f7);
  transform: scaleX(0);
  transform-origin: center;
  transition:
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 400ms ease;
}

.field-wrapper.is-focused .field-line {
  transform: scaleX(1);
}

/* Error State */
.field-wrapper.has-error .field-input {
  background: var(--accent-error-bg, rgba(255, 69, 58, 0.1));
}

.field-wrapper.has-error .field-line {
  background: var(--accent-error, #ff453a);
  transform: scaleX(1);
}

/* Visibility Toggle */
.visibility-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 8px);
  color: var(--text-secondary, #86868b);
  cursor: pointer;
  transition: all 200ms ease;
}

.visibility-toggle:hover:not(:disabled) {
  color: var(--text-primary, #f5f5f7);
  background: var(--input-bg, rgba(160, 160, 165, 0.08));
}

.visibility-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Field Error */
.field-error {
  display: block;
  padding: 8px 0 0 16px;
  font-size: 13px;
  color: var(--accent-error, #ff453a);
}

/* Error Reveal Animation */
.error-reveal-enter-active,
.error-reveal-leave-active {
  transition: all 200ms ease;
}

.error-reveal-enter-from,
.error-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
