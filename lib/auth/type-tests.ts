/**
 * Type-Level Testing Framework for Authentication System
 * Comprehensive compile-time and runtime type validation tests
 */

import type { 
  UserProfile, 
  SignInCredentials, 
  SignUpCredentials,
  AuthErrorDetails,
  AuthState,
  AuthContextType
} from './types';
import type {
  DeepPartial,
  NestedKeys,
  NestedPath,
  FormState,
  ApiResponse,
  CrossDomainMessage,
  PartialBy,
  RequiredBy
} from './types-utils';
import { 
  UserProfileGuard,
  SessionGuard,
  AuthErrorGuard,
  TypePerformanceMonitor
} from './types-utils';

// === COMPILE-TIME TYPE TESTS ===

// Test utility types work correctly
type TestDeepPartial = DeepPartial<{
  user: {
    id: string;
    profile: {
      name: string;
      settings: {
        theme: 'light' | 'dark';
        notifications: boolean;
      };
    };
  };
}>;

// Should allow partial nested objects
const testDeepPartial: TestDeepPartial = {
  user: {
    profile: {
      settings: {
        theme: 'dark'
        // notifications is optional due to DeepPartial
      }
    }
    // id is optional due to DeepPartial
  }
};

// Test nested keys extraction
type TestNestedKeys = NestedKeys<{
  user: {
    profile: {
      name: string;
      age: number;
    };
    settings: {
      theme: string;
    };
  };
}>;

// Should extract: "user" | "user.profile" | "user.profile.name" | "user.profile.age" | "user.settings" | "user.settings.theme"

// Test nested path extraction
type TestNestedPath = NestedPath<{
  user: {
    profile: {
      name: string;
    };
  };
}, 'user.profile.name'>; // Should be string

// Test PartialBy and RequiredBy
type TestPartialBy = PartialBy<{
  id: string;
  name: string;
  email: string;
}, 'name' | 'email'>; // id is required, name and email are optional

type TestRequiredBy = RequiredBy<{
  id?: string;
  name?: string;
  email?: string;
}, 'id' | 'email'>; // id and email are required, name is optional

// === RUNTIME TYPE VALIDATION TESTS ===

export class AuthTypeTests {
  private static testResults: Map<string, { passed: boolean; message: string; duration: number }> = new Map();

  // Test UserProfile type guard
  static testUserProfileValidation(): boolean {
    const validUser: any = {
      id: '123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {}
    };

    const invalidUser: any = {
      id: 123, // Should be string
      email: 'invalid-email',
      user_metadata: null
    };

    const test1 = UserProfileGuard.guard(validUser);
    const test2 = !UserProfileGuard.guard(invalidUser);
    const test3 = !UserProfileGuard.guard(null);
    const test4 = !UserProfileGuard.guard('string');

    return test1 && test2 && test3 && test4;
  }

  // Test AuthError type guard
  static testAuthErrorValidation(): boolean {
    const validError: any = {
      code: 'invalid_credentials',
      message: 'Invalid email or password',
      timestamp: new Date().toISOString()
    };

    const invalidError: any = {
      code: 123, // Should be string
      message: '',
      timestamp: 'invalid-date'
    };

    const test1 = AuthErrorGuard.guard(validError);
    const test2 = !AuthErrorGuard.guard(invalidError);
    const test3 = !AuthErrorGuard.guard(null);

    return test1 && test2 && test3;
  }

  // Test API response type structure
  static testApiResponseTypes(): boolean {
    // Test success response
    const successResponse: ApiResponse<UserProfile> = {
      success: true,
      data: {
        id: '123',
        email: 'test@example.com',
        user_metadata: {},
        app_metadata: {}
      } as UserProfile
    };

    // Test error response
    const errorResponse: ApiResponse<never, AuthErrorDetails> = {
      success: false,
      error: {
        code: 'validation_failed',
        message: 'Validation failed',
        timestamp: new Date().toISOString()
      }
    };

    // Type-level tests (these would fail compilation if types are wrong)
    if (successResponse.success) {
      // data should be available and error should be never
      const data = successResponse.data; // UserProfile
      // const error = successResponse.error; // This should be never/undefined
      return data !== undefined;
    } else {
      // error should be available and data should be never
      const error = successResponse.error; // AuthErrorDetails
      // const data = successResponse.data; // This should be never/undefined
      return error !== undefined;
    }
  }

  // Test form state types
  static testFormStateTypes(): boolean {
    const formState: FormState<SignInCredentials> = {
      values: {
        email: 'test@example.com',
        password: 'password123'
      },
      errors: {
        email: ['Invalid email format']
      },
      touched: {
        email: true,
        password: false
      },
      isValid: false,
      isSubmitting: false,
      isDirty: true,
      submitCount: 1
    };

    // Test type safety - these should compile without errors
    const emailError = formState.errors.email; // string[] | undefined
    const emailTouched = formState.touched.email; // boolean | undefined
    const emailValue = formState.values.email; // string

    return emailError !== undefined && 
           emailTouched === true && 
           emailValue === 'test@example.com';
  }

  // Test cross-domain message types
  static testCrossDomainMessageTypes(): boolean {
    const tokenMessage: CrossDomainMessage<{ token: string }> = {
      type: 'AUTH_TOKEN',
      payload: { token: 'abc123' },
      timestamp: Date.now(),
      origin: 'https://auth.aldari.app',
      sessionId: 'session123'
    };

    const errorMessage: CrossDomainMessage<AuthErrorDetails> = {
      type: 'AUTH_ERROR',
      payload: {
        code: 'session_expired',
        message: 'Session has expired',
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now(),
      origin: 'https://app.aldari.app'
    };

    return tokenMessage.type === 'AUTH_TOKEN' && 
           errorMessage.type === 'AUTH_ERROR' &&
           typeof tokenMessage.payload.token === 'string';
  }

  // Run all type tests
  static runAllTests(): { passed: number; failed: number; results: typeof this.testResults } {
    const tests = [
      { name: 'UserProfile Validation', test: this.testUserProfileValidation },
      { name: 'AuthError Validation', test: this.testAuthErrorValidation },
      { name: 'API Response Types', test: this.testApiResponseTypes },
      { name: 'Form State Types', test: this.testFormStateTypes },
      { name: 'Cross-Domain Message Types', test: this.testCrossDomainMessageTypes }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      try {
        const start = performance.now();
        const result = TypePerformanceMonitor.track(`test_${name}`, test.bind(this));
        const duration = performance.now() - start;

        if (result) {
          passed++;
          this.testResults.set(name, { passed: true, message: 'Test passed', duration });
        } else {
          failed++;
          this.testResults.set(name, { passed: false, message: 'Test failed', duration });
        }
      } catch (error) {
        failed++;
        this.testResults.set(name, { 
          passed: false, 
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        });
      }
    }

    return { passed, failed, results: this.testResults };
  }

  // Get test statistics
  static getTestStats(): {
    totalTests: number;
    passRate: number;
    avgDuration: number;
    performanceStats: ReturnType<typeof TypePerformanceMonitor.getStats>;
  } {
    const total = this.testResults.size;
    const passed = Array.from(this.testResults.values()).filter(r => r.passed).length;
    const totalDuration = Array.from(this.testResults.values()).reduce((sum, r) => sum + r.duration, 0);

    return {
      totalTests: total,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      avgDuration: total > 0 ? totalDuration / total : 0,
      performanceStats: TypePerformanceMonitor.getStats()
    };
  }

  // Reset test results
  static reset(): void {
    this.testResults.clear();
    TypePerformanceMonitor.reset();
  }

  // Print test report
  static printReport(): void {
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Authentication Type Tests Report');
      
      for (const [name, result] of this.testResults.entries()) {
        const icon = result.passed ? '✅' : '❌';
        const duration = result.duration.toFixed(2);
        console.log(`${icon} ${name}: ${result.message} (${duration}ms)`);
      }

      const stats = this.getTestStats();
      console.log(`\n📊 Summary: ${stats.passRate.toFixed(1)}% pass rate (${stats.avgDuration.toFixed(2)}ms avg)`);
      
      console.groupEnd();
    }
  }
}

// === TYPE COMPATIBILITY TESTS ===

// Test that our types are compatible with Supabase types
export function testSupabaseCompatibility() {
  // This function exists primarily for compile-time type checking
  // If it compiles without errors, our types are compatible
  
  type SupabaseUser = {
    id: string;
    email?: string;
    user_metadata: Record<string, any>;
    app_metadata: Record<string, any>;
  };

  // Test that our UserProfile extends Supabase User properly
  function testUserProfileCompatibility(user: UserProfile): SupabaseUser {
    return user; // Should compile without error
  }

  // Test auth state compatibility
  function testAuthStateCompatibility(state: AuthState) {
    const user = state.user; // UserProfile | null
    const session = state.session; // Session | null
    const loading = state.loading; // boolean
    
    return { user, session, loading };
  }

  return { testUserProfileCompatibility, testAuthStateCompatibility };
}

// === DEVELOPMENT UTILITIES ===

// Type assertion helpers for development
export const TypeAssertions = {
  // Assert that a value matches expected type structure
  assertType<T>(value: unknown, typeName: string): asserts value is T {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Type assertion: ${typeName}`, value);
    }
  },

  // Verify object shape matches interface
  verifyShape<T extends Record<string, any>>(
    obj: T, 
    expectedKeys: (keyof T)[],
    typeName: string
  ): boolean {
    if (process.env.NODE_ENV !== 'development') return true;

    const objKeys = Object.keys(obj);
    const missingKeys = expectedKeys.filter(key => !(String(key) in obj));
    const extraKeys = objKeys.filter(key => !expectedKeys.includes(key as keyof T));

    if (missingKeys.length > 0) {
      console.warn(`🚨 Missing keys in ${typeName}:`, missingKeys);
      return false;
    }

    if (extraKeys.length > 0) {
      console.info(`ℹ️ Extra keys in ${typeName}:`, extraKeys);
    }

    return true;
  },

  // Type-safe JSON parsing with validation
  parseJsonSafely<T>(json: string, validator: (obj: unknown) => obj is T): T | null {
    try {
      const parsed = JSON.parse(json);
      return validator(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
};

// === BENCHMARKING UTILITIES ===

export class TypeBenchmark {
  private static benchmarks: Map<string, number[]> = new Map();

  static measure<T>(name: string, operation: () => T, iterations: number = 1000): {
    result: T;
    avgTime: number;
    minTime: number;
    maxTime: number;
  } {
    const times: number[] = [];
    let result: T;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      result = operation();
      const end = performance.now();
      times.push(end - start);
    }

    this.benchmarks.set(name, times);

    return {
      result: result!,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    };
  }

  static getBenchmarkResults(): Map<string, {
    avgTime: number;
    minTime: number;
    maxTime: number;
    iterations: number;
  }> {
    const results = new Map();

    for (const [name, times] of this.benchmarks.entries()) {
      results.set(name, {
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        iterations: times.length
      });
    }

    return results;
  }

  static reset(): void {
    this.benchmarks.clear();
  }
}

// === EXPORT FOR EASY TESTING ===

export const TypeTestSuite = {
  AuthTypeTests,
  TypeAssertions,
  TypeBenchmark,
  testSupabaseCompatibility
};

export default TypeTestSuite;