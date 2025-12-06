'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import DashboardPage from "@/components/custom/dashboard-page";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Show dashboard if user is authenticated
  if (user) {
    return <DashboardPage />;
  }

  // Show login/signup page if user is not authenticated
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Welcome to j-run</h1>
        <div className="space-y-4">
          <div className="p-6 border rounded-lg">
            <p className="text-lg mb-4">Please sign in to continue</p>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
