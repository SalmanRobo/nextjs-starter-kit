/**
 * Enhanced Zod Integration for Authentication Forms
 * Type-safe form validation with comprehensive error handling and real-time validation
 */

import { z } from 'zod';
import { 
  SignInCredentials, 
  SignUpCredentials, 
  PasswordResetRequest, 
  PasswordResetConfirmation,
  FormErrors,
  ValidationResult 
} from './types';
import { AUTH_CONFIG, VALIDATION_PATTERNS, AUTH_ERRORS } from './config';
import { getPasswordStrength, sanitizeInput } from './validation';

// === ENHANCED ZOD SCHEMAS ===

// Base email validation with enhanced security
const emailSchema = z
  .string()
  .min(1, AUTH_ERRORS.REQUIRED_FIELD)
  .email(AUTH_ERRORS.INVALID_EMAIL)
  .max(254, 'Email address is too long')
  .transform(val => sanitizeInput(val.toLowerCase()))
  .refine(email => {
    // Check for disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org', 
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email'
    ];
    const domain = email.split('@')[1];
    return !domain || !disposableDomains.includes(domain);
  }, 'Disposable email addresses are not allowed')
  .refine(email => {
    // Additional format validation
    return VALIDATION_PATTERNS.email.test(email);
  }, AUTH_ERRORS.INVALID_EMAIL);

// Enhanced password validation with strength checking
const passwordSchema = z
  .string()
  .min(AUTH_CONFIG.security.passwordMinLength, 
       AUTH_ERRORS.MIN_LENGTH(AUTH_CONFIG.security.passwordMinLength))
  .max(128, AUTH_ERRORS.MAX_LENGTH(128))
  .refine(password => {
    const { isStrong } = getPasswordStrength(password);
    return isStrong;
  }, {
    message: AUTH_ERRORS.WEAK_PASSWORD,
    path: ['password']
  });

// Name validation for international users (supports Arabic)
const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(50, 'Name must be no more than 50 characters long')
  .transform(val => sanitizeInput(val.trim()))
  .refine(name => VALIDATION_PATTERNS.name.test(name), AUTH_ERRORS.INVALID_NAME);

// Saudi phone number validation
const phoneSchema = z
  .string()
  .optional()
  .transform(val => val ? sanitizeInput(val.replace(/\s+/g, '')) : val)
  .refine(phone => {
    if (!phone) return true; // Optional field
    return VALIDATION_PATTERNS.phone.test(phone);
  }, AUTH_ERRORS.INVALID_PHONE);

// === AUTHENTICATION FORM SCHEMAS ===

// Enhanced sign-in schema with security features
export const enhancedSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, AUTH_ERRORS.REQUIRED_FIELD),
  rememberMe: z.boolean().optional().default(false),
  captchaToken: z.string().optional(),
  deviceTrust: z.boolean().optional().default(false),
}) satisfies z.ZodType<SignInCredentials>;

// Enhanced sign-up schema with comprehensive validation
export const enhancedSignUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, AUTH_ERRORS.REQUIRED_FIELD),
  fullName: nameSchema.optional(),
  phone: phoneSchema,
  acceptTerms: z.boolean().refine(val => val === true, AUTH_ERRORS.TERMS_NOT_ACCEPTED),
  subscribeNewsletter: z.boolean().optional().default(false),
  captchaToken: z.string().optional(),
  inviteCode: z.string().optional(),
  marketingConsent: z.boolean().optional().default(false),
  ageConfirmation: z.boolean().optional().refine(val => val !== false, 'You must be 18 or older to register'),
}).refine(data => data.password === data.confirmPassword, {
  message: AUTH_ERRORS.PASSWORD_MISMATCH,
  path: ['confirmPassword'],
}) satisfies z.ZodType<SignUpCredentials>;

// Password reset request schema
export const enhancedPasswordResetRequestSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
}) satisfies z.ZodType<PasswordResetRequest>;

// Password reset confirmation schema
export const enhancedPasswordResetConfirmationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, AUTH_ERRORS.REQUIRED_FIELD),
  accessToken: z.string().min(1, 'Invalid reset token'),
  refreshToken: z.string().min(1, 'Invalid reset token'),
}).refine(data => data.password === data.confirmPassword, {
  message: AUTH_ERRORS.PASSWORD_MISMATCH,
  path: ['confirmPassword'],
}) satisfies z.ZodType<PasswordResetConfirmation>;

// === REAL-TIME VALIDATION SCHEMAS ===

// Individual field schemas for real-time validation
export const fieldValidationSchemas = {
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, AUTH_ERRORS.REQUIRED_FIELD),
  fullName: nameSchema,
  phone: phoneSchema,
  acceptTerms: z.boolean().refine(val => val === true, AUTH_ERRORS.TERMS_NOT_ACCEPTED),
};

// === VALIDATION FUNCTIONS ===

// Type-safe validation with detailed error handling
export function validateWithZod<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: { skipTransform?: boolean }
): ValidationResult {
  try {
    const validatedData = schema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: FormErrors = {};
      
      error.errors.forEach(err => {
        const field = err.path[0] as keyof FormErrors;
        if (!errors[field]) errors[field] = [];
        errors[field]!.push(err.message);
      });
      
      return { isValid: false, errors };
    }
    
    return { 
      isValid: false, 
      errors: { general: ['Validation error occurred'] } 
    };
  }
}

// Enhanced form validation functions
export const validateSignInFormWithZod = (data: unknown): ValidationResult => {
  return validateWithZod(enhancedSignInSchema, data);
};

export const validateSignUpFormWithZod = (data: unknown): ValidationResult => {
  return validateWithZod(enhancedSignUpSchema, data);
};

export const validatePasswordResetRequestWithZod = (data: unknown): ValidationResult => {
  return validateWithZod(enhancedPasswordResetRequestSchema, data);
};

export const validatePasswordResetConfirmationWithZod = (data: unknown): ValidationResult => {
  return validateWithZod(enhancedPasswordResetConfirmationSchema, data);
};

// === REAL-TIME FIELD VALIDATION ===

export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  suggestions?: string[];
}

// Real-time field validation with suggestions
export function validateFieldRealTime(
  fieldName: keyof typeof fieldValidationSchemas,
  value: unknown
): FieldValidationResult {
  try {
    const schema = fieldValidationSchemas[fieldName];
    if (!schema) {
      return { isValid: false, errors: ['Unknown field'] };
    }

    schema.parse(value);
    
    // Field-specific suggestions for valid input
    const suggestions = getFieldSuggestions(fieldName, value);
    
    return { 
      isValid: true, 
      errors: [],
      suggestions 
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      const warnings = getFieldWarnings(fieldName, value);
      const suggestions = getFieldSuggestions(fieldName, value);
      
      return { 
        isValid: false, 
        errors,
        warnings,
        suggestions 
      };
    }
    
    return { 
      isValid: false, 
      errors: ['Validation error occurred'] 
    };
  }
}

// Get field-specific suggestions
function getFieldSuggestions(fieldName: string, value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;

  switch (fieldName) {
    case 'password':
      const { feedback } = getPasswordStrength(value);
      if (feedback.length > 0) {
        return ['Consider: ' + feedback.join(', ')];
      }
      return undefined;
      
    case 'email':
      if (value && !value.includes('@')) {
        return ['Email addresses must contain @ symbol'];
      }
      return undefined;
      
    case 'phone':
      if (value && !value.startsWith('+966') && !value.startsWith('05')) {
        return ['Saudi numbers should start with +966 or 05'];
      }
      return undefined;
      
    default:
      return undefined;
  }
}

// Get field-specific warnings
function getFieldWarnings(fieldName: string, value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;

  switch (fieldName) {
    case 'email':
      const commonDomains = ['gmail.com', 'outlook.com', 'yahoo.com'];
      const domain = value.split('@')[1];
      if (domain && !commonDomains.includes(domain)) {
        return ['Please double-check your email domain'];
      }
      return undefined;
      
    case 'password':
      if (value.length > 0 && value.length < 8) {
        return ['Password is shorter than recommended'];
      }
      return undefined;
      
    default:
      return undefined;
  }
}

// === ASYNC VALIDATION ===

// Async validation for fields that require server checking
export async function validateFieldAsync(
  fieldName: string,
  value: string
): Promise<FieldValidationResult> {
  // Simulate async validation (e.g., checking if email exists)
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (fieldName) {
        case 'email':
          // Simulate email availability check
          if (value === 'admin@example.com') {
            resolve({
              isValid: false,
              errors: ['This email is already registered'],
              suggestions: ['Try signing in instead', 'Use the password reset option']
            });
          } else {
            resolve({ isValid: true, errors: [] });
          }
          break;
          
        default:
          resolve({ isValid: true, errors: [] });
      }
    }, 300); // Simulate network delay
  });
}

// === FORM STATE INTEGRATION ===

// Enhanced form state with Zod validation
export class ZodFormState<TSchema extends z.ZodType> {
  private schema: TSchema;
  private _data: Partial<z.infer<TSchema>>;
  private _errors: Record<string, string[]>;
  private _touched: Record<string, boolean>;
  private _isValidating: boolean;
  private _asyncValidators: Map<string, (value: any) => Promise<FieldValidationResult>>;

  constructor(schema: TSchema, initialData?: Partial<z.infer<TSchema>>) {
    this.schema = schema;
    this._data = initialData || {};
    this._errors = {};
    this._touched = {};
    this._isValidating = false;
    this._asyncValidators = new Map();
  }

  // Set field value with validation
  setField<K extends keyof z.infer<TSchema>>(
    field: K, 
    value: z.infer<TSchema>[K]
  ): void {
    this._data[field] = value;
    this._touched[String(field)] = true;
    
    // Clear existing errors for this field
    delete this._errors[String(field)];
    
    // Validate field in real-time
    this.validateField(field);
  }

  // Validate individual field
  private validateField<K extends keyof z.infer<TSchema>>(field: K): void {
    try {
      // Extract field schema if possible
      if (this.schema instanceof z.ZodObject) {
        const fieldSchema = this.schema.shape[field as string];
        if (fieldSchema) {
          fieldSchema.parse(this._data[field]);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this._errors[String(field)] = error.errors.map(e => e.message);
      }
    }
  }

  // Validate entire form
  validate(): ValidationResult {
    return validateWithZod(this.schema, this._data);
  }

  // Get current state
  get state() {
    const validation = this.validate();
    return {
      data: this._data,
      errors: this._errors,
      touched: this._touched,
      isValid: validation.isValid,
      isValidating: this._isValidating,
      isDirty: Object.keys(this._touched).length > 0,
    };
  }

  // Reset form
  reset(newData?: Partial<z.infer<TSchema>>): void {
    this._data = newData || {};
    this._errors = {};
    this._touched = {};
    this._isValidating = false;
  }

  // Add async validator for field
  addAsyncValidator<K extends keyof z.infer<TSchema>>(
    field: K,
    validator: (value: z.infer<TSchema>[K]) => Promise<FieldValidationResult>
  ): void {
    this._asyncValidators.set(String(field), validator);
  }

  // Run async validation
  async validateAsync(): Promise<ValidationResult> {
    this._isValidating = true;
    
    try {
      // Run sync validation first
      const syncValidation = this.validate();
      if (!syncValidation.isValid) {
        return syncValidation;
      }

      // Run async validators
      const asyncResults = await Promise.all(
        Array.from(this._asyncValidators.entries()).map(async ([field, validator]) => {
          const value = this._data[field as keyof z.infer<TSchema>];
          const result = await validator(value);
          return { field, result };
        })
      );

      // Collect async errors
      const asyncErrors: FormErrors = {};
      for (const { field, result } of asyncResults) {
        if (!result.isValid) {
          asyncErrors[field as keyof FormErrors] = result.errors;
        }
      }

      if (Object.keys(asyncErrors).length > 0) {
        return { isValid: false, errors: asyncErrors };
      }

      return { isValid: true, errors: {} };
    } finally {
      this._isValidating = false;
    }
  }
}

// === EXPORT CONVENIENCE FUNCTIONS ===

// Create typed form state for common forms
export const createSignInForm = (initialData?: Partial<SignInCredentials>) => 
  new ZodFormState(enhancedSignInSchema, initialData);

export const createSignUpForm = (initialData?: Partial<SignUpCredentials>) => 
  new ZodFormState(enhancedSignUpSchema, initialData);

export const createPasswordResetForm = (initialData?: Partial<PasswordResetRequest>) => 
  new ZodFormState(enhancedPasswordResetRequestSchema, initialData);

// Export all schemas and utilities
export const ZodIntegration = {
  // Schemas
  enhancedSignInSchema,
  enhancedSignUpSchema,
  enhancedPasswordResetRequestSchema,
  enhancedPasswordResetConfirmationSchema,
  fieldValidationSchemas,
  
  // Validation functions
  validateWithZod,
  validateSignInFormWithZod,
  validateSignUpFormWithZod,
  validatePasswordResetRequestWithZod,
  validatePasswordResetConfirmationWithZod,
  validateFieldRealTime,
  validateFieldAsync,
  
  // Form state
  ZodFormState,
  createSignInForm,
  createSignUpForm,
  createPasswordResetForm,
  
  // Utilities
  getFieldSuggestions,
  getFieldWarnings,
};

export default ZodIntegration;