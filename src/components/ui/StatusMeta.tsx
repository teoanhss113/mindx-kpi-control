import React from 'react';
import { Badge, type BadgeShape, type BadgeSize, type BadgeVariant } from './Badge';
import {
  OFFICE_HOUR_TYPE_LABELS,
  getOfficeHourTypeLabel,
} from '@/lib/notificationFormat';

export { OFFICE_HOUR_TYPE_LABELS, getOfficeHourTypeLabel };

export const ACTIVE_STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Không hoạt động',
} as const;

export const ACTIVE_STATUS_OPTIONS = [
  { value: 'active', label: ACTIVE_STATUS_LABELS.active },
  { value: 'inactive', label: ACTIVE_STATUS_LABELS.inactive },
] as const;

export function getActiveStatusLabel(isActive: boolean): string {
  return isActive ? ACTIVE_STATUS_LABELS.active : ACTIVE_STATUS_LABELS.inactive;
}

export function getActiveStatusVariant(isActive: boolean): BadgeVariant {
  return isActive ? 'passed' : 'failed';
}

export function ActiveStatusBadge({
  active,
  size = 'sm',
  shape = 'rounded',
}: {
  active: boolean;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={getActiveStatusVariant(active)} size={size} shape={shape}>
      {getActiveStatusLabel(active)}
    </Badge>
  );
}

export type TicketStatusKind = 'new' | 'in_progress' | 'closed' | 'other';

export interface TicketStatusMeta {
  kind: TicketStatusKind;
  label: string;
  variant: BadgeVariant;
  color: string;
}

export function normalizeStatusValue(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function getTicketStatusMeta(status: string | null | undefined): TicketStatusMeta {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'CLOSED' || normalized === 'RESOLVED') {
    return { kind: 'closed', label: status || '—', variant: 'exempt', color: 'var(--text-tertiary)' };
  }
  if (normalized === 'IN_PROGRESS' || normalized === 'PROCESSING') {
    return { kind: 'in_progress', label: status || '—', variant: 'info', color: 'var(--brand-indigo)' };
  }
  if (normalized === 'NEW' || normalized === 'OPEN') {
    return { kind: 'new', label: status || '—', variant: 'passed', color: 'var(--status-emerald)' };
  }
  return { kind: 'other', label: status || '—', variant: 'default', color: 'var(--text-secondary)' };
}

export function TicketStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: string | null | undefined;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const meta = getTicketStatusMeta(status);
  return (
    <Badge variant={meta.variant} size={size} shape={shape}>
      {meta.label}
    </Badge>
  );
}

export const OFFICE_HOUR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  ABANDONED: 'Đã huỷ',
};

export function getOfficeHourStatusMeta(status: string | null | undefined): {
  label: string;
  variant: BadgeVariant;
} {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'APPROVED') return { label: OFFICE_HOUR_STATUS_LABELS.APPROVED, variant: 'passed' };
  if (normalized === 'REJECTED') return { label: OFFICE_HOUR_STATUS_LABELS.REJECTED, variant: 'failed' };
  if (normalized === 'ABANDONED') return { label: OFFICE_HOUR_STATUS_LABELS.ABANDONED, variant: 'failed' };
  if (normalized === 'PENDING') return { label: OFFICE_HOUR_STATUS_LABELS.PENDING, variant: 'warning' };
  return { label: status || '—', variant: 'exempt' };
}

export function OfficeHourStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: string | null | undefined;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const meta = getOfficeHourStatusMeta(status);
  return (
    <Badge variant={meta.variant} size={size} shape={shape}>
      {meta.label}
    </Badge>
  );
}

export function OfficeHourTypeBadge({
  type,
  size = 'sm',
  shape = 'rounded',
}: {
  type: string | null | undefined;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={type === 'Trial' ? 'demo' : 'default'} size={size} shape={shape}>
      {getOfficeHourTypeLabel(type)}
    </Badge>
  );
}

export type ParticipationStatus = 'pending' | 'confirmed' | 'rejected' | 'confirmed_by_other' | 'none';

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  rejected: 'Đã từ chối',
  confirmed_by_other: 'Đã có GV xác nhận',
  none: '—',
};

export function ParticipationStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: ParticipationStatus | null | undefined;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  if (!status || status === 'none') {
    return (
      <span style={{ color: 'var(--text-tertiary)', fontSize: size === 'sm' ? 12 : 13 }}>
        {PARTICIPATION_STATUS_LABELS.none}
      </span>
    );
  }

  const variant: BadgeVariant =
    status === 'confirmed' || status === 'confirmed_by_other'
      ? 'passed'
      : status === 'rejected'
        ? 'failed'
        : 'warning';

  return (
    <Badge variant={variant} size={size} shape={shape}>
      {PARTICIPATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export type JudgeRequestStatus = 'pending' | 'approved' | 'rejected';

export const JUDGE_REQUEST_STATUS_LABELS: Record<JudgeRequestStatus, string> = {
  pending: PARTICIPATION_STATUS_LABELS.pending,
  approved: PARTICIPATION_STATUS_LABELS.confirmed,
  rejected: PARTICIPATION_STATUS_LABELS.rejected,
};

export function JudgeRequestStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: JudgeRequestStatus | null | undefined;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const mappedStatus: ParticipationStatus | null | undefined =
    status === 'approved'
      ? 'confirmed'
      : status;

  return <ParticipationStatusBadge status={mappedStatus} size={size} shape={shape} />;
}

export type CompletionStatusKind = 'exempt' | 'completed' | 'incomplete';

export const COMPLETION_STATUS_LABELS: Record<CompletionStatusKind, string> = {
  exempt: 'Miễn trừ',
  completed: 'Hoàn thành',
  incomplete: 'Chưa hoàn thành',
};

export function getCompletionStatusVariant(status: CompletionStatusKind): BadgeVariant {
  if (status === 'completed') return 'passed';
  if (status === 'incomplete') return 'failed';
  return 'exempt';
}

export function CompletionStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: CompletionStatusKind;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={getCompletionStatusVariant(status)} size={size} shape={shape}>
      {COMPLETION_STATUS_LABELS[status]}
    </Badge>
  );
}

export const BATCH_STATUS_LABELS = {
  open: 'Đang mở',
  closed: 'Đã đóng',
} as const;

export function BatchStatusBadge({
  active,
  size = 'sm',
  shape = 'rounded',
}: {
  active: boolean;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={active ? 'passed' : 'exempt'} size={size} shape={shape}>
      {active ? BATCH_STATUS_LABELS.open : BATCH_STATUS_LABELS.closed}
    </Badge>
  );
}

export type DateMarkerStatus = 'past' | 'today';

export const DATE_MARKER_LABELS: Record<DateMarkerStatus, string> = {
  past: 'Đã qua',
  today: 'Hôm nay',
};

export function DateMarkerBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: DateMarkerStatus;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={status === 'today' ? 'warning' : 'exempt'} size={size} shape={shape}>
      {DATE_MARKER_LABELS[status]}
    </Badge>
  );
}

export type RescheduleStatus = 'same_day' | 'early' | 'late' | 'on_schedule';

export const RESCHEDULE_STATUS_LABELS: Record<RescheduleStatus, string> = {
  same_day: 'Cùng ngày',
  early: 'Học sớm',
  late: 'Học muộn',
  on_schedule: 'Đúng lịch',
};

export function RescheduleStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: RescheduleStatus;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const variant: BadgeVariant =
    status === 'same_day' || status === 'early'
      ? 'info'
      : status === 'late'
        ? 'warning'
        : 'exempt';

  return (
    <Badge variant={variant} size={size} shape={shape}>
      {RESCHEDULE_STATUS_LABELS[status]}
    </Badge>
  );
}

export type AttendanceAlertKind = 'frequent_absent' | 'consecutive_absent' | 'late_stage_absent';

export const ATTENDANCE_ALERT_LABELS: Record<AttendanceAlertKind, string> = {
  frequent_absent: 'Vắng 3+ buổi',
  consecutive_absent: 'Vắng liên tiếp',
  late_stage_absent: 'Vắng cuối khoá',
};

export function AttendanceAlertBadge({
  type,
  size = 'sm',
  shape = 'rounded',
}: {
  type: AttendanceAlertKind;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const variant: BadgeVariant =
    type === 'frequent_absent'
      ? 'warning'
      : type === 'consecutive_absent'
        ? 'demo'
        : 'failed';

  return (
    <Badge variant={variant} size={size} shape={shape}>
      {ATTENDANCE_ALERT_LABELS[type]}
    </Badge>
  );
}

export type TeacherAssignmentStatus = 'unknown' | 'main_changed' | 'supply' | 'on_schedule';

export const TEACHER_ASSIGNMENT_STATUS_LABELS: Record<TeacherAssignmentStatus, string> = {
  unknown: 'Không rõ',
  main_changed: 'Thay GV chính',
  supply: 'Có SUPPLY',
  on_schedule: 'Đúng lịch',
};

export function TeacherAssignmentStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: TeacherAssignmentStatus;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const variant: BadgeVariant =
    status === 'main_changed'
      ? 'failed'
      : status === 'supply'
        ? 'warning'
        : status === 'unknown'
          ? 'exempt'
          : 'passed';

  return (
    <Badge variant={variant} size={size} shape={shape}>
      {TEACHER_ASSIGNMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export type TeacherConfirmationStatus = 'confirmed' | 'rejected' | 'pending' | 'confirmed_by_other' | 'none';

export const TEACHER_CONFIRMATION_STATUS_LABELS: Record<TeacherConfirmationStatus, string> = {
  confirmed: PARTICIPATION_STATUS_LABELS.confirmed,
  rejected: PARTICIPATION_STATUS_LABELS.rejected,
  pending: PARTICIPATION_STATUS_LABELS.pending,
  confirmed_by_other: PARTICIPATION_STATUS_LABELS.confirmed_by_other,
  none: PARTICIPATION_STATUS_LABELS.none,
};

export function TeacherConfirmationStatusBadge({
  status,
  size = 'sm',
  shape = 'rounded',
}: {
  status: TeacherConfirmationStatus;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return <ParticipationStatusBadge status={status} size={size} shape={shape} />;
}

export type PriorityKind = 'high' | 'medium' | 'low' | 'other';

export function getPriorityMeta(priority: string | null | undefined): {
  kind: PriorityKind;
  label: string;
  variant: BadgeVariant;
  color: string;
} {
  const normalized = normalizeStatusValue(priority);
  if (normalized === 'HIGH') return { kind: 'high', label: priority || '—', variant: 'failed', color: 'var(--status-error)' };
  if (normalized === 'MEDIUM') return { kind: 'medium', label: priority || '—', variant: 'warning', color: 'var(--status-warning)' };
  if (normalized === 'LOW') return { kind: 'low', label: priority || '—', variant: 'info', color: 'var(--brand-indigo)' };
  return { kind: 'other', label: priority || '—', variant: 'default', color: 'var(--text-quaternary)' };
}
