'use client';

/**
 * Standalone Sign-Up Form
 * Does not depend on CrossDomainAuthProvider - safe for static generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Icons } from '@/components/icons';
import { clientAuthService } from '@/lib/auth/service-client';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface StandaloneSignUpFormProps {
  className?: string;
  onSuccess?: (redirectUrl?: string) => void;
}

export function StandaloneSignUpForm({ className, onSuccess }: StandaloneSignUpFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get redirect URL from search params
  const redirectTo = searchParams.get('redirect_to') || searchParams.get('redirectTo') || undefined;
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    termsAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.termsAccepted) {
      errors.termsAccepted = 'You must accept the Terms of Service';
    }

    if (!formData.privacyAccepted) {
      errors.privacyAccepted = 'You must accept the Privacy Policy';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear specific field error
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear general error
    if (error) {
      setError(null);
    }
  }, [formErrors, error]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
    
    // Clear specific field error
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear general error
    if (error) {
      setError(null);
    }
  }, [formErrors, error]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await clientAuthService.signUp({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        termsAccepted: formData.termsAccepted,
        privacyAccepted: formData.privacyAccepted,
        marketingConsent: formData.marketingConsent,
      });

      if (result.success) {
        toast.success('Account created successfully!', {
          description: 'Please check your email to verify your account.',
          duration: 5000,
        });

        // Redirect to sign-in with message about email verification
        router.push('/sign-in?message=check_email');
        onSuccess?.(redirectTo || undefined);
      } else {
        const errorMessage = result.error?.message || 'Failed to create account. Please try again.';
        const errorHint = result.error?.hint;
        
        // Check if it's an email delivery error
        const isEmailError = result.error?.message?.includes('email') || 
                            result.error?.message?.includes('confirmation') ||
                            result.error?.code?.includes('EMAIL');
        
        setError(errorMessage + (errorHint ? ` ${errorHint}` : ''));
        
        if (isEmailError) {
          toast.error('Email delivery issue', {
            description: errorMessage + (errorHint ? ` ${errorHint}` : ''),
            duration: 8000, // Longer duration for email errors
            action: {
              label: 'Try Sign In',
              onClick: () => router.push('/sign-in'),
            },
          });
        } else {
          toast.error('Sign up failed', {
            description: errorMessage,
            duration: 5000,
          });
        }
      }
    } catch (error: any) {
      console.error('[Sign Up] Unexpected error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      toast.error('Sign up failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, router, redirectTo, onSuccess]);

  // Handle OAuth sign-up
  const handleOAuthSignUp = useCallback(async (provider: 'google' | 'apple') => {
    toast.info(`${provider} sign-up`, {
      description: 'OAuth integration coming soon.',
    });
  }, []);

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
          Join ALDARI to get started
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
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              disabled={isSubmitting}
              className={formErrors.fullName ? 'border-red-500' : ''}
              autoComplete="name"
            />
            {formErrors.fullName && (
              <p className="text-sm text-red-600">{formErrors.fullName}</p>
            )}
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
              disabled={isSubmitting}
              className={formErrors.email ? 'border-red-500' : ''}
              autoComplete="email"
            />
            {formErrors.email && (
              <p className="text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              disabled={isSubmitting}
              autoComplete="tel"
            />
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
                placeholder="Create a password"
                disabled={isSubmitting}
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
            {formErrors.password && (
              <p className="text-sm text-red-600">{formErrors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                disabled={isSubmitting}
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
            <div className="flex items-start space-x-2">
              <Checkbox
                id="termsAccepted"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) => handleCheckboxChange('termsAccepted', checked as boolean)}
                className={formErrors.termsAccepted ? 'border-red-500' : ''}
              />
              <div className="leading-none">
                <Label 
                  htmlFor="termsAccepted"
                  className={`text-sm font-normal cursor-pointer ${formErrors.termsAccepted ? 'text-red-600' : ''}`}
                >
                  I agree to the{' '}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-500 hover:underline">
                    Terms of Service
                  </Link>
                </Label>
                {formErrors.termsAccepted && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.termsAccepted}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="privacyAccepted"
                checked={formData.privacyAccepted}
                onCheckedChange={(checked) => handleCheckboxChange('privacyAccepted', checked as boolean)}
                className={formErrors.privacyAccepted ? 'border-red-500' : ''}
              />
              <div className="leading-none">
                <Label 
                  htmlFor="privacyAccepted"
                  className={`text-sm font-normal cursor-pointer ${formErrors.privacyAccepted ? 'text-red-600' : ''}`}
                >
                  I agree to the{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-500 hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
                {formErrors.privacyAccepted && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.privacyAccepted}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="marketingConsent"
                checked={formData.marketingConsent}
                onCheckedChange={(checked) => handleCheckboxChange('marketingConsent', checked as boolean)}
              />
              <Label 
                htmlFor="marketingConsent"
                className="text-sm font-normal cursor-pointer"
              >
                I would like to receive marketing communications and updates
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Account
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
            disabled={isSubmitting}
          >
            <Icons.google className="mr-2 h-4 w-4" />
            Google
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOAuthSignUp('apple')}
            disabled={isSubmitting}
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
                You'll be redirected after creating your account.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}