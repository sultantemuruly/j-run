import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user profile exists, if not create it
      const existingUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, data.user.id))
        .limit(1);

      if (existingUser.length === 0) {
        // Extract name from user metadata
        // For email signup, check user_metadata for first_name/last_name
        // For OAuth providers like Google, extract from full_name or name
        const firstName =
          data.user.user_metadata?.first_name ||
          data.user.user_metadata?.full_name?.split(' ')[0] ||
          data.user.user_metadata?.name?.split(' ')[0] ||
          'User';
        const lastName =
          data.user.user_metadata?.last_name ||
          data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
          data.user.user_metadata?.name?.split(' ').slice(1).join(' ') ||
          '';

        // Create user profile
        try {
          await db.insert(usersTable).values({
            id: data.user.id,
            email: data.user.email!,
            firstName: firstName || 'User',
            lastName: lastName || firstName || 'User',
          });
        } catch (err) {
          console.error('Error creating user profile:', err);
          // Continue anyway - user can update profile later
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}

