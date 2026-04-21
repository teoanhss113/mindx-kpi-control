import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/services/userLookupService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  console.log('Testing teacher lookup for:', email);
  
  try {
    const teacher = await findUserByEmail(email);
    
    return NextResponse.json({
      email,
      found: !!teacher,
      teacher: teacher || null,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      error: error.message,
      email,
      found: false,
    }, { status: 500 });
  }
}
