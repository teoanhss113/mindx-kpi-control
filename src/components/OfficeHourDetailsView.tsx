'use client';

import React from 'react';
import type { OfficeHour } from '@/types/officeHours';
import { OfficeHourStatusBadge, OfficeHourTypeBadge } from '@/components/ui';
import styles from '@/app/dashboard.module.css';

function fmtTime(iso: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function fmtTimestamp(ts: number | undefined) {
  if (!ts || isNaN(ts)) return '—';
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
    {children}
  </div>
);

const ReadOnlyField: React.FC<{ children: React.ReactNode; minHeight?: number }> = ({ children, minHeight }) => (
  <div
    style={{
      width: '100%',
      minHeight,
      padding: '8px 12px',
      border: '1px solid var(--border-secondary)',
      borderRadius: 'var(--radius-comfortable)',
      fontSize: 13,
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap',
      lineHeight: 1.5,
    }}
  >
    {children}
  </div>
);

/**
 * Read-only renderer for an OfficeHour. Same layout as the admin edit modal,
 * but every interactive control is replaced with a non-editable display so
 * non-admin pages can show the same information without granting edit access.
 *
 * Wrap in <Modal>/<ModalHeader> from `@/components/ui` at the call site.
 */
export function OfficeHourDetailsView({ oh }: { oh: OfficeHour }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {/* Basic info grid */}
      <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)' }}>
        <div>
          <Label>Thời gian</Label>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {fmtTime(oh.startTime)} - {fmtTime(oh.endTime)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(oh.startTime)}</div>
        </div>

        <div>
          <Label>Trạng thái</Label>
          <OfficeHourStatusBadge status={oh.status} />
        </div>

        <div>
          <Label>Loại ca</Label>
          <OfficeHourTypeBadge type={oh.type} />
        </div>

        <div>
          <Label>Số học viên</Label>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {oh.studentCount || 0} học viên
          </div>
        </div>

        <div>
          <Label>Cơ sở</Label>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {oh.centre?.name || oh.centre?.shortName || '—'}
          </div>
        </div>

        <div>
          <Label>Giáo viên</Label>
          <ReadOnlyField>
            {oh.teacher?.fullName || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Chưa có giáo viên</span>}
          </ReadOnlyField>
        </div>
      </div>

      {/* Khóa học */}
      {oh.courses && oh.courses.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Khóa học ({oh.courses.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {oh.courses.map(course => (
              <div key={course.id} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-comfortable)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{course.shortName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{course.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lớp học */}
      {oh.class && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Lớp học</div>
          <div style={{ padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{oh.class.name}</div>
            {oh.class.sessions && oh.class.sessions.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {oh.class.sessions.length} buổi học
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ghi chú */}
      {(oh.note || oh.managerNote) && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Ghi chú</div>
          {oh.note && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Ghi chú vận hành:
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-comfortable)' }}>
                {oh.note}
              </div>
            </div>
          )}
          {oh.managerNote && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Ghi chú quản lý:
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-comfortable)' }}>
                {oh.managerNote}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liên kết */}
      {oh.links && oh.links.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Liên kết ({oh.links.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {oh.links.map(link => (
              <a
                key={link._id}
                href={link.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-comfortable)',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {link.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Lịch hẹn học viên */}
      {oh.appointments && oh.appointments.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Lịch hẹn học viên ({oh.appointments.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {oh.appointments.map(apt => (
              <div
                key={apt.id}
                style={{
                  padding: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-comfortable)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 2fr)',
                  gap: 'var(--space-3)',
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {apt.candidate.fullName}
                  </div>
                  {apt.title && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{apt.title}</div>
                  )}
                  {apt.candidate.phoneNumber && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>📞 {apt.candidate.phoneNumber}</div>
                  )}
                </div>
                <div>
                  <span className={`${styles.statusPill} ${styles.exempt}`} style={{ fontSize: 11, padding: '4px 10px' }}>
                    {apt.status}
                  </span>
                  {apt.courses && apt.courses.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {apt.courses.map(c => (
                        <span key={c.id} className={styles.reasonTag} style={{ fontSize: 11, padding: '2px 6px' }}>
                          {c.shortName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '8px 10px',
                  background: apt.note ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface)',
                  border: `1px solid ${apt.note ? 'var(--status-warning)' : 'var(--border-secondary)'}`,
                  borderRadius: 'var(--radius-comfortable)',
                  fontSize: 12,
                  color: apt.note ? 'var(--status-warning)' : 'var(--text-tertiary)',
                  lineHeight: 1.4,
                }}>
                  {apt.note || 'Chưa có nhận xét'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Created/Updated metadata */}
      {(oh.createdBy || oh.lastModifiedBy) && (
        <div style={{ padding: '16px 20px', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {oh.createdBy && oh.createdAt && (
            <div>Tạo bởi: {oh.createdBy.username} · {fmtTimestamp(oh.createdAt)}</div>
          )}
          {oh.lastModifiedBy && oh.lastModifiedAt && (
            <div>Cập nhật bởi: {oh.lastModifiedBy.username} · {fmtTimestamp(oh.lastModifiedAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}
