/**
 * TypeScript Utility Types for Enhanced Type Safety
 * Production-ready utilities for handling exact optional properties and strict typing
 */

// Utility type to handle exact optional properties in strict mode
export type ExactOptional<T> = {
  [K in keyof T]: T[K] | undefined
}

// Helper type for form data with proper undefined handling
export type FormData<T> = {
  [K in keyof T]: T[K] extends string ? string | undefined : T[K] extends boolean ? boolean | undefined : T[K]
}

// Type-safe object merger that handles undefined values
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

export default {
  mergeWithUndefined,
  isDefined,
  isNullish,
  safeGet,
  withDefault,
  toStrictAuthError,
}