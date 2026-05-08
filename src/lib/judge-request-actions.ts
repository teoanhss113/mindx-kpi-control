/**
 * Judge Request Actions
 * Teachers can request to be a judge for the final session of a class.
 * All operations route through /api/judge-requests.
 */

import { authFetch } from '@/lib/auth/clientAuth';

export type JudgeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JudgeRequest {
  id: string;
  session_id: string;
  class_id: string;
  teacher_email: string;
  teacher_name: string | null;
  teacher_id: string | null;
  status: JudgeRequestStatus;
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
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data as T;
}

export async function createJudgeRequest(
  sessionId: string,
  classId: string,
  teacherName: string,
  teacherId: string,
  requestNote?: string,
): Promise<JudgeRequest> {
  const res = await authFetch('/api/judge-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, classId, teacherName, teacherId, requestNote }),
  });
  if (res.status === 409) throw new Error('Bạn đã gửi yêu cầu cho buổi học này rồi');
  const json = await readJson<{ data: JudgeRequest }>(res);
  return json.data;
}

export async function hasRequestedJudge(sessionId: string): Promise<boolean> {
  const res = await authFetch(
    `/api/judge-requests?check=1&sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!res.ok) return false;
  const json = (await res.json()) as { exists?: boolean };
  return !!json.exists;
}

export async function cancelJudgeRequest(sessionId: string): Promise<void> {
  const res = await authFetch(
    `/api/judge-requests?sessionId=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error('Không thể huỷ yêu cầu');
}

export async function getMyJudgeRequests(): Promise<JudgeRequest[]> {
  const res = await authFetch('/api/judge-requests');
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: JudgeRequest[] };
  return json.data || [];
}
