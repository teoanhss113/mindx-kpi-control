/**
 * Judge Request Actions (client-side)
 * Thin wrappers around /api/judge-requests and /api/judge-batches.
 */

import { authFetch } from '@/lib/auth/clientAuth';

export type JudgeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JudgeRequest {
  id: string;
  final_session_id: string;
  teacher_email: string;
  teacher_name: string | null;
  teacher_id: string | null;
  status: JudgeRequestStatus;
  request_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinalSession {
  id: string;
  batch_id: string;
  lms_class_id: string;
  lms_slot_id: string;
  class_name: string;
  course_short_name: string | null;
  centre_id: string | null;
  centre_name: string | null;
  category: string | null;
  session_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  main_teacher: string | null;
  student_count: number;
  myRequest: JudgeRequest | null;
}

export interface JudgeBatch {
  id: string;
  slug: string;
  title: string;
  week_from: string;
  week_to: string;
  notes: string | null;
  is_active: boolean;
  sessions: FinalSession[];
}

export async function getBatchBySlug(slug: string): Promise<JudgeBatch> {
  const res = await authFetch(`/api/judge-batches/${slug}`);
  if (!res.ok) throw new Error(res.status === 404 ? 'not_found' : 'fetch_error');
  const json = await res.json();
  return json.data;
}

export async function submitJudgeRequest(
  finalSessionId: string,
  teacherName: string,
  teacherId: string,
): Promise<JudgeRequest> {
  const res = await authFetch('/api/judge-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalSessionId, teacherName, teacherId }),
  });
  if (res.status === 409) throw new Error('already_requested');
  if (!res.ok) throw new Error('submit_error');
  const json = await res.json();
  return json.data;
}

export async function cancelJudgeRequest(finalSessionId: string): Promise<void> {
  const res = await authFetch(`/api/judge-requests?sessionId=${finalSessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('cancel_error');
}
