/**
 * Authentication Validation Utilities
 * Comprehensive validation for all auth-related forms and inputs
 */

import { z } from 'zod';
import { VALIDATION_PATTERNS, AUTH_ERRORS, AUTH_CONFIG } from './config';
import { SignInCredentials, SignUpCredentials, PasswordResetRequest, PasswordResetConfirmation, FormErrors, ValidationResult } from './types';

// Utility function to check password strength
export const getPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length < AUTH_CONFIG.security.passwordMinLength) {
    feedback.push(`Password must be at least ${AUTH_CONFIG.security.passwordMinLength} characters long`);
  } else {
    score += 1;
  }

  if (AUTH_CONFIG.security.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else if (AUTH_CONFIG.security.passwordRequireUppercase) {
    score += 1;
  }

  if (AUTH_CONFIG.security.passwordRequireNumber && !/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else if (AUTH_CONFIG.security.passwordRequireNumber) {
    score += 1;
  }

  if (AUTH_CONFIG.security.passwordRequireSpecialChar && !/[@$!%*?&]/.test(password)) {
    feedback.push('Password must contain at least one special character (@$!%*?&)');
  } else if (AUTH_CONFIG.security.passwordRequireSpecialChar) {
    score += 1;
  }

  // Additional security checks
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (password.length >= 16) score += 1;

  // Check for common weak patterns
  const weakPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
    /monkey/i,
    /dragon/i,
  ];

  const hasWeakPattern = weakPatterns.some(pattern => pattern.test(password));
  if (hasWeakPattern) {
    feedback.push('Password contains common weak patterns');
    score = Math.max(0, score - 2);
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeating characters');
    score = Math.max(0, score - 1);
  }

  return {
    score,
    feedback,
    isStrong: score >= 4 && feedback.length === 0,
  };
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"'&]/g, (match) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[match] || match;
    });
};

// Validate email format and domain
export const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push(AUTH_ERRORS.REQUIRED_FIELD);
    return { isValid: false, errors };
  }

  const sanitizedEmail = sanitizeInput(email.toLowerCase());
  
  if (!VALIDATION_PATTERNS.email.test(sanitizedEmail)) {
    errors.push(AUTH_ERRORS.INVALID_EMAIL);
  }

  // Check for disposable email domains (basic check)
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
  ];
  
  const domain = sanitizedEmail.split('@')[1];
  if (domain && disposableDomains.includes(domain)) {
    errors.push('Disposable email addresses are not allowed');
  }

  // Check email length
  if (sanitizedEmail.length > 254) {
    errors.push('Email address is too long');
  }

  return { isValid: errors.length === 0, errors };
};

// Validate phone number (Saudi format)
export const validatePhone = (phone: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!phone) {
    return { isValid: true, errors }; // Phone is optional
  }

  const sanitizedPhone = sanitizeInput(phone.replace(/\s+/g, ''));
  
  if (!VALIDATION_PATTERNS.phone.test(sanitizedPhone)) {
    errors.push(AUTH_ERRORS.INVALID_PHONE);
  }

  return { isValid: errors.length === 0, errors };
};

// Validate name (supports Arabic and English)
export const validateName = (name: string, required: boolean = true): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!name && required) {
    errors.push(AUTH_ERRORS.REQUIRED_FIELD);
    return { isValid: false, errors };
  }

  if (!name) {
    return { isValid: true, errors };
  }

  const sanitizedName = sanitizeInput(name.trim());
  
  if (sanitizedName.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (sanitizedName.length > 50) {
    errors.push('Name must be no more than 50 characters long');
  }

  if (!VALIDATION_PATTERNS.name.test(sanitizedName)) {
    errors.push(AUTH_ERRORS.INVALID_NAME);
  }

  return { isValid: errors.length === 0, errors };
};

// Zod schemas for validation
const signInSchema = z.object({
  email: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD)
    .email(AUTH_ERRORS.INVALID_EMAIL)
    .max(254, 'Email is too long')
    .transform(val => sanitizeInput(val.toLowerCase())),
  
  password: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD)
    .min(AUTH_CONFIG.security.passwordMinLength, AUTH_ERRORS.MIN_LENGTH(AUTH_CONFIG.security.passwordMinLength)),
  
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().optional(),
});

const signUpSchema = z.object({
  email: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD)
    .email(AUTH_ERRORS.INVALID_EMAIL)
    .max(254, 'Email is too long')
    .transform(val => sanitizeInput(val.toLowerCase()))
    .refine(email => {
      const { isValid } = validateEmail(email);
      return isValid;
    }, AUTH_ERRORS.INVALID_EMAIL),
  
  password: z.string()
    .min(AUTH_CONFIG.security.passwordMinLength, AUTH_ERRORS.MIN_LENGTH(AUTH_CONFIG.security.passwordMinLength))
    .max(128, AUTH_ERRORS.MAX_LENGTH(128))
    .refine(password => {
      const { isStrong } = getPasswordStrength(password);
      return isStrong;
    }, AUTH_ERRORS.WEAK_PASSWORD),
  
  confirmPassword: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD),
  
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name is too long')
    .transform(val => sanitizeInput(val.trim()))
    .refine(name => {
      const { isValid } = validateName(name);
      return isValid;
    }, AUTH_ERRORS.INVALID_NAME)
    .optional(),
  
  phone: z.string()
    .transform(val => sanitizeInput(val.replace(/\s+/g, '')))
    .refine(phone => {
      if (!phone) return true;
      const { isValid } = validatePhone(phone);
      return isValid;
    }, AUTH_ERRORS.INVALID_PHONE)
    .optional(),
  
  acceptTerms: z.boolean()
    .refine(val => val === true, AUTH_ERRORS.TERMS_NOT_ACCEPTED),
  
  subscribeNewsletter: z.boolean().optional(),
  captchaToken: z.string().optional(),
  inviteCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: AUTH_ERRORS.PASSWORD_MISMATCH,
  path: ['confirmPassword'],
});

const passwordResetRequestSchema = z.object({
  email: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD)
    .email(AUTH_ERRORS.INVALID_EMAIL)
    .max(254, 'Email is too long')
    .transform(val => sanitizeInput(val.toLowerCase())),
  
  captchaToken: z.string().optional(),
});

const passwordResetConfirmationSchema = z.object({
  password: z.string()
    .min(AUTH_CONFIG.security.passwordMinLength, AUTH_ERRORS.MIN_LENGTH(AUTH_CONFIG.security.passwordMinLength))
    .max(128, AUTH_ERRORS.MAX_LENGTH(128))
    .refine(password => {
      const { isStrong } = getPasswordStrength(password);
      return isStrong;
    }, AUTH_ERRORS.WEAK_PASSWORD),
  
  confirmPassword: z.string()
    .min(1, AUTH_ERRORS.REQUIRED_FIELD),
  
  accessToken: z.string().min(1, 'Invalid reset token'),
  refreshToken: z.string().min(1, 'Invalid reset token'),
}).refine(data => data.password === data.confirmPassword, {
  message: AUTH_ERRORS.PASSWORD_MISMATCH,
  path: ['confirmPassword'],
});

// Validation functions
export const validateSignInForm = (data: SignInCredentials): ValidationResult => {
  try {
    signInSchema.parse(data);
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
      errors: { general: [AUTH_ERRORS.UNKNOWN_ERROR] } 
    };
  }
};

export const validateSignUpForm = (data: SignUpCredentials): ValidationResult => {
  try {
    signUpSchema.parse(data);
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
      errors: { general: [AUTH_ERRORS.UNKNOWN_ERROR] } 
    };
  }
};

export const validatePasswordResetRequest = (data: PasswordResetRequest): ValidationResult => {
  try {
    passwordResetRequestSchema.parse(data);
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
      errors: { general: [AUTH_ERRORS.UNKNOWN_ERROR] } 
    };
  }
};

export const validatePasswordResetConfirmation = (data: PasswordResetConfirmation): ValidationResult => {
  try {
    passwordResetConfirmationSchema.parse(data);
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
      errors: { general: [AUTH_ERRORS.UNKNOWN_ERROR] } 
    };
  }
};

// Real-time validation helpers
export const validateEmailRealTime = (email: string): string[] => {
  const { errors } = validateEmail(email);
  return errors;
};

export const validatePasswordRealTime = (password: string): {
  errors: string[];
  strength: { score: number; feedback: string[]; isStrong: boolean };
} => {
  const errors: string[] = [];
  
  if (password.length < AUTH_CONFIG.security.passwordMinLength) {
    errors.push(AUTH_ERRORS.MIN_LENGTH(AUTH_CONFIG.security.passwordMinLength));
  }
  
  const strength = getPasswordStrength(password);
  
  return { errors, strength };
};

// Export helper functions for real-time validation
export const validateNameRealTime = (name: string, required: boolean = true): { isValid: boolean; errors: string[] } => {
  return validateName(name, required);
};

export const validatePhoneRealTime = (phone: string): { isValid: boolean; errors: string[] } => {
  return validatePhone(phone);
};

// Export schemas for external use
export { signInSchema, signUpSchema, passwordResetRequestSchema, passwordResetConfirmationSchema };