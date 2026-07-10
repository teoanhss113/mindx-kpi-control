import { authFetch } from '@/lib/auth/clientAuth';
import type {
  ClassQualityFollowUp,
  ClassQualityFollowUpInput,
  ClassQualityFollowUpStatus,
} from '@/types/classQualityFollowUp';

interface ClassQualityFollowUpRow {
  class_id: string;
  class_name: string;
  status: ClassQualityFollowUpStatus;
  note: string | null;
  updated_by_profile_id: string;
  updated_by_email: string;
  created_at: string;
  updated_at: string;
}

function mapFollowUp(row: ClassQualityFollowUpRow): ClassQualityFollowUp {
  return {
    classId: row.class_id,
    className: row.class_name,
    status: row.status,
    note: row.note || '',
    updatedByProfileId: row.updated_by_profile_id,
    updatedByEmail: row.updated_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return body?.error || fallback;
}

export async function fetchClassQualityFollowUps(): Promise<ClassQualityFollowUp[]> {
  const response = await authFetch('/api/class-quality-follow-ups');
  if (!response.ok) {
    throw new Error(await readError(response, 'Không tải được trạng thái xử lý'));
  }

  const body = await response.json();
  return ((body.data || []) as ClassQualityFollowUpRow[]).map(mapFollowUp);
}

export async function saveClassQualityFollowUp(
  input: ClassQualityFollowUpInput,
): Promise<ClassQualityFollowUp> {
  const response = await authFetch('/api/class-quality-follow-ups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Không lưu được trạng thái xử lý'));
  }

  const body = await response.json();
  return mapFollowUp(body.data as ClassQualityFollowUpRow);
}

