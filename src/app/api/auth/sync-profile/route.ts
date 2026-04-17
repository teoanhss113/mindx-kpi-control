import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Sync user profile from Firebase to Supabase
 * Creates or updates profile based on email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, displayName } = body;

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'uid and email are required' },
        { status: 400 }
      );
    }

    // 1. Check if profile exists with this UID
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (existingProfile) {
      // Profile exists, just return it
      return NextResponse.json({
        success: true,
        action: 'found',
        profile: existingProfile,
      });
    }

    // 2. Check if profile exists with this email (created with temp ID)
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profileByEmail) {
      // Update the profile ID to match Firebase UID
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ id: uid })
        .eq('email', email)
        .select()
        .single();

      if (updateError) {
        // If update fails (e.g., ID conflict), delete old and create new
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('email', email);

        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: uid,
            email: email,
            role_id: profileByEmail.role_id,
            is_active: profileByEmail.is_active,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: 'Failed to create profile', details: createError },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'recreated',
          profile: newProfile,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        profile: updatedProfile,
      });
    }

    // 3. No profile exists, create new one (no role assigned)
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: uid,
        email: email,
        role_id: null,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create profile', details: createError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      profile: newProfile,
      warning: 'No role assigned. Please contact admin to assign a role.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
// Improved token validation
