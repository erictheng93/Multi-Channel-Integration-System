// Validation utilities for installer
export interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  custom?: (value: string) => boolean;
  message?: string;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result type for route handlers
 * This is the format expected by deployment.ts routes
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const ValidationRules: ValidationRules = {
  projectName: {
    required: true,
    pattern: /^[a-z0-9-]{3,50}$/,
    message: 'Project name must be 3-50 characters, lowercase letters, numbers, and hyphens only'
  },
  adminEmail: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  customDomain: {
    required: false,
    pattern: /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i,
    message: 'Please enter a valid domain (e.g., crm.yourcompany.com)'
  }
};

export function validateField(
  fieldName: string,
  value: string,
  rules: ValidationRules
): ValidationError | null {
  const rule = rules[fieldName];

  if (!rule) {
    return null;
  }

  // Check required
  if (rule.required && !value.trim()) {
    return {
      field: fieldName,
      message: `${fieldName} is required`
    };
  }

  // Check pattern (only if value is provided)
  if (value.trim() && rule.pattern && !rule.pattern.test(value)) {
    return {
      field: fieldName,
      message: rule.message || `${fieldName} is invalid`
    };
  }

  // Check minLength
  if (rule.minLength && value.length < rule.minLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${rule.minLength} characters`
    };
  }

  // Check maxLength
  if (rule.maxLength && value.length > rule.maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at most ${rule.maxLength} characters`
    };
  }

  // Custom validation
  if (rule.custom && !rule.custom(value)) {
    return {
      field: fieldName,
      message: rule.message || `${fieldName} is invalid`
    };
  }

  return null;
}

export function validateAll(
  data: Record<string, string>,
  rules: ValidationRules
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const fieldName in rules) {
    const value = data[fieldName] || '';
    const error = validateField(fieldName, value, rules);

    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

// Specific validation helper functions that return ValidationResult format
// This is the format expected by deployment.ts route validators

/**
 * Validate project name and return result in route-compatible format
 */
export function validateProjectName(projectName: string): ValidationResult {
  const error = validateField('projectName', projectName, ValidationRules);
  return {
    valid: error === null,
    error: error?.message
  };
}

/**
 * Validate email and return result in route-compatible format
 */
export function validateEmail(email: string): ValidationResult {
  const error = validateField('adminEmail', email, ValidationRules);
  return {
    valid: error === null,
    error: error?.message
  };
}

/**
 * Validate custom domain and return result in route-compatible format
 */
export function validateCustomDomain(domain: string): ValidationResult {
  const error = validateField('customDomain', domain, ValidationRules);
  return {
    valid: error === null,
    error: error?.message
  };
}
