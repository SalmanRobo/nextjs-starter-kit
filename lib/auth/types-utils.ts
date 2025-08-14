/**
 * Enterprise-Grade TypeScript Utility Types for Authentication System
 * Advanced type patterns, runtime validation, and cross-domain type safety
 */

import { User, Session, AuthError } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { UserProfile, AuthErrorDetails, SignInCredentials, SignUpCredentials } from './types';

// === ADVANCED GENERIC UTILITY TYPES ===

// Enhanced exact optional properties with conditional logic
export type ExactOptional<T> = {
  [K in keyof T]: T[K] | undefined
}

// Conditional utility types for enhanced type inference
export type StrictPartial<T> = {
  [P in keyof T]?: T[P] extends infer U | undefined ? U : T[P];
};

// Type-safe key extraction with filtering
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Advanced conditional types for form handling
export type FormData<T> = {
  [K in keyof T]: T[K] extends string ? string | undefined : T[K] extends boolean ? boolean | undefined : T[K]
}

// Deep partial with enhanced object and array handling
export type DeepPartial<T> = T extends (
  | string
  | number
  | boolean
  | Date
  | RegExp
  | Function
) ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends Map<infer K, infer V>
  ? Map<DeepPartial<K>, DeepPartial<V>>
  : T extends Set<infer U>
  ? Set<DeepPartial<U>>
  : {
      [K in keyof T]?: DeepPartial<T[K]>;
    };

// Advanced nested key extraction with type safety
export type NestedKeys<T> = T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object
        ? `${K}` | `${K}.${NestedKeys<T[K]>}`
        : `${K}`;
    }[keyof T & (string | number)]
  : never;

// Type-safe path extraction for nested objects
export type NestedPath<T, K extends NestedKeys<T>> = K extends `${infer P}.${infer S}`
  ? P extends keyof T
    ? S extends NestedKeys<T[P]>
      ? NestedPath<T[P], S>
      : never
    : never
  : K extends keyof T
  ? T[K]
  : never;

// Utility types for making specific fields optional/required
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// === ENHANCED AUTHENTICATION TYPES ===

// Generic API response wrapper with comprehensive error handling
export type ApiResponse<T = unknown, E = AuthErrorDetails> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

// Enhanced form state with field-level validation and metadata
export type FormState<T> = {
  values: T;
  errors: Partial<Record<keyof T, string[]>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  submitCount: number;
};

// Cross-domain communication types for secure SSO
export interface CrossDomainMessage<T = unknown> {
  type: 'AUTH_TOKEN' | 'AUTH_ERROR' | 'AUTH_SUCCESS' | 'AUTH_LOGOUT' | 'AUTH_REFRESH';
  payload: T;
  timestamp: number;
  origin: string;
  sessionId?: string;
  nonce?: string;
}

export type CrossDomainAuthToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: Pick<UserProfile, 'id' | 'email' | 'user_metadata'>;
  permissions?: string[];
};

// === RUNTIME TYPE VALIDATION FACTORIES ===

// Enhanced type guard factory with detailed error messages
export function createTypeGuard<T>(
  name: string,
  validator: (obj: unknown) => obj is T,
  errorMessageFactory?: (obj: unknown) => string
): {
  guard: (obj: unknown) => obj is T;
  assert: (obj: unknown) => asserts obj is T;
  validate: (obj: unknown) => { success: true; data: T } | { success: false; error: string };
} {
  const guard = (obj: unknown): obj is T => validator(obj);
  
  const assert = (obj: unknown): asserts obj is T => {
    if (!guard(obj)) {
      const errorMessage = errorMessageFactory?.(obj) ?? `Invalid ${name} object`;
      throw new TypeError(errorMessage);
    }
  };
  
  const validate = (obj: unknown) => {
    if (guard(obj)) {
      return { success: true as const, data: obj };
    }
    const errorMessage = errorMessageFactory?.(obj) ?? `Invalid ${name} object`;
    return { success: false as const, error: errorMessage };
  };
  
  return { guard, assert, validate };
}

// === AUTHENTICATION OBJECT TYPE GUARDS ===

export const UserProfileGuard = createTypeGuard<UserProfile>(
  'UserProfile',
  (obj): obj is UserProfile => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const user = obj as any;
    return (
      typeof user.id === 'string' &&
      typeof user.email === 'string' &&
      user.email.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) &&
      typeof user.user_metadata === 'object' &&
      user.user_metadata !== null &&
      typeof user.app_metadata === 'object' &&
      user.app_metadata !== null
    );
  },
  (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return 'Expected object, received ' + typeof obj;
    }
    const user = obj as any;
    if (typeof user.id !== 'string') return 'User ID must be a string';
    if (typeof user.email !== 'string') return 'User email must be a string';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return 'User email must be valid';
    return 'Invalid user object structure';
  }
);

export const SessionGuard = createTypeGuard<Session>(
  'Session',
  (obj): obj is Session => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const session = obj as any;
    return (
      typeof session.access_token === 'string' &&
      session.access_token.length > 0 &&
      typeof session.expires_at === 'number' &&
      session.expires_at > 0 &&
      UserProfileGuard.guard(session.user)
    );
  },
  (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return 'Expected object, received ' + typeof obj;
    }
    const session = obj as any;
    if (typeof session.access_token !== 'string') return 'Access token must be a string';
    if (!session.access_token) return 'Access token cannot be empty';
    if (typeof session.expires_at !== 'number') return 'Expires at must be a number';
    if (!UserProfileGuard.guard(session.user)) return 'Session must contain valid user';
    return 'Invalid session object structure';
  }
);

export const AuthErrorGuard = createTypeGuard<AuthErrorDetails>(
  'AuthErrorDetails',
  (obj): obj is AuthErrorDetails => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const error = obj as any;
    return (
      typeof error.code === 'string' &&
      error.code.length > 0 &&
      typeof error.message === 'string' &&
      error.message.length > 0 &&
      typeof error.timestamp === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(error.timestamp)
    );
  },
  (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return 'Expected object, received ' + typeof obj;
    }
    const error = obj as any;
    if (typeof error.code !== 'string') return 'Error code must be a string';
    if (!error.code) return 'Error code cannot be empty';
    if (typeof error.message !== 'string') return 'Error message must be a string';
    if (!error.message) return 'Error message cannot be empty';
    if (typeof error.timestamp !== 'string') return 'Error timestamp must be a string';
    return 'Invalid error object structure';
  }
);

// Cross-domain message type guard
export const CrossDomainMessageGuard = createTypeGuard<CrossDomainMessage>(
  'CrossDomainMessage',
  (obj): obj is CrossDomainMessage => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const message = obj as any;
    const validTypes = ['AUTH_TOKEN', 'AUTH_ERROR', 'AUTH_SUCCESS', 'AUTH_LOGOUT', 'AUTH_REFRESH'];
    
    return (
      typeof message.type === 'string' &&
      validTypes.includes(message.type) &&
      message.payload !== undefined &&
      typeof message.timestamp === 'number' &&
      message.timestamp > 0 &&
      typeof message.origin === 'string' &&
      message.origin.length > 0
    );
  }
);

// === CONVENIENCE TYPE GUARD EXPORTS ===

export const isUserProfile = UserProfileGuard.guard;
export const assertUserProfile = UserProfileGuard.assert;
export const validateUserProfile = UserProfileGuard.validate;

export const isSession = SessionGuard.guard;
export const assertSession = SessionGuard.assert;
export const validateSession = SessionGuard.validate;

export const isAuthError = AuthErrorGuard.guard;
export const assertAuthError = AuthErrorGuard.assert;
export const validateAuthError = AuthErrorGuard.validate;

export const isCrossDomainMessage = CrossDomainMessageGuard.guard;
export const assertCrossDomainMessage = CrossDomainMessageGuard.assert;
export const validateCrossDomainMessage = CrossDomainMessageGuard.validate;

// === TYPE-SAFE UTILITY FUNCTIONS ===

// Enhanced type-safe object merger that handles undefined values
export function mergeWithUndefined<T extends Record<string, unknown>>(
  target: T, 
  source: Partial<T>
): T {
  const result = { ...target }
  
  for (const key in source) {
    if (source[key] !== undefined) {
      result[key] = source[key] as T[typeof key]
    }
  }
  
  return result
}

// Type-safe deep merge utility
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof result[key] === 'object' &&
        result[key] !== null &&
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(result[key]) &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  
  return result;
}

// Type-safe nested property access
export function getNestedValue<T, K extends NestedKeys<T>>(
  obj: T,
  path: K
): NestedPath<T, K> | undefined {
  const keys = (path as string).split('.');
  let current: any = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

// Type-safe object key filtering
export function filterObjectKeys<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

// Type guard for checking if value is defined
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

// Type guard for checking if value is null or undefined
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

// Safe property accessor that handles undefined
export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null, 
  key: K
): T[K] | undefined {
  return obj?.[key]
}

// Type-safe default value provider
export function withDefault<T>(value: T | undefined, defaultValue: T): T {
  return isDefined(value) ? value : defaultValue
}

// Enhanced error type that's compatible with exact optional properties
export interface StrictAuthError {
  code: string
  message: string
  details?: unknown
  hint?: string
  timestamp: string
  requestId?: string
  status: number
  __isAuthError: boolean
  name: string
}

// Type converter for Supabase AuthError to our strict type
export function toStrictAuthError(error: any): StrictAuthError {
  return {
    code: error.code || 'unknown_error',
    message: error.message || 'An error occurred',
    details: error.details,
    hint: error.hint,
    timestamp: new Date().toISOString(),
    requestId: error.requestId,
    status: error.status || 500,
    __isAuthError: true,
    name: error.name || 'AuthError'
  }
}

// Utility for handling optional properties in component props
export type ComponentProps<T> = {
  [K in keyof T]: T[K] extends infer U | undefined ? U | undefined : T[K]
}

// Type-safe form field handler
export interface FormFieldProps<T> {
  name: keyof T
  value: T[keyof T] | undefined
  error?: string
  onChange: (value: T[keyof T] | undefined) => void
  onBlur?: () => void
  disabled?: boolean
  required?: boolean
}

// Enhanced validation result with proper undefined handling
export interface StrictValidationResult<T> {
  isValid: boolean
  data?: T
  errors: Record<keyof T, string[] | undefined>
  warnings?: Record<keyof T, string[] | undefined>
}

// Type-safe async result wrapper
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: E }
>

// Database operation result with exact types
export interface DatabaseOperation<T> {
  data: T | null
  error: {
    code: string
    message: string
    details?: string
    hint?: string
  } | null
  count?: number
}

// Type-safe configuration object
export interface StrictConfig {
  [key: string]: string | number | boolean | string[] | undefined
}

// === DEVELOPMENT & DEBUGGING UTILITIES ===

// Type information extractor for development debugging
export function getTypeInfo<T>(value: T): {
  type: string;
  constructor: string;
  keys: string[];
  prototype: string[];
  size?: number;
} {
  const type = typeof value;
  const constructor = value?.constructor?.name || 'Unknown';
  const keys = type === 'object' && value !== null ? Object.keys(value) : [];
  const prototype = type === 'object' && value !== null 
    ? Object.getOwnPropertyNames(Object.getPrototypeOf(value))
    : [];
  
  let size: number | undefined;
  if (Array.isArray(value)) {
    size = value.length;
  } else if (value instanceof Map || value instanceof Set) {
    size = value.size;
  } else if (typeof value === 'string') {
    size = value.length;
  }
  
  return { type, constructor, keys, prototype, size };
}

// Runtime type checker factory for development
export function createRuntimeTypeChecker<T>(
  name: string,
  expectedShape: Record<string, string>
) {
  return (obj: unknown): obj is T => {
    if (process.env.NODE_ENV !== 'development') {
      // In production, do basic object check
      return typeof obj === 'object' && obj !== null;
    }
    
    if (typeof obj !== 'object' || obj === null) {
      console.warn(`[Type Check] ${name}: Expected object, got ${typeof obj}`);
      return false;
    }
    
    const target = obj as Record<string, any>;
    const issues: string[] = [];
    
    for (const [key, expectedType] of Object.entries(expectedShape)) {
      const actualType = typeof target[key];
      if (actualType !== expectedType) {
        issues.push(`${key}: expected ${expectedType}, got ${actualType}`);
      }
    }
    
    if (issues.length > 0) {
      console.warn(`[Type Check] ${name}:`, issues);
      return false;
    }
    
    return true;
  };
}

// Performance monitoring for type operations
export class TypePerformanceMonitor {
  private static operations: Map<string, { count: number; totalTime: number }> = new Map();
  
  static track<T>(operation: string, fn: () => T): T {
    if (process.env.NODE_ENV !== 'development') {
      return fn();
    }
    
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    const existing = this.operations.get(operation) || { count: 0, totalTime: 0 };
    this.operations.set(operation, {
      count: existing.count + 1,
      totalTime: existing.totalTime + duration
    });
    
    return result;
  }
  
  static getStats(): Record<string, { count: number; averageTime: number; totalTime: number }> {
    const stats: Record<string, { count: number; averageTime: number; totalTime: number }> = {};
    
    for (const [operation, data] of this.operations.entries()) {
      stats[operation] = {
        count: data.count,
        totalTime: data.totalTime,
        averageTime: data.totalTime / data.count
      };
    }
    
    return stats;
  }
  
  static reset(): void {
    this.operations.clear();
  }
}

// === ENHANCED FORM UTILITIES ===

// Type-safe form field validator
export interface FormFieldValidator<T> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | null;
}

// Enhanced form field validation with proper error handling
export function validateFormField<T>(
  value: T,
  validators: FormFieldValidator<T>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (validators.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    errors.push('This field is required');
  }
  
  if (typeof value === 'string') {
    if (validators.minLength && value.length < validators.minLength) {
      errors.push(`Must be at least ${validators.minLength} characters`);
    }
    if (validators.maxLength && value.length > validators.maxLength) {
      errors.push(`Must be no more than ${validators.maxLength} characters`);
    }
    if (validators.pattern && !validators.pattern.test(value)) {
      errors.push('Invalid format');
    }
  }
  
  if (validators.custom) {
    const customError = validators.custom(value);
    if (customError) {
      errors.push(customError);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

// Type-safe form state manager
export class TypeSafeFormState<T extends Record<string, any>> {
  private _values: T;
  private _errors: Partial<Record<keyof T, string[]>>;
  private _touched: Partial<Record<keyof T, boolean>>;
  private _isDirty: boolean;
  private _isSubmitting: boolean;
  private _submitCount: number;
  
  constructor(initialValues: T) {
    this._values = { ...initialValues };
    this._errors = {};
    this._touched = {};
    this._isDirty = false;
    this._isSubmitting = false;
    this._submitCount = 0;
  }
  
  get state(): FormState<T> {
    return {
      values: this._values,
      errors: this._errors,
      touched: this._touched,
      isValid: Object.keys(this._errors).length === 0,
      isSubmitting: this._isSubmitting,
      isDirty: this._isDirty,
      submitCount: this._submitCount
    };
  }
  
  setValue<K extends keyof T>(field: K, value: T[K]): void {
    this._values[field] = value;
    this._isDirty = true;
    
    // Clear field error when value changes
    if (this._errors[field]) {
      delete this._errors[field];
    }
  }
  
  setError<K extends keyof T>(field: K, errors: string[]): void {
    if (errors.length > 0) {
      this._errors[field] = errors;
    } else {
      delete this._errors[field];
    }
  }
  
  setTouched<K extends keyof T>(field: K, touched: boolean = true): void {
    this._touched[field] = touched;
  }
  
  setSubmitting(submitting: boolean): void {
    this._isSubmitting = submitting;
  }
  
  incrementSubmitCount(): void {
    this._submitCount++;
  }
  
  reset(newValues?: Partial<T>): void {
    this._values = { ...this._values, ...newValues };
    this._errors = {};
    this._touched = {};
    this._isDirty = false;
    this._isSubmitting = false;
  }
}

// === EXPORT COLLECTIONS ===

// All type utilities for convenient import
export const TypeUtils = {
  // Type guards
  createTypeGuard,
  UserProfileGuard,
  SessionGuard,
  AuthErrorGuard,
  CrossDomainMessageGuard,
  isUserProfile,
  isSession,
  isAuthError,
  isCrossDomainMessage,
  
  // Assertion functions
  assertUserProfile,
  assertSession,
  assertAuthError,
  assertCrossDomainMessage,
  
  // Validation functions
  validateUserProfile,
  validateSession,
  validateAuthError,
  validateCrossDomainMessage,
  
  // Utility functions
  mergeWithUndefined,
  deepMerge,
  getNestedValue,
  filterObjectKeys,
  isDefined,
  isNullish,
  safeGet,
  withDefault,
  
  // Development utilities
  getTypeInfo,
  createRuntimeTypeChecker,
  TypePerformanceMonitor,
  
  // Form utilities
  validateFormField,
  TypeSafeFormState,
};

// Legacy compatibility export
export default {
  mergeWithUndefined,
  isDefined,
  isNullish,
  safeGet,
  withDefault,
  toStrictAuthError,
  // Enhanced exports
  ...TypeUtils,
};