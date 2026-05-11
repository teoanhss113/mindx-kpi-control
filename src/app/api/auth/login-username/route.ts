import { NextRequest, NextResponse } from 'next/server';

const LMS_BASE_URL = 'https://base-api.mindx.edu.vn/';

// Simple in-memory rate limiter: max 10 attempts per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Forward request to LMS API
    const lmsRes = await fetch(LMS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
      },
      body: JSON.stringify({
        operationName: 'loginWithUsername',
        variables: { username, password },
        query: `mutation loginWithUsername($username: String!, $password: String!) {
          users {
            loginWithUsername(
              loginWithUsernameInput: {username: $username, password: $password}
            ) {
              customToken
              __typename
            }
            __typename
          }
        }`,
      }),
    });

    if (!lmsRes.ok) {
      return NextResponse.json(
        { error: 'LMS authentication failed' },
        { status: lmsRes.status }
      );
    }

    const lmsData = await lmsRes.json();

    // Return the response from LMS
    return NextResponse.json(lmsData);
  } catch (error) {
    console.error('Login username proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
