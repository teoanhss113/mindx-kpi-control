/**
 * Teacher Office Hour Confirmation Actions
 *
 * All operations now route through `/api/teacher-confirmations`, which
 * verifies the caller's Firebase ID token and ensures a teacher can only
 * read / mutate their own confirmations (admins may read others).
 */

import { authFetch } from '@/lib/auth/clientAuth';

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

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || 'Request failed');
  }
  return data as T;
}

export async function getTeacherConfirmations(teacherEmail: string): Promise<TeacherConfirmation[]> {
  const res = await authFetch(
    `/api/teacher-confirmations?email=${encodeURIComponent(teacherEmail)}`,
  );
  const json = await readJson<{ data: TeacherConfirmation[] }>(res);
  return json.data || [];
}

export async function confirmOfficeHour(
  officeHourId: string,
  _teacherEmail: string,
  notes?: string,
): Promise<TeacherConfirmation> {
  const res = await authFetch('/api/teacher-confirmations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', officeHourId, notes }),
  });
  const json = await readJson<{ data: TeacherConfirmation }>(res);
  return json.data;
}

export async function rejectOfficeHour(
  officeHourId: string,
  _teacherEmail: string,
  reason?: string,
): Promise<TeacherConfirmation> {
  const res = await authFetch('/api/teacher-confirmations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reject', officeHourId, reason }),
  });
  const json = await readJson<{ data: TeacherConfirmation }>(res);
  return json.data;
}
