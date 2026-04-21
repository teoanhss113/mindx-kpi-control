import { NextResponse } from 'next/server';
import { searchUsers } from '@/services/ticketService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  
  console.log('Testing user search for:', query);
  
  try {
    const result = await searchUsers(query, 0, 20);
    
    console.log('Search results:', result);
    
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
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      error: error.message,
      query,
    }, { status: 500 });
  }
}
