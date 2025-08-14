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
      <div className="auth-page flex flex-col justify-center items-center w-full min-h-screen py-8 px-4">
        <div className="w-full max-w-md animate-scale-in">
          {/* ALDARI Logo/Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-success to-aldari-gold rounded-2xl mb-4 shadow-auth">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-display-sm text-foreground mb-2">
              Email verified successfully!
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Your ALDARI account is now fully activated and ready to use
            </p>
          </div>

          <Card className="auth-card w-full">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-xl font-semibold text-foreground">
                Welcome to ALDARI
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-2">
                Your account verification is complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20 animate-slide-down">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-success">
                      Account fully activated
                    </p>
                    <p className="text-2xs text-success/80 mt-1">
                      You now have access to all platform features and can start exploring properties.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  You'll be automatically redirected to your dashboard in a few seconds.
                </p>
                
                <Link href="/dashboard">
                  <button className="auth-button-primary w-full">
                    Continue to Dashboard
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page flex flex-col justify-center items-center w-full min-h-screen py-8 px-4">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 shadow-auth">
            <div className="flex items-center space-x-3">
              <WifiOff className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                You're offline. Please check your internet connection.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md animate-scale-in">
        {/* ALDARI Logo/Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-aldari-gold rounded-2xl mb-4 shadow-auth">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-display-sm text-foreground mb-2">
            Verify your email
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {user?.email ? (
              <>We've sent a verification link to <span className="font-semibold text-foreground">{user.email}</span></>
            ) : (
              "Check your email for a verification link to activate your account"
            )}
          </p>
        </div>

        <Card className="auth-card w-full">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-semibold text-foreground">
              Email verification required
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-2">
              Complete your account setup by verifying your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {/* Loading progress */}
            {isLoading('emailVerification') && (
              <div className="space-y-3 animate-fade-in">
                <Progress value={progress} className="w-full h-2" />
                <p className="text-sm text-center text-muted-foreground font-medium">
                  {verificationStatus === 'sending' ? 'Sending verification email...' : 'Verifying your email...'}
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-slide-down">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {error.message}
                    </p>
                    {error.hint && (
                      <p className="text-2xs text-destructive/80 mt-1">
                        Tip: {error.hint}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-center space-y-5">
              <div className="text-sm text-muted-foreground space-y-3">
                <p className="leading-relaxed">Click the verification link in your email to activate your account.</p>
                <p className="text-2xs">Can't find the email? Check your spam folder or try resending.</p>
              </div>
              
              <div className="space-y-3">
                <button
                  className={cn(
                    "auth-button-secondary w-full",
                    (isLoading('emailVerification') || cooldownSeconds > 0 || !isOnline) && "cursor-not-allowed opacity-70"
                  )}
                  onClick={handleResendVerification}
                  disabled={isLoading('emailVerification') || cooldownSeconds > 0 || !isOnline}
                >
                  {isLoading('emailVerification') ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : cooldownSeconds > 0 ? (
                    <div className="flex items-center justify-center">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>Resend in {cooldownSeconds}s</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      <span>Resend verification email</span>
                    </div>
                  )}
                </button>
                
                <Link href="/dashboard">
                  <button className="w-full h-12 px-6 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30 font-medium transition-all duration-200">
                    Skip for now
                  </button>
                </Link>
              </div>
              
              <div className="text-2xs text-muted-foreground">
                Need help?{" "}
                <Link href="/contact" className="text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline transition-colors">
                  Contact support
                </Link>
              </div>
            </div>
            
            {/* Enhanced Info section */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-start space-x-3">
                <div className="p-1 rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                </div>
                <div className="text-2xs">
                  <p className="font-semibold text-foreground mb-2">Why verify your email?</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li className="flex items-start space-x-2">
                      <span className="mt-1.5 w-1 h-1 bg-primary rounded-full flex-shrink-0"></span>
                      <span>Secure your account from unauthorized access</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="mt-1.5 w-1 h-1 bg-primary rounded-full flex-shrink-0"></span>
                      <span>Receive important property notifications</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="mt-1.5 w-1 h-1 bg-primary rounded-full flex-shrink-0"></span>
                      <span>Access all ALDARI platform features</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="mt-1.5 w-1 h-1 bg-primary rounded-full flex-shrink-0"></span>
                      <span>Enable password recovery options</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer links */}
        <div className="text-center mt-8 space-y-3">
          <Link href="/sign-in" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-3 w-3" />
            Back to Sign In
          </Link>
          
          <p className="text-2xs text-muted-foreground/80">
            Using a different email?{" "}
            <Link href="/sign-up" className="text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline transition-colors">
              Create new account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EmailVerification() {
  return (
    <Suspense
      fallback={
        <div className="auth-page flex flex-col justify-center items-center w-full min-h-screen py-8 px-4">
          <div className="w-full max-w-md">
            {/* Logo skeleton */}
            <div className="text-center mb-8">
              <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
              <Skeleton className="h-8 w-64 mx-auto mb-2" />
              <Skeleton className="h-4 w-80 mx-auto" />
            </div>

            <Card className="auth-card w-full">
              <CardHeader className="text-center pb-6">
                <Skeleton className="h-6 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto" />
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="text-center space-y-5">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4 mx-auto" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                  <Skeleton className="h-3 w-32 mx-auto" />
                </div>
                <div className="p-4 rounded-xl bg-muted/20">
                  <div className="flex items-start space-x-3">
                    <Skeleton className="w-6 h-6 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-5/6" />
                      <Skeleton className="h-2 w-4/6" />
                      <Skeleton className="h-2 w-3/6" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="text-center mt-8 space-y-3">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-3 w-48 mx-auto" />
            </div>
          </div>
        </div>
      }
    >
      <EmailVerificationContent />
    </Suspense>
  );
}