/**
 * Teacher Office Hour Confirmation Actions
 * Handle teacher confirmations for office hour assignments
 */

import { supabase } from '@/lib/supabase/client';

export type ConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export interface TeacherConfirmation {
  id: string;
  office_hour_id: string;
  teacher_email: string;
  teacher_name: string | null;
  status: ConfirmationStatus;
  confirmed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get confirmations for a specific teacher
 */
export async function getTeacherConfirmations(teacherEmail: string): Promise<TeacherConfirmation[]> {
  const { data, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .select('*')
    .eq('teacher_email', teacherEmail)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching teacher confirmations:', error);
    
    // If table doesn't exist yet, return empty array instead of throwing
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('⚠️  teacher_office_hour_confirmations table does not exist. Please run migration 011.');
      return [];
    }
    
    throw new Error('Failed to fetch confirmations');
  }

  return data || [];
}

/**
 * Get confirmation for a specific office hour and teacher
 */
export async function getConfirmation(
  officeHourId: string,
  teacherEmail: string
): Promise<TeacherConfirmation | null> {
  const { data, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .select('*')
    .eq('office_hour_id', officeHourId)
    .eq('teacher_email', teacherEmail)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching confirmation:', error);
    throw new Error('Failed to fetch confirmation');
  }

  return data;
}

/**
 * Create or update confirmation when teacher is assigned
 * NOTE: This function should only be called from server-side code (API routes or server actions)
 */
export async function createConfirmation(
  officeHourId: string,
  teacherEmail: string,
  teacherName?: string
): Promise<TeacherConfirmation> {
  // Lazy import to avoid loading admin client on client-side
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  
  const { data, error } = await supabaseAdmin
    .from('teacher_office_hour_confirmations')
    .upsert({
      office_hour_id: officeHourId,
      teacher_email: teacherEmail,
      teacher_name: teacherName || null,
      status: 'pending',
    }, {
      onConflict: 'office_hour_id,teacher_email'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating confirmation:', error);
    throw new Error('Failed to create confirmation');
  }

  return data;
}

/**
 * Confirm office hour assignment
 */
export async function confirmOfficeHour(
  officeHourId: string,
  teacherEmail: string,
  notes?: string
): Promise<TeacherConfirmation> {
  // First, check if confirmation exists
  const existing = await getConfirmation(officeHourId, teacherEmail);
  
  if (!existing) {
    // Create new confirmation record if it doesn't exist
    const { data, error } = await supabase
      .from('teacher_office_hour_confirmations')
      .insert({
        office_hour_id: officeHourId,
        teacher_email: teacherEmail,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating confirmation:', error);
      throw new Error('Failed to confirm office hour');
    }

    return data;
  }

  // Update existing confirmation
  const { data, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
      notes: notes || null,
    })
    .eq('office_hour_id', officeHourId)
    .eq('teacher_email', teacherEmail)
    .select()
    .single();

  if (error) {
    console.error('Error confirming office hour:', error);
    throw new Error('Failed to confirm office hour');
  }

  return data;
}

/**
 * Reject office hour assignment
 */
export async function rejectOfficeHour(
  officeHourId: string,
  teacherEmail: string,
  reason?: string
): Promise<TeacherConfirmation> {
  // First, check if confirmation exists
  const existing = await getConfirmation(officeHourId, teacherEmail);
  
  if (!existing) {
    // Create new confirmation record if it doesn't exist
    const { data, error } = await supabase
      .from('teacher_office_hour_confirmations')
      .insert({
        office_hour_id: officeHourId,
        teacher_email: teacherEmail,
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating rejection:', error);
      throw new Error('Failed to reject office hour');
    }

    return data;
  }

  // Update existing confirmation
  const { data, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      confirmed_at: null,
      rejection_reason: reason || null,
    })
    .eq('office_hour_id', officeHourId)
    .eq('teacher_email', teacherEmail)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting office hour:', error);
    throw new Error('Failed to reject office hour');
  }

  return data;
}

/**
 * Get all confirmations for an office hour (admin view)
 */
export async function getOfficeHourConfirmations(officeHourId: string): Promise<TeacherConfirmation[]> {
  const { data, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .select('*')
    .eq('office_hour_id', officeHourId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching office hour confirmations:', error);
    throw new Error('Failed to fetch confirmations');
  }

  return data || [];
}

/**
 * Get pending confirmations count for a teacher
 */
export async function getPendingConfirmationsCount(teacherEmail: string): Promise<number> {
  const { count, error } = await supabase
    .from('teacher_office_hour_confirmations')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_email', teacherEmail)
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting pending confirmations:', error);
    
    // If table doesn't exist yet, return 0 instead of throwing
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return 0;
    }
    
    return 0;
  }

  return count || 0;
}
