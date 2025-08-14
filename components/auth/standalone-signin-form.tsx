'use client';

/**
 * Standalone Sign-In Form
 * Does not depend on CrossDomainAuthProvider - safe for static generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { clientAuthService } from '@/lib/auth/service-client';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface StandaloneSignInFormProps {
  className?: string;
  onSuccess?: (redirectUrl?: string) => void;
}

export function StandaloneSignInForm({ className, onSuccess }: StandaloneSignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get redirect URL from search params
  const redirectTo = searchParams.get('redirect_to') || searchParams.get('redirectTo') || undefined;
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
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

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await clientAuthService.signIn({
        email: formData.email,
        password: formData.password,
      });

      if (result.success) {
        toast.success('Sign in successful!', {
          description: 'You have been signed in successfully.',
          duration: 3000,
        });

        // Handle redirect
        if (redirectTo) {
          try {
            const redirectUrl = new URL(redirectTo);
            const targetDomain = redirectUrl.hostname;
            
            // If redirecting to different domain within aldari.app
            if (targetDomain !== window.location.hostname && targetDomain.includes('aldari.app')) {
              // Create a form to post the session to the target domain
              const form = document.createElement('form');
              form.method = 'POST';
              form.action = `https://${targetDomain}/auth/cross-domain`;
              form.style.display = 'none';
              
              // Add session data
              const sessionData = result.data?.session;
              if (sessionData) {
                const accessTokenInput = document.createElement('input');
                accessTokenInput.type = 'hidden';
                accessTokenInput.name = 'access_token';
                accessTokenInput.value = sessionData.access_token;
                form.appendChild(accessTokenInput);
                
                const refreshTokenInput = document.createElement('input');
                refreshTokenInput.type = 'hidden';
                refreshTokenInput.name = 'refresh_token';
                refreshTokenInput.value = sessionData.refresh_token;
                form.appendChild(refreshTokenInput);
                
                const redirectInput = document.createElement('input');
                redirectInput.type = 'hidden';
                redirectInput.name = 'redirect_to';
                redirectInput.value = redirectUrl.pathname + redirectUrl.search;
                form.appendChild(redirectInput);
              }
              
              document.body.appendChild(form);
              form.submit();
            } else {
              // Same domain redirect
              window.location.href = redirectTo;
            }
          } catch (error) {
            console.error('Invalid redirect URL:', error);
            // Fallback to home domain
            window.location.href = 'https://home.aldari.app/dashboard';
          }
        } else {
          // Default behavior - redirect to app domain
          window.location.href = 'https://home.aldari.app/dashboard';
        }

        onSuccess?.(redirectTo || undefined);
      } else {
        setError(result.error?.message || 'Please check your credentials and try again.');
        toast.error('Sign in failed', {
          description: result.error?.message || 'Please check your credentials and try again.',
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('[Sign In] Unexpected error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      toast.error('Sign in failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, redirectTo, onSuccess]);

  // Handle OAuth sign-in
  const handleOAuthSignIn = useCallback(async (provider: 'google' | 'apple') => {
    toast.info(`${provider} sign-in`, {
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
        <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Sign in to your ALDARI account
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
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={isSubmitting}
                className={`pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                autoComplete="current-password"
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

          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sign in
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
            onClick={() => handleOAuthSignIn('google')}
            disabled={isSubmitting}
          >
            <Icons.google className="mr-2 h-4 w-4" />
            Google
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOAuthSignIn('apple')}
            disabled={isSubmitting}
          >
            <Icons.apple className="mr-2 h-4 w-4" />
            Apple
          </Button>
        </div>

        <div className="text-center text-sm">
          Don't have an account?{' '}
          <Link
            href="/sign-up"
            className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>

        {redirectTo && (
          <div className="text-center">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You'll be redirected after signing in.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}