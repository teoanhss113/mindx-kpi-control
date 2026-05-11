/**
 * serverAuth.ts
 * Server-side authentication helpers for API routes and server actions.
 *
 * Verifies Firebase ID tokens against Google's public token endpoint, then
 * looks up the user's profile / role in Supabase.
 *
 * Usage:
 *   const user = await requireUser(request);            // any authenticated user
 *   const admin = await requireAdmin(request);          // throws unless admin
 *
 * For server actions (no NextRequest), pass the idToken explicitly:
 *   const admin = await requireAdminToken(idToken);
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getFirebaseLookupUrl(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is not configured');
  return `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  profileId: string;
  roleName: string | null;
  isAdmin: boolean;
  isActive: boolean;
}

export function extractBearer(request: NextRequest): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) throw new AuthError('Missing Authorization header');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError('Malformed Authorization header');
  return match[1].trim();
}

/**
 * Verify a Firebase ID token by calling the Identity Toolkit lookup endpoint.
 * Returns the Firebase user info (uid, email) on success.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email: string }> {
  if (!idToken || idToken.length < 20) throw new AuthError('Invalid token');

  const res = await fetch(getFirebaseLookupUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) throw new AuthError('Token verification failed');

  const data = await res.json();
  const user = data?.users?.[0];
  if (!user?.localId) throw new AuthError('Token verification failed');

  return { uid: user.localId, email: (user.email || '').toLowerCase() };
}

/**
 * Resolve the Supabase profile for a verified Firebase user.
 * Looks up by Firebase UID first, then falls back to email
 * (matches the existing sync-profile behaviour).
 */
async function loadProfile(
  uid: string,
  email: string,
): Promise<AuthenticatedUser> {
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role_id, is_active, roles ( name )')
    .eq('id', uid)
    .maybeSingle();

  if (!profile && email) {
    const fallback = await supabaseAdmin
      .from('profiles')
      .select('id, email, role_id, is_active, roles ( name )')
      .eq('email', email)
      .maybeSingle();
    profile = fallback.data || null;
  }

  if (!profile) throw new AuthError('Profile not found', 403);
  if (!profile.is_active) throw new AuthError('Account is disabled', 403);

  const roleName: string | null =
    (profile as any).roles?.name ?? null;

  return {
    uid,
    email,
    profileId: profile.id,
    roleName,
    isAdmin: roleName === 'Admin',
    isActive: !!profile.is_active,
  };
}

export async function requireUserToken(idToken: string): Promise<AuthenticatedUser> {
  const { uid, email } = await verifyFirebaseIdToken(idToken);
  return loadProfile(uid, email);
}

export async function requireAdminToken(idToken: string): Promise<AuthenticatedUser> {
  const user = await requireUserToken(idToken);
  if (!user.isAdmin) throw new AuthError('Admin access required', 403);
  return user;
}

export async function requireUser(request: NextRequest): Promise<AuthenticatedUser> {
  return requireUserToken(extractBearer(request));
}

export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser> {
  return requireAdminToken(extractBearer(request));
}

/**
 * Convert an AuthError into a NextResponse. Use inside try/catch in route handlers.
 */
export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[authErrorResponse] Unexpected error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
