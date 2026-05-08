import React from 'react';
import { Badge, type BadgeShape, type BadgeSize } from './Badge';

export type CommentQualityStatus =
  | 'ok'
  | 'brief'
  | 'empty'
  | 'overdue'
  | 'duplicate_self'
  | 'duplicate_other'
  | 'not_required';

export const COMMENT_STATUS_LABELS: Record<CommentQualityStatus, string> = {
  ok: 'Đủ',
  brief: 'Ngắn',
  empty: 'Thiếu',
  overdue: 'Quá hạn',
  duplicate_self: 'Trùng',
  duplicate_other: 'Trùng',
  not_required: '—',
};

export const COMMENT_STATUS_COUNT_LABELS = {
  ok: 'đủ',
  brief: 'ngắn',
  empty: 'thiếu',
  overdue: 'quá hạn',
  duplicate: 'trùng',
} as const;

export const COMMENT_STATUS_GROUP_LABELS = {
  ok: COMMENT_STATUS_LABELS.ok,
  brief: COMMENT_STATUS_LABELS.brief,
  empty: COMMENT_STATUS_LABELS.empty,
  overdue: COMMENT_STATUS_LABELS.overdue,
  duplicate: COMMENT_STATUS_LABELS.duplicate_self,
  emptyOrOverdue: `${COMMENT_STATUS_LABELS.empty} / ${COMMENT_STATUS_LABELS.overdue}`,
} as const;

export function getCommentStatusVariant(status: CommentQualityStatus): 'passed' | 'warning' | 'failed' | 'demo' | 'exempt' {
  if (status === 'ok') return 'passed';
  if (status === 'brief') return 'warning';
  if (status === 'duplicate_self' || status === 'duplicate_other') return 'demo';
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
