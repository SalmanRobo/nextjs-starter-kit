'use client';

/**
 * ALDARI Cross-Domain Sign-Up Form
 * Optimized registration form with cross-domain redirect support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import { useCrossDomainAuth, useGuestGuard } from './cross-domain-auth-provider';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertCircle, CheckCircle, X, Check } from 'lucide-react';
import Link from 'next/link';

interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

interface CrossDomainSignUpFormProps {
  className?: string;
  onSuccess?: (redirectUrl?: string) => void;
}

export function CrossDomainSignUpForm({ className, onSuccess }: CrossDomainSignUpFormProps) {
  // Auth context
  const { signUp, loading, error, clearError, isAuthDomain, handleCrossDomainRedirect } = useCrossDomainAuth();
  
  // Guest guard - redirect authenticated users
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo');
  useGuestGuard(redirectTo || undefined);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptMarketing: false,
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Clear errors when auth error changes
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Update password requirements
  useEffect(() => {
    const password = formData.password;
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    });
  }, [formData.password]);

  // Calculate password strength
  const getPasswordStrength = useCallback(() => {
    const requirements = Object.values(passwordRequirements);
    const metRequirements = requirements.filter(Boolean).length;
    return (metRequirements / requirements.length) * 100;
  }, [passwordRequirements]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    } else if (formData.firstName.length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);
      if (!allRequirementsMet) {
        errors.password = 'Password must meet all requirements';
      }
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.acceptTerms) {
      errors.acceptTerms = 'You must accept the terms of service';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, passwordRequirements]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    
    // Clear specific field error
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [formErrors]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp(formData.email, formData.password, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        full_name: `${formData.firstName} ${formData.lastName}`,
        marketing_consent: formData.acceptMarketing,
      });

      if (result.success) {
        toast.success('Account created successfully!', {
          description: 'Please check your email to verify your account.',
          duration: 8000,
        });

        // Handle cross-domain redirect for email verification
        if (redirectTo) {
          try {
            const redirectUrl = new URL(redirectTo);
            const targetDomain = redirectUrl.hostname;
            
            // If redirecting to different domain, use cross-domain flow
            if (targetDomain !== window.location.hostname && targetDomain.includes('aldari.app')) {
              // For email verification, we might want to redirect to auth domain
              window.location.href = `/auth/verify-email?redirectTo=${encodeURIComponent(redirectTo)}`;
            } else {
              // Same domain redirect to verification page
              window.location.href = `/auth/verify-email?redirectTo=${encodeURIComponent(redirectTo)}`;
            }
          } catch (error) {
            console.error('Invalid redirect URL:', error);
            // Fallback to verification page
            window.location.href = '/auth/verify-email';
          }
        } else {
          // Default verification flow
          window.location.href = '/auth/verify-email';
        }

        onSuccess?.(redirectTo || undefined);
      } else {
        toast.error('Sign up failed', {
          description: result.error || 'Please check your information and try again.',
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('[Sign Up] Unexpected error:', error);
      toast.error('Sign up failed', {
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, signUp, redirectTo, onSuccess]);

  // Handle OAuth sign-up
  const handleOAuthSignUp = useCallback(async (provider: 'google' | 'apple') => {
    // Implementation would depend on your OAuth setup
    toast.info(`${provider} sign-up`, {
      description: 'OAuth integration coming soon.',
    });
  }, []);

  const passwordStrength = getPasswordStrength();

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">Create your account</CardTitle>
        <CardDescription className="text-center">
          Join ALDARI and discover your perfect property
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Enter your first name"
                disabled={loading || isSubmitting}
                className={formErrors.firstName ? 'border-red-500' : ''}
                autoComplete="given-name"
              />
              {formErrors.firstName && (
                <p className="text-sm text-red-600">{formErrors.firstName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Enter your last name"
                disabled={loading || isSubmitting}
                className={formErrors.lastName ? 'border-red-500' : ''}
                autoComplete="family-name"
              />
              {formErrors.lastName && (
                <p className="text-sm text-red-600">{formErrors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email address"
              disabled={loading || isSubmitting}
              className={formErrors.email ? 'border-red-500' : ''}
              autoComplete="email"
            />
            {formErrors.email && (
              <p className="text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Create a strong password"
                disabled={loading || isSubmitting}
                className={`pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {formData.password && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Password strength</span>
                  <span className="text-xs text-gray-600">
                    {passwordStrength < 40 ? 'Weak' : passwordStrength < 80 ? 'Good' : 'Strong'}
                  </span>
                </div>
                <Progress value={passwordStrength} className="h-2" />
                
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {[
                    { key: 'minLength', text: 'At least 8 characters' },
                    { key: 'hasUppercase', text: 'One uppercase letter' },
                    { key: 'hasLowercase', text: 'One lowercase letter' },
                    { key: 'hasNumber', text: 'One number' },
                    { key: 'hasSpecialChar', text: 'One special character' },
                  ].map(({ key, text }) => (
                    <div key={key} className="flex items-center gap-2">
                      {passwordRequirements[key as keyof PasswordRequirements] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={passwordRequirements[key as keyof PasswordRequirements] ? 'text-green-600' : 'text-gray-500'}>
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formErrors.password && (
              <p className="text-sm text-red-600">{formErrors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                disabled={loading || isSubmitting}
                className={`pr-10 ${formErrors.confirmPassword ? 'border-red-500' : ''}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {formErrors.confirmPassword && (
              <p className="text-sm text-red-600">{formErrors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="acceptTerms"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => 
                  handleInputChange({ 
                    target: { name: 'acceptTerms', type: 'checkbox', checked } 
                  } as any)
                }
                disabled={loading || isSubmitting}
              />
              <Label htmlFor="acceptTerms" className="text-sm">
                I accept the{' '}
                <Link href="/terms-of-service" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {formErrors.acceptTerms && (
              <p className="text-sm text-red-600">{formErrors.acceptTerms}</p>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="acceptMarketing"
                name="acceptMarketing"
                checked={formData.acceptMarketing}
                onCheckedChange={(checked) => 
                  handleInputChange({ 
                    target: { name: 'acceptMarketing', type: 'checkbox', checked } 
                  } as any)
                }
                disabled={loading || isSubmitting}
              />
              <Label htmlFor="acceptMarketing" className="text-sm text-gray-600">
                I would like to receive marketing communications (optional)
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || isSubmitting}
          >
            {(loading || isSubmitting) && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create account
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => handleOAuthSignUp('google')}
            disabled={loading || isSubmitting}
          >
            <Icons.google className="mr-2 h-4 w-4" />
            Google
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOAuthSignUp('apple')}
            disabled={loading || isSubmitting}
          >
            <Icons.apple className="mr-2 h-4 w-4" />
            Apple
          </Button>
        </div>

        <div className="text-center text-sm">
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>

        {redirectTo && (
          <div className="text-center">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You'll be redirected after completing registration and email verification.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}