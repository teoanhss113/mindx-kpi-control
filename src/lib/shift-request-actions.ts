/**
 * Office Hours Shift Request Actions
 * Handle teacher requests to take available shifts
 */

import { supabase } from '@/lib/supabase/client';

export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ShiftRequest {
  id: string;
  office_hour_id: string;
  teacher_email: string;
  teacher_name: string | null;
  teacher_id: string | null;
  status: ShiftRequestStatus;
  request_note: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a shift request
 */
export async function createShiftRequest(
  officeHourId: string,
  teacherEmail: string,
  teacherName: string,
  teacherId: string,
  requestNote?: string
): Promise<ShiftRequest> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .insert({
      office_hour_id: officeHourId,
      teacher_email: teacherEmail,
      teacher_name: teacherName,
      teacher_id: teacherId,
      status: 'pending',
      request_note: requestNote || null,
    })
    .select()
    .single();

  if (error) {
    // Check if already requested
    if (error.code === '23505') {
      throw new Error('Bạn đã yêu cầu ca trực này rồi');
    }
    
    // Check if table doesn't exist
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('Bảng shift requests chưa được tạo. Vui lòng chạy migration 013.');
    }
    
    throw new Error('Không thể tạo yêu cầu xin trực');
  }

  return data;
}

/**
 * Get shift requests for a specific office hour
 */
export async function getShiftRequestsForOfficeHour(
  officeHourId: string
): Promise<ShiftRequest[]> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .select('*')
    .eq('office_hour_id', officeHourId)
    .order('created_at', { ascending: false });

  if (error) {
    // If table doesn't exist yet, return empty array
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return [];
    }
    
    throw new Error('Không thể tải danh sách yêu cầu');
  }

  return data || [];
}

/**
 * Get pending shift requests for a teacher
 */
export async function getMyPendingRequests(
  teacherEmail: string
): Promise<ShiftRequest[]> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .select('*')
    .eq('teacher_email', teacherEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching my requests:', error);
    
    // If table doesn't exist yet, return empty array
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return [];
    }
    
    return [];
  }

  return data || [];
}

/**
 * Check if teacher has already requested this shift
 */
export async function hasRequestedShift(
  officeHourId: string,
  teacherEmail: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .select('id')
    .eq('office_hour_id', officeHourId)
    .eq('teacher_email', teacherEmail)
    .maybeSingle();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Cancel a shift request (only if pending)
 */
export async function cancelShiftRequest(
  officeHourId: string,
  teacherEmail: string
): Promise<void> {
  const { error } = await supabase
    .from('office_hours_shift_requests')
    .delete()
    .eq('office_hour_id', officeHourId)
    .eq('teacher_email', teacherEmail)
    .eq('status', 'pending');

  if (error) {
    throw new Error('Không thể huỷ yêu cầu');
  }
}

/**
 * Approve a shift request (admin only - will be called from admin page)
 */
export async function approveShiftRequest(
  requestId: string,
  approvedBy: string
): Promise<ShiftRequest> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    throw new Error('Không thể phê duyệt yêu cầu');
  }

  return data;
}

/**
 * Reject a shift request (admin only)
 */
export async function rejectShiftRequest(
  requestId: string,
  rejectedBy: string,
  reason?: string
): Promise<ShiftRequest> {
  const { data, error } = await supabase
    .from('office_hours_shift_requests')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: rejectedBy,
      rejection_reason: reason || null,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    throw new Error('Không thể từ chối yêu cầu');
  }

  return data;
}

/**
 * Get count of pending requests for an office hour
 */
export async function getPendingRequestCount(
  officeHourId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('office_hours_shift_requests')
    .select('*', { count: 'exact', head: true })
    .eq('office_hour_id', officeHourId)
    .eq('status', 'pending');

  if (error) {
    return 0;
  }

  return count || 0;
}

// Fixed validation rules
// Fixed validation rules
// Fixed validation rules

// Fixed validation
