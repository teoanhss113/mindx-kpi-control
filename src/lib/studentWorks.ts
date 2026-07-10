import type { Class, FinalProductClassStats, StudentWork } from '@/types/classes';

export function getStudentWorkStatusMeta(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  if (['APPROVED', 'ACCEPTED', 'PUBLISHED', 'PUBLIC'].includes(normalized)) {
    return { label: 'Đã duyệt', color: 'var(--status-success)', bg: 'rgba(34, 197, 94, 0.1)' };
  }
  if (['REJECTED', 'DECLINED'].includes(normalized)) {
    return { label: 'Từ chối', color: 'var(--status-error)', bg: 'rgba(220, 38, 38, 0.08)' };
  }
  if (['SUBMITTED', 'PENDING', 'WAITING_APPROVE', 'WAITING_APPROVAL', 'REVIEWING'].includes(normalized)) {
    return { label: 'Chờ duyệt', color: 'var(--status-warning)', bg: 'rgba(245, 158, 11, 0.1)' };
  }
  if (normalized === 'DRAFT') {
    return { label: 'Bản nháp', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' };
  }
  return { label: status || 'Chưa rõ', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
}

export function getStudentWorkFileName(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return name || fallback;
  } catch {
    const name = decodeURIComponent(url.split('?')[0].split('/').filter(Boolean).pop() || '');
    return name || fallback;
  }
}

export function getStudentWorkAssetCount(work: StudentWork) {
  const latest = work.latestData;
  if (!latest) return 0;
  return [
    latest.thumbnail,
    latest.imageUrl,
    ...(latest.videoUrls || []),
    ...(latest.attachmentUrls || []),
    ...(latest.relatedUrls || []).map(item => item?.url),
  ].filter(Boolean).length;
}

export function getActiveClassStudents(cls: Class) {
  return (cls.students || [])
    .filter(student => student.activeInClass)
    .map(student => ({
      id: student.student.id,
      name: student.student.fullName || student.student.customer?.fullName || 'Không rõ tên',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const APPROVED_WORK_STATUSES = new Set(['APPROVED', 'ACCEPTED', 'PUBLISHED', 'PUBLIC']);
const REJECTED_WORK_STATUSES = new Set(['REJECTED', 'DECLINED']);
const PENDING_WORK_STATUSES = new Set(['SUBMITTED', 'PENDING', 'WAITING_APPROVE', 'WAITING_APPROVAL', 'REVIEWING']);

function getStudentWorkStatusPriority(status?: string | null): number {
  const normalized = (status || '').toUpperCase();
  if (APPROVED_WORK_STATUSES.has(normalized)) return 4;
  if (PENDING_WORK_STATUSES.has(normalized)) return 3;
  if (REJECTED_WORK_STATUSES.has(normalized)) return 2;
  if (normalized === 'DRAFT') return 1;
  return normalized ? 1 : 0;
}

function getStudentWorkTime(work: StudentWork): number {
  const raw = work.lastModifiedAt || work.createdAt;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function isPreferredStudentWork(candidate: StudentWork, current?: StudentWork): boolean {
  if (!current) return true;

  const candidatePriority = getStudentWorkStatusPriority(candidate.status);
  const currentPriority = getStudentWorkStatusPriority(current.status);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  const candidateVersion = candidate.version ?? 0;
  const currentVersion = current.version ?? 0;
  if (candidateVersion !== currentVersion) return candidateVersion > currentVersion;

  return getStudentWorkTime(candidate) >= getStudentWorkTime(current);
}

export function buildStudentWorksByStudentId(works: StudentWork[], activeStudentIds?: Set<string>) {
  const worksByStudent = new Map<string, StudentWork>();

  works.forEach(work => {
    const studentId = work.studentId;
    if (!studentId) return;
    if (activeStudentIds && activeStudentIds.size > 0 && !activeStudentIds.has(studentId)) return;

    const current = worksByStudent.get(studentId);
    if (isPreferredStudentWork(work, current)) {
      worksByStudent.set(studentId, work);
    }
  });

  return worksByStudent;
}

function getFinalSessionCompletion(cls: Class): { isFinalSessionCompleted: boolean; finalSessionDate: string | null } {
  const sessions = [...(cls.slots || [])]
    .filter(slot => slot.date || slot.startTime || slot.endTime)
    .sort((a, b) => {
      const aTime = a.startTime || a.date || a.endTime;
      const bTime = b.startTime || b.date || b.endTime;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  const finalSession = sessions[sessions.length - 1];
  if (!finalSession) {
    const endTime = cls.endDate ? new Date(cls.endDate).getTime() : NaN;
    return {
      isFinalSessionCompleted: Number.isFinite(endTime) ? endTime <= Date.now() : false,
      finalSessionDate: cls.endDate || null,
    };
  }

  const finalEnd = finalSession.endTime || finalSession.startTime || finalSession.date;
  const finalTime = new Date(finalEnd).getTime();
  if (!Number.isFinite(finalTime)) return { isFinalSessionCompleted: false, finalSessionDate: finalEnd || null };

  return {
    isFinalSessionCompleted: finalTime <= Date.now(),
    finalSessionDate: finalEnd || null,
  };
}

export function buildFinalProductClassStats(cls: Class, works: StudentWork[]): FinalProductClassStats {
  const activeStudents = getActiveClassStudents(cls);
  const finalSessionCompletion = getFinalSessionCompletion(cls);
  const activeStudentIds = new Set(activeStudents.map(student => student.id));
  const worksByStudent = buildStudentWorksByStudentId(works, activeStudentIds);
  const representativeWorks = Array.from(worksByStudent.values());
  const submittedCount = representativeWorks.length;
  const approvedCount = representativeWorks.filter(work => {
    const status = (work.status || '').toUpperCase();
    return APPROVED_WORK_STATUSES.has(status);
  }).length;
  const rejectedCount = representativeWorks.filter(work => {
    const status = (work.status || '').toUpperCase();
    return REJECTED_WORK_STATUSES.has(status);
  }).length;
  const totalStudents = activeStudents.length;
  const pendingCount = representativeWorks.length - approvedCount - rejectedCount;

  return {
    classId: cls.id,
    totalStudents,
    isFinalSessionCompleted: finalSessionCompletion.isFinalSessionCompleted,
    finalSessionDate: finalSessionCompletion.finalSessionDate,
    submittedCount,
    approvedCount,
    rejectedCount,
    pendingCount: Math.max(pendingCount, 0),
    missingCount: finalSessionCompletion.isFinalSessionCompleted
      ? Math.max(totalStudents - submittedCount, 0)
      : 0,
  };
}
