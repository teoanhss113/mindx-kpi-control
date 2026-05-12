import React from 'react';
import { Badge, type BadgeShape, type BadgeSize } from './Badge';

export type CommentQualityStatus =
  | 'ok'
  | 'brief'
  | 'empty'
  | 'overdue'
  | 'duplicate_self'
  | 'duplicate_other'
  | 'template_exact'
  | 'template_modified'
  | 'not_required';

export const COMMENT_STATUS_LABELS: Record<CommentQualityStatus, string> = {
  ok: 'Đủ',
  brief: 'Ngắn',
  empty: 'Thiếu',
  overdue: 'Quá hạn',
  duplicate_self: 'Tự lặp',
  duplicate_other: 'Trùng HV',
  template_exact: 'Trùng mẫu',
  template_modified: 'Dựa mẫu',
  not_required: '—',
};

export const COMMENT_STATUS_COUNT_LABELS = {
  ok: COMMENT_STATUS_LABELS.ok,
  brief: COMMENT_STATUS_LABELS.brief,
  empty: COMMENT_STATUS_LABELS.empty,
  overdue: COMMENT_STATUS_LABELS.overdue,
  duplicate: 'Trùng/lặp',
} as const;

export const COMMENT_STATUS_GROUP_LABELS = {
  ok: COMMENT_STATUS_LABELS.ok,
  brief: COMMENT_STATUS_LABELS.brief,
  empty: COMMENT_STATUS_LABELS.empty,
  overdue: COMMENT_STATUS_LABELS.overdue,
  duplicate: 'Trùng/lặp',
  emptyOrOverdue: `${COMMENT_STATUS_LABELS.empty} / ${COMMENT_STATUS_LABELS.overdue}`,
} as const;

export function getCommentStatusVariant(status: CommentQualityStatus): 'passed' | 'warning' | 'failed' | 'demo' | 'exempt' {
  if (status === 'ok') return 'passed';
  if (status === 'brief') return 'warning';
  if (status === 'duplicate_self' || status === 'duplicate_other' || status === 'template_exact' || status === 'template_modified') return 'demo';
  if (status === 'empty' || status === 'overdue') return 'failed';
  return 'exempt';
}

export function CommentStatusBadge({
  status,
  children,
  size = 'sm',
  shape = 'rounded',
}: {
  status: CommentQualityStatus;
  children?: React.ReactNode;
  size?: BadgeSize;
  shape?: BadgeShape;
}) {
  return (
    <Badge variant={getCommentStatusVariant(status)} size={size} shape={shape}>
      {children || COMMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
