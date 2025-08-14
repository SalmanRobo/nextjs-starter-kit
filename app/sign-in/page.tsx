"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { SignInCredentials } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

// Form validation
function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
}

// Main sign-in component
function SignInContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn, signInWithOAuth, isAuthenticated, loading: authLoading, error: authError, clearError } = useAuth();

  // Get redirect URL
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirectedFrom") || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, authLoading, router, redirectTo]);

  // Clear auth errors when form changes
  useEffect(() => {
    if (authError) {
      clearError();
    }
  }, [email, password, authError, clearError]);

  // Handle form submission
  const handleEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setEmailError(null);
    setPasswordError(null);
    
    // Validate form
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    
    if (emailValidation) {
      setEmailError(emailValidation);
      return;
    }
    
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }

    // Submit with transition for better UX
    startTransition(async () => {
      try {
        const credentials: SignInCredentials = {
          email: email.trim().toLowerCase(),
          password,
        };

        const result = await signIn(credentials);
        
        if (!result.success && result.error) {
          // Handle specific error cases
          if (result.error.code === 'invalid_credentials') {
            setEmailError("Invalid email or password");
            setPasswordError("Invalid email or password");
          } else if (result.error.code === 'too_many_requests') {
            toast.error("Too many attempts. Please try again later.");
          } else {
            toast.error(result.error.message || "Sign in failed. Please try again.");
          }
        }
      } catch (error) {
        console.error('Sign in error:', error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  }, [email, password, signIn]);

  // Handle OAuth sign in
  const handleOAuthSignIn = useCallback(async (provider: 'google' | 'github') => {
    startTransition(async () => {
      try {
        const result = await signInWithOAuth({
          provider,
          redirectTo,
        });
        
        if (!result.success && result.error) {
          toast.error(result.error.message || `Failed to sign in with ${provider}`);
        }
      } catch (error) {
        console.error(`${provider} sign in error:`, error);
        toast.error(`Failed to sign in with ${provider}`);
      }
    });
  }, [signInWithOAuth, redirectTo]);

  const isLoading = authLoading || isPending;
  
  // Don't render if already authenticated
  if (isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen py-8">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Welcome to ALDARI
          </CardTitle>
          <CardDescription>
            Sign in to access Saudi Arabia's premier property platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auth Error Display */}
          {authError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {authError.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className={cn(emailError && "border-red-500 focus-visible:ring-red-500")}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              {emailError && (
                <p id="email-error" className="text-sm text-red-600" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={cn(passwordError && "border-red-500 focus-visible:ring-red-500", "pr-10")}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordError && (
                <p id="password-error" className="text-sm text-red-600" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
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

          {/* Google Sign In */}
          <Button
            variant="outline"
            className="w-full"
            disabled={isLoading}
            onClick={() => handleOAuthSignIn('google')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 256 262"
              className="mr-2"
            >
              <path
                fill="#4285F4"
                d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
              />
              <path
                fill="#34A853"
                d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
              />
              <path
                fill="#FBBC05"
                d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
              />
              <path
                fill="#EB4335"
                d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
              />
            </svg>
            {isLoading ? "Connecting..." : "Continue with Google"}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </Link>
            </p>
            <p className="text-sm">
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-6 text-xs text-center text-muted-foreground max-w-md mx-4">
        By signing in, you agree to our{" "}
        <Link
          href="/terms-of-service"
          className="underline hover:text-foreground"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy-policy"
          className="underline hover:text-foreground"
        >
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

// Loading skeleton component
function SignInSkeleton() {
  return (
    <div className="flex flex-col justify-center items-center w-full h-screen">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="flex items-center justify-center">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main page component with proper Suspense boundaries
export default function SignInPage() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInContent />
    </Suspense>
  );
}

// Force dynamic rendering for authentication pages
export const dynamic = 'force-dynamic';