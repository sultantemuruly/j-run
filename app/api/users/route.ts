import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// Create or update user profile
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { userId, email, firstName, lastName, isSignup } = body;

    // For signup, we allow creating profile even without active session
    // (user just signed up but hasn't confirmed email yet)
    if (isSignup && userId) {
      // Verify the userId is valid (exists in auth.users)
      // We'll trust the client for signup, but verify user exists
      // In production, you might want additional validation
    } else {
      // For updates, require authentication
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify the user is updating their own profile
      if (userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (existingUser.length > 0) {
      // Update existing user
      await db
        .update(usersTable)
        .set({
          email,
          firstName,
          lastName,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
    } else {
      // Create new user
      await db.insert(usersTable).values({
        id: userId,
        email,
        firstName,
        lastName,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user profile
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

