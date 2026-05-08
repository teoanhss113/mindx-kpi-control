import React from 'react';
import { Badge, type BadgeShape, type BadgeSize } from './Badge';

export type AttendanceStatusKind = 'present' | 'late' | 'excused' | 'absent' | 'unchecked';

export interface AttendanceStatusMeta {
  kind: AttendanceStatusKind;
  label: string;
  background: string;
  color: string;
  border: string;
}

export const ATTENDANCE_STATUS_STYLES: Record<AttendanceStatusKind, AttendanceStatusMeta> = {
  present: {
    kind: 'present',
    label: 'Có mặt',
    background: 'rgba(5, 150, 105, 0.08)',
    color: 'var(--status-success)',
    border: 'rgba(5, 150, 105, 0.25)',
  },
  late: {
    kind: 'late',
    label: 'Đến muộn',
    background: 'rgba(245, 158, 11, 0.08)',
    color: 'var(--status-warning)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  excused: {
    kind: 'excused',
    label: 'Vắng có phép',
    background: 'rgba(251, 146, 60, 0.08)',
    color: 'var(--status-dark-orange)',
    border: 'rgba(251, 146, 60, 0.25)',
  },
  absent: {
    kind: 'absent',
    label: 'Vắng KP',
    background: 'rgba(220, 38, 38, 0.08)',
    color: 'var(--status-error)',
    border: 'rgba(220, 38, 38, 0.25)',
  },
  unchecked: {
    kind: 'unchecked',
    label: 'Chưa ĐD',
    background: 'var(--bg-panel)',
    color: 'var(--text-quaternary)',
    border: 'var(--border-primary)',
  },
};

export function normalizeAttendanceStatus(status: string | null | undefined): string {
  return (status || 'UNCHECKED')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function getAttendanceStatusKind(status: string | null | undefined): AttendanceStatusKind {
  const normalized = normalizeAttendanceStatus(status);
  if (normalized === 'PRESENT' || normalized === 'ATTENDED') return 'present';
  if (normalized === 'LATE' || normalized === 'LATE_ARRIVED') return 'late';
  if (normalized === 'ABSENT_WITH_NOTICE' || normalized === 'EXCUSED') return 'excused';
  if (normalized === 'ABSENT' || normalized === 'ABSENT_UNEXCUSED') return 'absent';
  return 'unchecked';
}

export function getAttendanceStatusMeta(status: string | null | undefined): AttendanceStatusMeta {
  return ATTENDANCE_STATUS_STYLES[getAttendanceStatusKind(status)];
}

export function isAttendanceStatus(
  status: string | null | undefined,
  kinds: AttendanceStatusKind | AttendanceStatusKind[],
): boolean {
  return (Array.isArray(kinds) ? kinds : [kinds]).includes(getAttendanceStatusKind(status));
}

export function AttendanceStatusBadge({
  status,
  children,
  size = 'sm',
  shape = 'rounded',
}: {
  status: string | null | undefined;
  children?: React.ReactNode;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  const meta = getAttendanceStatusMeta(status);

  return (
    <Badge
      variant="custom"
      size={size}
      shape={shape}
      customColors={{ background: meta.background, color: meta.color, border: meta.border }}
    >
      {children || meta.label}
    </Badge>
  );
}

export function AttendanceSessionCell({
  status,
  index,
  date,
  size = 28,
  highlight = false,
  highlightColor = 'var(--brand-indigo)',
  highlightLabel,
}: {
  status: string | null | undefined;
  index: number;
  date?: string | null;
  size?: number;
  highlight?: boolean;
  highlightColor?: string;
  highlightLabel?: string;
}) {
  const meta = getAttendanceStatusMeta(status);
  const dateLabel = date ? new Date(date).toLocaleDateString('vi-VN') : null;
  const title = [
    `Buổi ${index + 1}`,
    dateLabel,
    meta.label,
    highlightLabel,
  ].filter(Boolean).join(' - ');

  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        lineHeight: `${size}px`,
        textAlign: 'center',
        borderRadius: '4px',
        fontSize: size <= 22 ? 10 : 11,
        fontWeight: 600,
        background: meta.background,
        color: meta.color,
        border: highlight ? `2px solid ${highlightColor}` : `1px solid ${meta.border}`,
        boxSizing: 'border-box',
      }}
    >
      {index + 1}
    </span>
  );
}
