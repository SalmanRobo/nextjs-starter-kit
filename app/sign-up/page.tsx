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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Wifi, 
  WifiOff,
  Shield,
  User,
  Building,
  Phone,
  Mail
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { 
  validateEmailRealTime, 
  validatePasswordRealTime, 
  validateNameRealTime, 
  validatePhoneRealTime,
  getPasswordStrength 
} from "@/lib/auth/validation";
import { SignUpCredentials, FormErrors } from "@/lib/auth/types";
import { OAUTH_PROVIDERS, SITE_CONFIG } from "@/lib/auth/config";

function SignUpContent() {
  const { signUp, signInWithOAuth, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<SignUpCredentials>({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    acceptTerms: false,
    subscribeNewsletter: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [] as string[],
    isStrong: false,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [acceptedTermsTimestamp, setAcceptedTermsTimestamp] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnTo = searchParams.get("redirectTo") || searchParams.get("redirectedFrom") || "/dashboard";
  const inviteCode = searchParams.get("invite");

  // Set invite code if present
  useEffect(() => {
    if (inviteCode) {
      setFormData(prev => ({ ...prev, inviteCode }));
    }
  }, [inviteCode]);

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
    if (isLoading('signUp')) {
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
  const validateField = useCallback((field: keyof SignUpCredentials, value: any) => {
    const errors: string[] = [];
    
    switch (field) {
      case 'email':
        if (value && submitAttempted) {
          errors.push(...validateEmailRealTime(value));
        }
        break;
      case 'password':
        if (value && submitAttempted) {
          const { errors: pwdErrors } = validatePasswordRealTime(value);
          errors.push(...pwdErrors);
        }
        break;
      case 'confirmPassword':
        if (value && submitAttempted && value !== formData.password) {
          errors.push("Passwords don't match");
        }
        break;
      case 'fullName':
        if (value && submitAttempted) {
          const { errors: nameErrors } = validateNameRealTime(value, true);
          errors.push(...nameErrors);
        }
        break;
      case 'phone':
        if (value && submitAttempted) {
          const { errors: phoneErrors } = validatePhoneRealTime(value);
          errors.push(...phoneErrors);
        }
        break;
      case 'acceptTerms':
        if (submitAttempted && !value) {
          errors.push("You must accept the terms of service to continue");
        }
        break;
    }
    
    setFormErrors(prev => ({
      ...prev,
      [field]: errors.length > 0 ? errors : undefined,
    }));
  }, [submitAttempted, formData.password]);

  // Handle input changes
  const handleInputChange = (field: keyof SignUpCredentials, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Handle terms acceptance timestamp
    if (field === 'acceptTerms' && value) {
      setAcceptedTermsTimestamp(new Date().toISOString());
    }
    
    validateField(field, value);
  };

  // OAuth sign up
  const handleOAuthSignUp = async (provider: 'google' | 'github' | 'apple') => {
    if (!isOnline) {
      toast.error('Please check your internet connection and try again.');
      return;
    }

    clearError();
    await signInWithOAuth({
      provider,
      redirectTo: returnTo,
    });
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!isOnline) {
      toast.error('Please check your internet connection and try again.');
      return;
    }

    // Validate all fields
    Object.keys(formData).forEach(key => {
      validateField(key as keyof SignUpCredentials, formData[key as keyof SignUpCredentials]);
    });
    
    // Check for validation errors
    const hasErrors = Object.values(formErrors).some(errors => errors && errors.length > 0);
    if (hasErrors) {
      toast.error('Please fix the errors above and try again.');
      return;
    }

    // Check password strength
    if (!passwordStrength.isStrong) {
      toast.error('Please choose a stronger password.');
      return;
    }

    clearError();
    const credentials = {
      ...formData,
      acceptTerms: true, // Ensure this is true
    };
    
    await signUp(credentials);
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

  // Multi-step form navigation
  const nextStep = () => {
    if (currentStep === 1) {
      // Validate step 1 fields
      validateField('fullName', formData.fullName);
      validateField('email', formData.email);
      validateField('phone', formData.phone);
      
      const stepErrors = ['fullName', 'email', 'phone'].some(field => 
        formErrors[field as keyof FormErrors]?.length
      );
      
      if (!stepErrors && formData.fullName && formData.email) {
        setCurrentStep(2);
      } else {
        toast.error('Please complete all required fields correctly.');
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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

      <Card className="max-w-lg w-full mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Join ALDARI
          </CardTitle>
          <CardDescription>
            Create your account to start exploring premium properties in Saudi Arabia
          </CardDescription>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              1
            </div>
            <div className={cn("w-8 h-1", currentStep >= 2 ? "bg-primary" : "bg-muted")} />
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              2
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading progress */}
          {isLoading('signUp') && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Creating your account...
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

          {/* Invite code display */}
          {inviteCode && (
            <Alert className="bg-blue-50 border-blue-200">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                You're signing up with an invite code. You'll have access to exclusive features!
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Personal Information</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                    disabled={isLoading('signUp')}
                    className={cn(
                      formErrors.fullName && formErrors.fullName.length > 0 && "border-red-500 focus:border-red-500"
                    )}
                  />
                  {formErrors.fullName && formErrors.fullName.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.fullName[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                      disabled={isLoading('signUp')}
                      className={cn(
                        "pl-10",
                        formErrors.email && formErrors.email.length > 0 && "border-red-500 focus:border-red-500"
                      )}
                    />
                  </div>
                  {formErrors.email && formErrors.email.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.email[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+966 50 123 4567"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={isLoading('signUp')}
                      className={cn(
                        "pl-10",
                        formErrors.phone && formErrors.phone.length > 0 && "border-red-500 focus:border-red-500"
                      )}
                    />
                  </div>
                  {formErrors.phone && formErrors.phone.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.phone[0]}</p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={nextStep}
                  className="w-full"
                  disabled={isLoading('signUp') || !isOnline}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Password and Terms */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Security & Agreement</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      disabled={isLoading('signUp')}
                      className={cn(
                        "pr-10",
                        formErrors.password && formErrors.password.length > 0 && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading('signUp')}
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
                  
                  {formErrors.password && formErrors.password.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.password[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      disabled={isLoading('signUp')}
                      className={cn(
                        "pr-10",
                        formErrors.confirmPassword && formErrors.confirmPassword.length > 0 && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading('signUp')}
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
                  {formErrors.confirmPassword && formErrors.confirmPassword.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.confirmPassword[0]}</p>
                  )}
                </div>

                {/* Terms and conditions */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="acceptTerms"
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) => handleInputChange('acceptTerms', checked)}
                      disabled={isLoading('signUp')}
                      className={cn(
                        "mt-1",
                        formErrors.acceptTerms && "border-red-500"
                      )}
                    />
                    <Label htmlFor="acceptTerms" className="text-sm leading-5">
                      I agree to the{" "}
                      <Link
                        href="/terms-of-service"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy-policy"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>
                  {formErrors.acceptTerms && formErrors.acceptTerms.length > 0 && (
                    <p className="text-sm text-red-600">{formErrors.acceptTerms[0]}</p>
                  )}

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="subscribeNewsletter"
                      checked={formData.subscribeNewsletter}
                      onCheckedChange={(checked) => handleInputChange('subscribeNewsletter', checked)}
                      disabled={isLoading('signUp')}
                    />
                    <Label htmlFor="subscribeNewsletter" className="text-sm leading-5 text-muted-foreground">
                      Send me updates about new properties and market insights (optional)
                    </Label>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="w-full"
                    disabled={isLoading('signUp')}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading('signUp') || !isOnline || !formData.acceptTerms}
                  >
                    {isLoading('signUp') ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* OAuth providers */}
          {currentStep === 1 && (OAUTH_PROVIDERS.google.enabled || OAUTH_PROVIDERS.github.enabled) && (
            <>
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

              <div className="grid gap-2">
                {OAUTH_PROVIDERS.google.enabled && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isLoading() || !isOnline}
                    onClick={() => handleOAuthSignUp('google')}
                  >
                    {isLoading('oauthSignIn') ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
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
                    )}
                    {isLoading('oauthSignIn') ? "Connecting..." : "Continue with Google"}
                  </Button>
                )}
                
                {OAUTH_PROVIDERS.github.enabled && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isLoading() || !isOnline}
                    onClick={() => handleOAuthSignUp('github')}
                  >
                    {isLoading('oauthSignIn') ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {isLoading('oauthSignIn') ? "Connecting..." : "Continue with GitHub"}
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Legal footer */}
      <p className="mt-6 text-xs text-center text-muted-foreground max-w-md mx-4">
        By creating an account, you agree to our{" "}
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
        . We'll send you account-related emails.
      </p>
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col justify-center items-center w-full h-screen">
          <Card className="max-w-lg w-full mx-4">
            <CardHeader className="text-center">
              <Skeleton className="h-8 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <div className="flex items-center justify-center space-x-2 mt-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-1" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
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
      }
    >
      <SignUpContent />
    </Suspense>
  );
}