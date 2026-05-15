import { CLASS_INACTIVE_STATUSES } from '@/constants';
import { findBestMatch, getTrueAcronym, normalizeCenterHint, normalizeString, type RawSheetRow } from '@/lib/googleSheetsMatching';

export const TEACHER_POINT_SESSION_INDICES = [3, 7] as const;

export const TEACHER_POINT_EXEMPTED_REASONS = [
  'CHANGE_CLASS_SCHEDULE_CHANGE',
  'TRANSFER_COURSE_LINE',
  'WRONG_ENROLL',
  'ON_HOLD',
  'DROP_OUT',
  'On hold',
] as const;

export type TeacherPointSheetRow = ReturnType<typeof findBestMatch> & {
  rowDate: Date | null;
  avgScore: number | null;
  scoreK: number | null;
  scoreL: number | null;
  isInferred?: boolean;
  inferredClass?: string;
  inferredCode?: string;
};

type TeacherPointStudent = {
  activeInClass?: boolean;
  completionInfo?: {
    status?: string;
    reason?: string | null;
  } | null;
  student?: {
    id?: string;
    fullName?: string;
  };
};

type TeacherPointSlot = {
  date?: string;
  studentAttendance?: Array<{
    student?: {
      id?: string;
    };
  }>;
};

type TeacherPointClass = {
  id: string;
  name: string;
  className?: string;
  status?: string;
  slots?: TeacherPointSlot[];
  students?: TeacherPointStudent[];
};

type TeacherPointCentre = {
  id: string;
  shortName?: string;
};

function normalizeCompletionReason(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (!trimmed) return '';
  if (trimmed.toUpperCase().replace(/\s+/g, '_') === 'ON_HOLD') return 'ON_HOLD';
  return trimmed;
}

export function isTeacherPointExemptStudent(st: TeacherPointStudent, classSlots?: TeacherPointSlot[]): boolean {
  const info = st.completionInfo;
  const hasAttendance = classSlots?.some(slot =>
    slot.studentAttendance?.some(attendance => attendance.student?.id === st.student?.id)
  );

  if (info && info.status === 'WAITING' && !hasAttendance) return true;
  if (!st.activeInClass && !hasAttendance) return true;

  if (info?.reason) {
    const normReason = normalizeCompletionReason(info.reason);
    if ((TEACHER_POINT_EXEMPTED_REASONS as readonly string[]).includes(normReason)) return true;
  }

  return false;
}

function extractTeacherPointScore(value: string) {
  const num = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}

function getJumbleKey(value: string) {
  const normalized = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = normalized.replace(/[^0-9]/g, '');
  const letters = normalized.replace(/[^A-Z]/g, '').split('').sort().join('');
  return digits && letters ? `${digits}:${letters}` : normalized;
}

export function buildTeacherPointRowsFromGoogleSheets({
  rawData,
  classes,
  fromDate,
  toDate,
  centres,
  selectedCentres = [],
  search = '',
}: {
  rawData: RawSheetRow[];
  classes: TeacherPointClass[];
  fromDate: string;
  toDate: string;
  centres: TeacherPointCentre[];
  selectedCentres?: string[];
  search?: string;
}): TeacherPointSheetRow[] {
  if (!rawData || rawData.length === 0) return [];

  const dStart = fromDate ? new Date(fromDate) : null;
  if (dStart) dStart.setHours(0, 0, 0, 0);
  const dEnd = toDate ? new Date(toDate) : null;
  if (dEnd) dEnd.setHours(23, 59, 59, 999);

  const initialPass = rawData.map(row => {
    const timeStr = row['Timestamp'] || '';
    const rowDate = timeStr ? new Date(timeStr) : null;
    const matchInfo = findBestMatch(row, classes);
    const scoreK = extractTeacherPointScore(row['Giáo viên lớp em giảng bài dễ hiểu chứ?'] || '');
    const scoreL = extractTeacherPointScore(row['Em yêu thích Giáo viên lớp mình chứ?'] || '');
    const validScores = [scoreK, scoreL].filter(score => score !== null) as number[];
    const avgScore = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : null;

    return { ...matchInfo, rowDate, avgScore, scoreK, scoreL };
  });

  const withInference = initialPass.map((item, index) => {
    if (item.matchedClass) return item;
    const radius = 5;
    const startSearch = Math.max(0, index - radius);
    const endSearch = Math.min(initialPass.length - 1, index + radius);
    const itemKey = getJumbleKey(item.normalizedClassCode);
    const candidates = new Map<string, { item: TeacherPointSheetRow; count: number }>();

    for (let i = startSearch; i <= endSearch; i++) {
      if (i === index) continue;
      const neighbor = initialPass[i];
      const neighborFull = neighbor.normalizedClassCode;
      if (!neighborFull.includes('-')) continue;

      const segments = item.normalizedClassCode.split('-');
      const itemCore = segments.find(segment => /\d/.test(segment)) || segments.pop() || '';
      const neighborKey = getJumbleKey(neighborFull);
      const isContained = itemCore.length >= 4 && neighborFull.includes(itemCore);
      const isJumbledEquivalent = itemKey.length > 3 && itemKey === neighborKey;

      let isSubsetRescue = false;
      const itemDigits = item.normalizedClassCode.replace(/[^0-9]/g, '');
      const neighborDigits = neighborFull.replace(/[^0-9]/g, '');
      if (itemDigits && itemDigits === neighborDigits && itemDigits.length >= 1) {
        const itemLetters = item.normalizedClassCode.replace(/[^A-Z]/g, '');
        const neighborLetters = neighborFull.replace(/[^A-Z]/g, '');
        if (itemLetters.length >= 3 && neighborLetters.length >= 3) {
          const shortStr = itemLetters.length <= neighborLetters.length ? itemLetters : neighborLetters;
          const longStr = itemLetters.length <= neighborLetters.length ? neighborLetters : itemLetters;
          const chars = Array.from(new Set(shortStr.split('')));
          isSubsetRescue = chars.every(char => longStr.includes(char));
        }
      }

      if (isContained || isJumbledEquivalent || isSubsetRescue) {
        const key = neighborFull;
        if (!candidates.has(key)) candidates.set(key, { item: neighbor, count: 0 });
        candidates.get(key)!.count += 1;
      }
    }

    const rankedCandidates = Array.from(candidates.values()).sort((a, b) => {
      if (a.item.matchedClass && !b.item.matchedClass) return -1;
      if (!a.item.matchedClass && b.item.matchedClass) return 1;
      const lenA = a.item.normalizedClassCode.length;
      const lenB = b.item.normalizedClassCode.length;
      if (lenA !== lenB) return lenB - lenA;
      return b.count - a.count;
    });

    const bestNeighbor = rankedCandidates[0]?.item || null;
    if (!bestNeighbor) return item;
    if (bestNeighbor.matchedClass) {
      return {
        ...item,
        matchedClass: bestNeighbor.matchedClass,
        inferredClass: bestNeighbor.matchedClass.className || bestNeighbor.matchedClass.name,
        matchScore: 90,
        isInferred: true,
        matchReason: ['Suy luận'],
      };
    }
    if (
      bestNeighbor.normalizedClassCode.length > item.normalizedClassCode.length ||
      (bestNeighbor.normalizedClassCode.length === item.normalizedClassCode.length && bestNeighbor.normalizedClassCode !== item.normalizedClassCode)
    ) {
      return { ...item, normalizedClassCode: bestNeighbor.normalizedClassCode, isInferred: true, inferredCode: bestNeighbor.normalizedClassCode };
    }
    return item;
  });

  return withInference
    .filter(item => {
      if (!item.rowDate) return true;
      if (dStart && item.rowDate < dStart) return false;
      if (dEnd && item.rowDate > dEnd) return false;
      return true;
    })
    .filter(item => {
      if (!selectedCentres || selectedCentres.length === 0) return true;
      const targetShorts = selectedCentres
        .map(id => centres.find(c => c.id === id)?.shortName)
        .filter(Boolean) as string[];
      if (targetShorts.length === 0) return true;
      const rowCenterTokens = item.normalizedClassCode
        .split('-')
        .map(segment => normalizeCenterHint(segment))
        .filter(Boolean) as string[];
      return targetShorts.some(targetShort => {
        const hasNumTarget = /\d/.test(targetShort);
        return rowCenterTokens.some(rowCenterRaw => {
          const hasNumRow = /\d/.test(rowCenterRaw);
          if (hasNumTarget && hasNumRow) return targetShort === rowCenterRaw;
          return getTrueAcronym(targetShort) === getTrueAcronym(rowCenterRaw);
        });
      });
    })
    .filter(item => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        item.studentName.toLowerCase().includes(term) ||
        item.inputClassCode.toLowerCase().includes(term) ||
        (item.matchedClass?.className || item.matchedClass?.name || '').toLowerCase().includes(term)
      );
    });
}

function classHasTeacherPointSessionInRange(cls: TeacherPointClass, fromDate: Date, toDate: Date) {
  return TEACHER_POINT_SESSION_INDICES.some(index => {
    const slot = cls.slots?.[index];
    if (!slot?.date) return false;
    const slotDate = new Date(slot.date);
    return slotDate >= fromDate && slotDate <= toDate;
  });
}

function resolveStudentKey(row: TeacherPointSheetRow, cls: TeacherPointClass) {
  const targetNameKey = normalizeString(row.studentName).replace(/\s+/g, '');
  const matchedRosterStudent = (cls.students || []).find(st => {
    const lmsNameKey = normalizeString(st.student?.fullName || '').replace(/\s+/g, '');
    return lmsNameKey && lmsNameKey === targetNameKey;
  });

  return matchedRosterStudent?.student?.id || `sheet:${targetNameKey || normalizeString(row.studentName)}`;
}

export function calcTeacherPointRate({
  classes,
  rows,
  fromDate,
  toDate,
}: {
  classes: TeacherPointClass[];
  rows: TeacherPointSheetRow[];
  fromDate: string;
  toDate: string;
}): { rate: number | null; collected: number; eligible: number; eligibleClasses: number } {
  if (!fromDate || !toDate) return { rate: null, collected: 0, eligible: 0, eligibleClasses: 0 };

  const dStart = new Date(fromDate);
  dStart.setHours(0, 0, 0, 0);
  const dEnd = new Date(toDate);
  dEnd.setHours(23, 59, 59, 999);

  const eligibleClasses = (classes || []).filter(cls => {
    const status = cls.status?.toUpperCase?.() || '';
    return !CLASS_INACTIVE_STATUSES.has(status) && classHasTeacherPointSessionInRange(cls, dStart, dEnd);
  });

  const classMap = new Map<string, TeacherPointClass>();
  for (const cls of eligibleClasses) {
    classMap.set(cls.id, cls);
    classMap.set(cls.name, cls);
    classMap.set((cls.className || cls.name || '').toString(), cls);
  }

  const eligible = eligibleClasses.reduce((total, cls) => {
    const validStudents = (cls.students || []).filter(st => !isTeacherPointExemptStudent(st, cls.slots));
    return total + validStudents.length;
  }, 0);

  const collectedKeys = new Set<string>();
  for (const row of rows || []) {
    const classId = row.matchedClass?.id;
    const className = row.matchedClass?.className || row.matchedClass?.name || row.normalizedClassCode;
    const cls = (classId && classMap.get(classId)) || classMap.get(className);
    if (!cls) continue;
    collectedKeys.add(`${cls.id}:${resolveStudentKey(row, cls)}`);
  }

  const collected = Math.min(collectedKeys.size, eligible);

  return {
    rate: eligible > 0 ? (collected / eligible) * 100 : null,
    collected,
    eligible,
    eligibleClasses: eligibleClasses.length,
  };
}
