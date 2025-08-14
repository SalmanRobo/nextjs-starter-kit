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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Loader2, Mail, ArrowLeft, WifiOff, Shield, Clock, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validateEmailRealTime } from "@/lib/auth/validation";

// Enhanced validation schema
const validateEmail = (email: string): string[] => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push("Email is required");
    return errors;
  }
  
  if (email.length > 320) {
    errors.push("Email is too long");
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push("Please enter a valid email address");
  }
  
  return errors;
};

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  const supabase = createClient();

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

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Real-time validation
  useEffect(() => {
    if (email && submitAttempted) {
      const errors = validateEmail(email);
      setEmailErrors(errors);
    } else {
      setEmailErrors([]);
    }
  }, [email, submitAttempted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!isOnline) {
      toast.error('Please check your internet connection and try again.');
      return;
    }

    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again.`);
      return;
    }

    // Validate email
    const errors = validateEmail(email);
    setEmailErrors(errors);
    
    if (errors.length > 0) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send reset email');
        toast.error('Failed to send reset email');
        setCooldownSeconds(30); // Short cooldown on error
      } else {
        setSubmitted(true);
        setCooldownSeconds(60); // 60 second cooldown on success
        toast.success('Reset email sent!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      setCooldownSeconds(30);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again.`);
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send reset email');
        toast.error('Failed to send reset email');
      } else {
        setCooldownSeconds(60);
        toast.success('Reset email sent again!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Check Your Email
            </CardTitle>
            <CardDescription>
              We've sent password reset instructions to{" "}
              <span className="font-medium">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success message */}
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Reset email sent successfully! Check your inbox and spam folder.
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Click the link in the email to reset your password.</p>
                <p>The link will expire in <strong>1 hour</strong> for security.</p>
                <p>Can't find the email? Check your spam folder.</p>
              </div>
              
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleResend}
                  disabled={loading || cooldownSeconds > 0 || !isOnline}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    `Resend in ${cooldownSeconds}s`
                  ) : (
                    "Resend Email"
                  )}
                </Button>
                
                <Link href="/sign-in">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Still having trouble?{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  Contact support
                </Link>
              </div>
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
          <CardTitle className="text-2xl font-bold">
            Forgot Password?
          </CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading progress */}
          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Sending reset email...
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
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={cn(
                    "pl-10",
                    emailErrors.length > 0 && "border-red-500 focus:border-red-500"
                  )}
                />
              </div>
              {emailErrors.length > 0 && (
                <p className="text-sm text-red-600">{emailErrors[0]}</p>
              )}
              <p className="text-xs text-muted-foreground">
                We'll send a secure link to this email address
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || cooldownSeconds > 0 || !isOnline}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Reset Email...
                </>
              ) : cooldownSeconds > 0 ? (
                `Wait ${cooldownSeconds}s`
              ) : (
                "Send Reset Email"
              )}
            </Button>
          </form>
          
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link href="/sign-in" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
            
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/sign-up" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
          
          {/* Security info */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Security Notice</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Reset links expire after 1 hour</li>
                  <li>• Only the most recent link will work</li>
                  <li>• Check your spam folder if you don't see the email</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}