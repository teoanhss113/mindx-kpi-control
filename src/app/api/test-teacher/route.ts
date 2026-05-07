import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/services/userLookupService';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    await requireAdmin(request);

    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const teacher = await findUserByEmail(email);
    return NextResponse.json({
      email,
      found: !!teacher,
      teacher: teacher || null,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
