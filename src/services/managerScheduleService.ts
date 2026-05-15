import { authFetch } from '@/lib/auth/clientAuth';
import type { ManagerScheduleInput, ManagerScheduleProfile, ManagerScheduleRegistration } from '@/types/managerSchedule';

interface ManagerScheduleRow {
  id: string;
  manager_id: string;
  manager_name: string;
  manager_email: string;
  centre_id: string;
  centre_name: string;
  centre_short_name: string;
  work_date: string;
  weekday: number;
  session: ManagerScheduleRegistration['session'];
  note: string | null;
  created_at: string;
  updated_at?: string | null;
}

function toQuery(params: Record<string, string | string[] | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => sp.append(key, item));
    } else if (value) {
      sp.set(key, value);
    }
  });
  return sp.toString();
}

function mapRow(row: ManagerScheduleRow): ManagerScheduleRegistration {
  return {
    id: row.id,
    managerId: row.manager_id,
    managerName: row.manager_name,
    managerEmail: row.manager_email,
    centreId: row.centre_id,
    centreName: row.centre_name,
    centreShortName: row.centre_short_name,
    date: row.work_date,
    weekday: row.weekday,
    session: row.session,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchManagerSchedules(params: {
  dateFrom?: string;
  dateTo?: string;
  centreIds?: string[];
  admin?: boolean;
  mine?: boolean;
} = {}): Promise<ManagerScheduleRegistration[]> {
  const query = toQuery({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    centreId: params.centreIds,
    admin: params.admin ? '1' : undefined,
    mine: params.mine ? '1' : undefined,
  });
  const res = await authFetch(`/api/manager-schedules${query ? `?${query}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Không tải được lịch làm việc');
  }
  const body = await res.json();
  return ((body.data || []) as ManagerScheduleRow[]).map(mapRow);
}

export async function fetchManagerScheduleProfiles(): Promise<ManagerScheduleProfile[]> {
  const res = await authFetch('/api/manager-schedules?admin=1&managers=1');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Không tải được danh sách quản lý');
  }
  const body = await res.json();
  return (body.data || []) as ManagerScheduleProfile[];
}

export async function createManagerSchedules(items: ManagerScheduleInput[], managerName?: string) {
  const res = await authFetch('/api/manager-schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, managerName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Không lưu được lịch làm việc');
  }
  const body = await res.json();
  return ((body.data || []) as ManagerScheduleRow[]).map(mapRow);
}

export async function deleteManagerSchedule(id: string, admin = false) {
  const query = toQuery({ id, admin: admin ? '1' : undefined });
  const res = await authFetch(`/api/manager-schedules?${query}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Không xoá được lịch làm việc');
  }
  return true;
}
