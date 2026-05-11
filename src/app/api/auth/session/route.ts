import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rt';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

// POST: persist refreshToken in httpOnly cookie after login
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();
    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json({ error: 'Missing refreshToken' }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, refreshToken, COOKIE_OPTS);
    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

// DELETE: clear session cookie on logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
