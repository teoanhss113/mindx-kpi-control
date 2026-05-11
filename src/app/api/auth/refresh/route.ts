import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rt';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

// POST: exchange httpOnly refreshToken cookie for a fresh idToken
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });

  if (!res.ok) {
    // Token invalid or revoked — clear the stale cookie
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const data = await res.json();
  const expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;

  const response = NextResponse.json({ idToken: data.id_token, expiresAt });
  // Rotate the refresh token to detect theft
  response.cookies.set(COOKIE_NAME, data.refresh_token, COOKIE_OPTS);
  return response;
}
