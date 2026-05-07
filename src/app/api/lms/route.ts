/**
 * /api/lms/route.ts
 * Server-side proxy for LMS GraphQL API.
 * Verifies the Firebase token before forwarding so the proxy can't be
 * abused by anyone holding any random bearer string.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractBearer,
  verifyFirebaseIdToken,
  authErrorResponse,
  AuthError,
} from '@/lib/auth/serverAuth';

const LMS_BASE_URL = 'https://lms-api.mindx.edu.vn/';

export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    await verifyFirebaseIdToken(idToken);

    const body = await request.json();

    const lmsResponse = await fetch(LMS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: idToken,
        'content-language': 'en',
        Referer: 'https://lms.mindx.edu.vn/',
      },
      body: JSON.stringify(body),
    });

    const data = await lmsResponse.json();
    return NextResponse.json(data, { status: lmsResponse.ok ? 200 : lmsResponse.status });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
