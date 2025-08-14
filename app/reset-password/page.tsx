"use client";

// Disable static generation for this page
export const dynamic = 'force-dynamic';

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Shield,
  ArrowLeft,
  WifiOff
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validatePasswordRealTime, getPasswordStrength } from "@/lib/auth/validation";

function ResetPasswordContent() {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    accessToken: "",
    refreshToken: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [] as string[],
    isStrong: false,
  });
  const [tokenExpired, setTokenExpired] = useState(false);
  const [resetSuccessful, setResetSuccessful] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [confirmPasswordErrors, setConfirmPasswordErrors] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // Extract tokens from URL
  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error || errorDescription) {
      setTokenExpired(true);
      toast.error(errorDescription || 'Invalid or expired reset link');
      return;
    }

    if (accessToken && refreshToken) {
      setFormData(prev => ({
        ...prev,
        accessToken,
        refreshToken,
      }));
    } else {
      setTokenExpired(true);
      toast.error('Invalid reset link. Please request a new password reset.');
    }
  }, [searchParams]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Clear error when user starts typing
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Progress simulation for loading states
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
      
      return () => {
        clearInterval(interval);
        setProgress(0);
      };
    }
  }, [loading]);

  // Password strength monitoring
  useEffect(() => {
    if (formData.password) {
      const strength = getPasswordStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, feedback: [], isStrong: false });
    }
  }, [formData.password]);

  // Real-time validation
  useEffect(() => {
    if (formData.password && submitAttempted) {
      const { errors } = validatePasswordRealTime(formData.password);
      setPasswordErrors(errors);
    } else {
      setPasswordErrors([]);
    }
  }, [formData.password, submitAttempted]);

  useEffect(() => {
    if (formData.confirmPassword && submitAttempted && formData.confirmPassword !== formData.password) {
      setConfirmPasswordErrors(["Passwords don't match"]);
    } else {
      setConfirmPasswordErrors([]);
    }
  }, [formData.confirmPassword, formData.password, submitAttempted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!isOnline) {
      toast.error('Please check your internet connection and try again.');
      return;
    }

    if (tokenExpired) {
      toast.error('Reset link has expired. Please request a new one.');
      return;
    }

    // Validate password
    const { errors } = validatePasswordRealTime(formData.password);
    setPasswordErrors(errors);
    
    if (errors.length > 0) {
      toast.error('Please fix the password errors above.');
      return;
    }

    // Check password strength
    if (!passwordStrength.isStrong) {
      toast.error('Please choose a stronger password.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match.');
      setConfirmPasswordErrors(["Passwords don't match"]);
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      // Set session from tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: formData.accessToken,
        refresh_token: formData.refreshToken,
      });

      if (sessionError) {
        setError(sessionError.message || 'Invalid or expired reset link');
        setTokenExpired(true);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password');
        toast.error('Failed to update password');
      } else {
        setResetSuccessful(true);
        toast.success('Password updated successfully!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get password strength color
  const getPasswordStrengthColor = (score: number) => {
    if (score <= 2) return "bg-red-500";
    if (score <= 4) return "bg-yellow-500";
    if (score <= 6) return "bg-blue-500";
    return "bg-green-500";
  };

  // Get password strength text
  const getPasswordStrengthText = (score: number) => {
    if (score <= 2) return "Weak";
    if (score <= 4) return "Fair";
    if (score <= 6) return "Good";
    return "Strong";
  };

  // Token expired view
  if (tokenExpired) {
    return (
      <div className="flex flex-col justify-center items-center w-full min-h-screen py-8">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Link Expired
            </CardTitle>
            <CardDescription>
              This password reset link has expired or is invalid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                For security reasons, password reset links expire after 1 hour.
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Please request a new password reset link to continue.
              </p>
              
              <div className="space-y-2">
                <Link href="/forgot-password">
                  <Button className="w-full">
                    Request New Reset Link
                  </Button>
                </Link>
                
                <Link href="/sign-in">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success view
  if (resetSuccessful) {
    return (
      <div className="flex flex-col justify-center items-center w-full min-h-screen py-8">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Password Reset Successful
            </CardTitle>
            <CardDescription>
              Your password has been updated successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                You can now sign in with your new password.
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                For your security, please sign in with your new password.
              </p>
              
              <Link href="/sign-in">
                <Button className="w-full">
                  Continue to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen py-8">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You're offline. Please check your internet connection.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Set New Password
          </CardTitle>
          <CardDescription>
            Choose a strong password to secure your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading progress */}
          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Updating your password...
              </p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  disabled={loading}
                  className={cn(
                    "pr-10",
                    passwordErrors.length > 0 && "border-red-500 focus:border-red-500"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              {/* Password strength indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Password strength:</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        passwordStrength.score <= 2 && "border-red-500 text-red-600",
                        passwordStrength.score > 2 && passwordStrength.score <= 4 && "border-yellow-500 text-yellow-600",
                        passwordStrength.score > 4 && passwordStrength.score <= 6 && "border-blue-500 text-blue-600",
                        passwordStrength.score > 6 && "border-green-500 text-green-600"
                      )}
                    >
                      {getPasswordStrengthText(passwordStrength.score)}
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        getPasswordStrengthColor(passwordStrength.score)
                      )}
                      style={{ width: `${Math.min(100, (passwordStrength.score / 7) * 100)}%` }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {passwordStrength.feedback.map((feedback, index) => (
                        <li key={index} className="flex items-center space-x-1">
                          <span>•</span>
                          <span>{feedback}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              
              {passwordErrors.length > 0 && (
                <p className="text-sm text-red-600">{passwordErrors[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  disabled={loading}
                  className={cn(
                    "pr-10",
                    confirmPasswordErrors.length > 0 && "border-red-500 focus:border-red-500"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {formData.confirmPassword && formData.password && formData.confirmPassword === formData.password && (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Passwords match</span>
                </div>
              )}
              {confirmPasswordErrors.length > 0 && (
                <p className="text-sm text-red-600">{confirmPasswordErrors[0]}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                loading || 
                !isOnline || 
                !passwordStrength.isStrong ||
                formData.password !== formData.confirmPassword
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
          
          <div className="text-center">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="inline mr-1 h-3 w-3" />
              Back to Sign In
            </Link>
          </div>
          
          {/* Security info */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Password Requirements</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• At least 8 characters long</li>
                  <li>• Include uppercase and lowercase letters</li>
                  <li>• Include at least one number</li>
                  <li>• Include at least one special character</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col justify-center items-center w-full h-screen">
          <Card className="max-w-md w-full mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse mb-4" />
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mx-auto mb-2" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mx-auto" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}