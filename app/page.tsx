'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  useEffect(() => {
    // Refresh profile when component mounts if user is logged in
    if (user && !profile) {
      refreshProfile();
    }
  }, [user, profile, refreshProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {user ? (
          <h1 className="text-4xl font-bold mb-8">
            Hello{profile?.firstName ? `, ${profile.firstName}` : ''}!
          </h1>
        ) : (
          <h1 className="text-4xl font-bold mb-8">Welcome to j-run</h1>
        )}

        {user ? (
          <div className="space-y-4">
            <div className="p-6 border rounded-lg bg-green-50">
              <p className="text-lg font-semibold text-green-800">
                ✅ You&apos;re signed in!
              </p>
              <p className="text-sm text-green-600 mt-2">
                Email: {user.email}
              </p>
              {profile && (
                <p className="text-sm text-green-600 mt-1">
                  Name: {profile.firstName} {profile.lastName}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <Button onClick={signOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
