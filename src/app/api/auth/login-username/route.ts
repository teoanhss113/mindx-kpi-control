import { NextRequest, NextResponse } from 'next/server';

const LMS_BASE_URL = 'https://base-api.mindx.edu.vn/';

/**
 * Proxy endpoint for LMS username login to bypass CORS
 * This endpoint forwards the request to LMS API from server-side
 */
export async function POST(request: NextRequest) {
  try {
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
