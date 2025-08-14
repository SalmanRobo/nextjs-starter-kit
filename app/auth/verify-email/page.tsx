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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Mail,
  RefreshCw,
  ArrowLeft,
  WifiOff,
  Clock
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";

function EmailVerificationContent() {
  const { 
    sendEmailVerification, 
    verifyEmail, 
    isLoading, 
    error, 
    clearError,
    user,
    isEmailVerified
  } = useAuth();
  
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'sending' | 'success' | 'error'>('pending');
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [autoVerifyAttempted, setAutoVerifyAttempted] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle verification from URL token
  useEffect(() => {
    const token = searchParams.get('token_hash') || searchParams.get('token');
    const type = searchParams.get('type');

    if (token && !autoVerifyAttempted) {
      setAutoVerifyAttempted(true);
      handleTokenVerification(token);
    }
  }, [searchParams, autoVerifyAttempted]);

  // Redirect if already verified
  useEffect(() => {
    if (isEmailVerified && verificationStatus === 'success') {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isEmailVerified, verificationStatus, router]);

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
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Progress simulation for loading states
  useEffect(() => {
    if (isLoading('emailVerification')) {
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
  }, [isLoading]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Handle token verification
  const handleTokenVerification = async (token: string) => {
    setVerificationStatus('pending');
    clearError();
    
    const result = await verifyEmail(token);
    
    if (result.success) {
      setVerificationStatus('success');
      toast.success('Email verified successfully!');
    } else {
      setVerificationStatus('error');
      toast.error('Email verification failed. Please try again.');
    }
  };

  // Handle resend verification
  const handleResendVerification = async () => {
    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again.`);
      return;
    }

    if (!isOnline) {
      toast.error('Please check your internet connection and try again.');
      return;
    }

    setVerificationStatus('sending');
    clearError();
    
    const result = await sendEmailVerification();
    
    if (result.success) {
      setCooldownSeconds(60); // 60 second cooldown
      toast.success('Verification email sent! Check your inbox.');
    } else {
      setVerificationStatus('pending');
    }
  };

  // Success view
  if (verificationStatus === 'success' || isEmailVerified) {
    return (
      <div className="flex flex-col justify-center items-center w-full min-h-screen py-8">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Email Verified Successfully!
            </CardTitle>
            <CardDescription>
              Your email address has been confirmed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your account is now fully activated. You can access all features.
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You'll be automatically redirected to your dashboard in a few seconds.
              </p>
              
              <Link href="/dashboard">
                <Button className="w-full">
                  Continue to Dashboard
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
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Verify Your Email
          </CardTitle>
          <CardDescription>
            {user?.email ? (
              <>We've sent a verification link to <span className="font-medium">{user.email}</span></>
            ) : (
              "Check your email for a verification link"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading progress */}
          {isLoading('emailVerification') && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {verificationStatus === 'sending' ? 'Sending verification email...' : 'Verifying your email...'}
              </p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error.message}
                {error.hint && (
                  <div className="mt-1 text-sm text-red-600">
                    Tip: {error.hint}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Click the verification link in your email to activate your account.</p>
              <p>Can't find the email? Check your spam folder.</p>
            </div>
            
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleResendVerification}
                disabled={isLoading('emailVerification') || cooldownSeconds > 0 || !isOnline}
              >
                {isLoading('emailVerification') ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Resend in {cooldownSeconds}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
              
              <Link href="/dashboard">
                <Button variant="ghost" className="w-full">
                  Skip for Now
                </Button>
              </Link>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact support
              </Link>
            </div>
          </div>
          
          {/* Info section */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-2">
              <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Why verify your email?</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Secure your account from unauthorized access</li>
                  <li>• Receive important notifications</li>
                  <li>• Access all platform features</li>
                  <li>• Enable password recovery options</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer links */}
      <div className="mt-6 text-center space-y-2">
        <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="inline mr-1 h-3 w-3" />
          Back to Sign In
        </Link>
        
        <p className="text-xs text-muted-foreground">
          Using a different email?{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Create new account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function EmailVerification() {
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
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <EmailVerificationContent />
    </Suspense>
  );
}