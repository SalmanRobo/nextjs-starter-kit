"use client";

import { Suspense } from "react";
import { StandaloneSignInForm } from "@/components/auth/standalone-signin-form";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton component
function SignInSkeleton() {
  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen py-8 px-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-80 mx-auto" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

// Main sign-in component wrapped in Suspense
function SignInContent() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <div className="flex flex-col justify-center items-center w-full min-h-screen py-8 px-4 bg-gradient-to-br from-background via-background to-muted/20">
        <StandaloneSignInForm className="animate-scale-in" />
      </div>
    </Suspense>
  );
}

// Main page component
export default function SignInPage() {
  return <SignInContent />;
}

// Force dynamic rendering for authentication pages
export const dynamic = 'force-dynamic';