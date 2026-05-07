import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/services/ticketService';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    await requireAdmin(request);

    const query = request.nextUrl.searchParams.get('q') || '';
    const result = await searchUsers(query, 0, 20);

    return NextResponse.json({
      query,
      total: result.total,
      count: result.data.length,
      users: result.data.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
