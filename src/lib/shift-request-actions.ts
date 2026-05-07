/**
 * Office Hours Shift Request Actions
 *
 * All operations route through `/api/shift-requests`, which verifies the
 * caller's Firebase ID token and gates writes to the caller's own email
 * (admin-only listing for an office hour).
 */

import { authFetch } from '@/lib/auth/clientAuth';
import type { OfficeHourInfo } from '@/lib/notificationService';

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

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || 'Request failed');
  }
  return data as T;
}

export async function createShiftRequest(
  officeHourId: string,
  _teacherEmail: string,
  teacherName: string,
  teacherId: string,
  requestNote?: string,
  officeHourInfo?: OfficeHourInfo,
): Promise<ShiftRequest> {
  const res = await authFetch('/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ officeHourId, teacherName, teacherId, requestNote, officeHourInfo }),
  });
  if (res.status === 409) {
    throw new Error('Bạn đã yêu cầu ca trực này rồi');
  }
  const json = await readJson<{ data: ShiftRequest }>(res);
  return json.data;
}

export async function getShiftRequestsForOfficeHour(
  officeHourId: string,
): Promise<ShiftRequest[]> {
  const res = await authFetch(
    `/api/shift-requests?officeHourId=${encodeURIComponent(officeHourId)}`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: ShiftRequest[] };
  return json.data || [];
}

export async function hasRequestedShift(
  officeHourId: string,
  _teacherEmail: string,
): Promise<boolean> {
  const res = await authFetch(
    `/api/shift-requests?check=1&officeHourId=${encodeURIComponent(officeHourId)}`,
  );
  if (!res.ok) return false;
  const json = (await res.json()) as { exists?: boolean };
  return !!json.exists;
}

export async function cancelShiftRequest(
  officeHourId: string,
  _teacherEmail: string,
): Promise<void> {
  const res = await authFetch(
    `/api/shift-requests?officeHourId=${encodeURIComponent(officeHourId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error('Không thể huỷ yêu cầu');
}
