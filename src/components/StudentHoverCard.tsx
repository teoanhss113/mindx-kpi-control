'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { fetchStudentProfile } from '@/services/studentProfileService';
import type { StudentProfile, StudentStudyClass } from '@/types/studentProfile';
import styles from './StudentHoverCard.module.css';

const profileCache = new Map<string, StudentProfile>();
const pendingRequests = new Map<string, Promise<StudentProfile>>();
const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 160;
const CARD_GAP = 8;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang học',
  IN_PROGRESS: 'Đang học',
  PENDING: 'Sắp học',
  UPCOMING: 'Sắp học',
  FINISHED: 'Đã kết thúc',
  COMPLETED: 'Đã hoàn thành',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
  CANCELED: 'Đã hủy',
};

export interface StudentHoverCardProps {
  studentId?: string | null;
  studentName: string;
  children?: ReactNode;
  className?: string;
}

function loadProfile(studentId: string): Promise<StudentProfile> {
  const cached = profileCache.get(studentId);
  if (cached) return Promise.resolve(cached);

  const pending = pendingRequests.get(studentId);
  if (pending) return pending;

  const request = fetchStudentProfile(studentId)
    .then((profile) => {
      profileCache.set(studentId, profile);
      pendingRequests.delete(studentId);
      return profile;
    })
    .catch((error) => {
      pendingRequests.delete(studentId);
      throw error;
    });

  pendingRequests.set(studentId, request);
  return request;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function classTimestamp(studyClass: StudentStudyClass): number {
  const value = studyClass.endDate || studyClass.startDate;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function isUsableStudentId(studentId?: string | null): studentId is string {
  if (!studentId) return false;
  return studentId !== 'unknown' && !studentId.startsWith('st-sheet-');
}

export function StudentHoverCard({
  studentId,
  studentName,
  children,
  className,
}: StudentHoverCardProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState('');
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const usableStudentId = isUsableStudentId(studentId) ? studentId : null;

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );
    const estimatedHeight = 340;
    const showAbove = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight;

    setCardStyle({
      width,
      left,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + CARD_GAP }
        : { top: rect.bottom + CARD_GAP }),
    });
  }, []);

  const show = useCallback((immediate = false) => {
    if (!usableStudentId) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const reveal = () => {
      if (profile?.id !== usableStudentId) setProfile(null);
      setError('');
      updatePosition();
      setOpen(true);
    };
    if (immediate) reveal();
    else openTimerRef.current = setTimeout(reveal, OPEN_DELAY_MS);
  }, [profile?.id, updatePosition, usableStudentId]);

  const hide = useCallback((immediate = false) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (immediate) setOpen(false);
    else closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!open || !usableStudentId || profile?.id === usableStudentId) return;
    let active = true;

    loadProfile(usableStudentId)
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch(() => {
        if (active) setError('Không thể tải thông tin học viên');
      });

    return () => {
      active = false;
    };
  }, [open, profile?.id, usableStudentId]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide(true);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [hide, open, updatePosition]);

  useEffect(() => clearTimers, [clearTimers]);

  const classes = useMemo(
    () => [...(profile?.studyClasses ?? [])].sort((a, b) => classTimestamp(b) - classTimestamp(a)),
    [profile?.studyClasses],
  );

  const card = open && usableStudentId ? (
    <div
      id={tooltipId}
      role="tooltip"
      className={styles.card}
      style={cardStyle}
      onMouseEnter={() => show(true)}
      onMouseLeave={() => hide()}
    >
      {!profile && !error && (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          Đang tải hồ sơ…
        </div>
      )}
      {error && <div className={styles.state}>{error}</div>}
      {profile && (
        <>
          <div className={styles.header}>
            {profile.imageUrl ? (
              <span
                className={styles.avatar}
                style={{ backgroundImage: `url(${JSON.stringify(profile.imageUrl)})` }}
                aria-hidden="true"
              />
            ) : (
              <div className={styles.avatarFallback} aria-hidden="true">
                {initials(profile.fullName || studentName)}
              </div>
            )}
            <div className={styles.identity}>
              <div className={styles.name}>{profile.fullName || studentName}</div>
              {profile.email && <div className={styles.contact}>{profile.email}</div>}
              {profile.phoneNumber && <div className={styles.contact}>{profile.phoneNumber}</div>}
            </div>
          </div>
          <div className={styles.body}>
            <div className={styles.sectionTitle}>
              Các lớp đã học
              <span className={styles.count}>{classes.length} lớp</span>
            </div>
            {classes.length === 0 ? (
              <div className={styles.state}>Chưa có dữ liệu lớp học.</div>
            ) : (
              <ul className={styles.classList}>
                {classes.map((studyClass) => {
                  const startDate = formatDate(studyClass.startDate);
                  const endDate = formatDate(studyClass.endDate);
                  const dateRange = [startDate, endDate].filter(Boolean).join(' – ');
                  const status = studyClass.status
                    ? STATUS_LABELS[studyClass.status] || studyClass.status
                    : '';
                  return (
                    <li className={styles.classItem} key={studyClass.id}>
                      <div className={styles.className}>{studyClass.name}</div>
                      <div className={styles.classMeta}>
                        {studyClass.course?.name && <span>{studyClass.course.name}</span>}
                        {dateRange && <span>{dateRange}</span>}
                        {status && <span className={styles.status}>{status}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  ) : null;

  if (!usableStudentId) {
    return <>{children ?? studentName}</>;
  }

  return (
    <span className={`${styles.wrapper} ${className ?? ''}`}>
      <span
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => show()}
        onMouseLeave={() => hide()}
        onFocus={() => show(true)}
        onBlur={() => hide()}
        onClick={(event) => {
          event.stopPropagation();
          if (open) hide(true);
          else show(true);
        }}
      >
        {children ?? studentName}
      </span>
      {typeof document !== 'undefined' && card ? createPortal(card, document.body) : null}
    </span>
  );
}
