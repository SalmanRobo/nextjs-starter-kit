import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SectionCards } from "./_components/section-cards";
import { ChartAreaInteractive } from "./_components/chart-interactive";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

// Loading component for dashboard content
function DashboardSkeleton() {
  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </Card>
              ))}
            </div>
            <Card className="p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-64 w-full" />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

// Main dashboard content component
async function DashboardContent() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Dashboard auth error:', error);
      redirect("/sign-in?error=auth_failed");
    }

    if (!user) {
      redirect("/sign-in");
    }

    // Check email verification status
    if (!user.email_confirmed_at) {
      redirect("/auth/verify-email");
    }

    return (
      <section className="flex flex-col items-start justify-start p-6 w-full">
        <div className="w-full">
          <div className="flex flex-col items-start justify-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
            </h1>
            <p className="text-muted-foreground">
              Interactive chart with data visualization and interactive elements.
            </p>
          </div>
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Suspense fallback={
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="p-6">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </Card>
                  ))}
                </div>
              }>
                <SectionCards />
              </Suspense>
              <Suspense fallback={
                <Card className="p-6">
                  <Skeleton className="h-6 w-48 mb-4" />
                  <Skeleton className="h-64 w-full" />
                </Card>
              }>
                <ChartAreaInteractive />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    redirect("/sign-in?error=dashboard_error");
  }
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

// Ensure this page is dynamically rendered for proper auth checks
export const dynamic = 'force-dynamic';
