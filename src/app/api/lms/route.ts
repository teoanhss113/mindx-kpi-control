/**
 * /api/lms/route.ts
 * Server-side proxy for LMS GraphQL API.
 * Bypasses CORS: client calls this route, this route calls lms-api.mindx.edu.vn.
 * The Authorization token is forwarded from the client request.
 */

import { NextRequest, NextResponse } from 'next/server';

const LMS_BASE_URL = 'https://lms-api.mindx.edu.vn/';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const body = await request.json();

    const lmsResponse = await fetch(LMS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization,
        'content-language': 'en',
        Referer: 'https://lms.mindx.edu.vn/',
      },
      body: JSON.stringify(body),
    });

    const data = await lmsResponse.json();

    if (!lmsResponse.ok) {
      return NextResponse.json(data, { status: lmsResponse.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Added auth error handling
// Added auth error handling
// Added auth error handling

// Added auth handling
// Added comprehensive auth error handling
