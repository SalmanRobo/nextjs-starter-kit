"use client";

// Disable static generation for this page
export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { CrossDomainSignUpForm } from "@/components/auth/cross-domain-signup-form";
import { CrossDomainAuthProvider } from "@/components/auth/cross-domain-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

// Main sign-up component
function SignUpContent() {
  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen py-8 px-4 bg-gradient-to-br from-background via-background to-muted/20">
      <CrossDomainSignUpForm className="animate-scale-in" />
    </div>
  );
}

// Loading skeleton component
function SignUpSkeleton() {
  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen py-8 px-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-80 mx-auto" />
        </div>
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    </div>
  );
}

// Main page component with cross-domain auth provider
export default function SignUpPage() {
  return (
    <CrossDomainAuthProvider>
      <Suspense fallback={<SignUpSkeleton />}>
        <SignUpContent />
      </Suspense>
    </CrossDomainAuthProvider>
  );
}