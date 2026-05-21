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

function getFinalSessionCompletion(cls: Class): { isFinalSessionCompleted: boolean; finalSessionDate: string | null } {
  const sessions = [...(cls.slots || [])]
    .filter(slot => slot.date || slot.startTime || slot.endTime)
    .sort((a, b) => {
      const aTime = a.startTime || a.date || a.endTime;
      const bTime = b.startTime || b.date || b.endTime;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  const finalSession = sessions[sessions.length - 1];
  if (!finalSession) return { isFinalSessionCompleted: false, finalSessionDate: null };

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
  const relevantWorks = works.filter(work => !work.studentId || activeStudentIds.size === 0 || activeStudentIds.has(work.studentId));
  const submittedStudentIds = new Set(relevantWorks.map(work => work.studentId).filter(Boolean));
  const submittedCount = activeStudentIds.size > 0 ? submittedStudentIds.size : relevantWorks.length;
  const approvedCount = relevantWorks.filter(work => {
    const status = (work.status || '').toUpperCase();
    return ['APPROVED', 'ACCEPTED', 'PUBLISHED', 'PUBLIC'].includes(status);
  }).length;
  const rejectedCount = relevantWorks.filter(work => {
    const status = (work.status || '').toUpperCase();
    return ['REJECTED', 'DECLINED'].includes(status);
  }).length;
  const totalStudents = activeStudents.length;

  return {
    classId: cls.id,
    totalStudents,
    isFinalSessionCompleted: finalSessionCompletion.isFinalSessionCompleted,
    finalSessionDate: finalSessionCompletion.finalSessionDate,
    submittedCount,
    approvedCount,
    rejectedCount,
    pendingCount: Math.max(submittedCount - approvedCount - rejectedCount, 0),
    missingCount: Math.max(totalStudents - submittedCount, 0),
  };
}
