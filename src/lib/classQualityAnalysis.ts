import { Class, Session } from '@/types/classes';
import { getCourseCategory } from '@/lib/courseCategories';
import { computeTBCK, determineRank } from '@/lib/courseGrading';
import { getStudentAttendanceCommentContent } from '@/lib/commentContent';
import { 
  ClassCommentAnalysis, 
  ClassAttendanceAnalysis, 
  StudentAttendanceAnalysis,
  StudentCommentStatus,
  CommentStatus,
  AttendanceAlert,
  AnalyzedClassForQuality,
  SessionReschedulingAnalysis,
  CheckpointAnalysis,
  StudentCheckpointScore,
  StudentDemoScore
} from '@/types/classQuality';

// Checkpoint sessions where comments are required even if student is absent
const CHECKPOINT_SESSIONS = [5, 9, 14]; // 1-indexed: session 5, 9, 14

export function analyzeComments(cls: Class, exemptSessions: number[] = CHECKPOINT_SESSIONS): ClassCommentAnalysis {
  let emptyCount = 0;
  let briefCount = 0;
  let duplicateCount = 0;
  let overdueCount = 0;
  let okCount = 0;
  
  const slots = (cls.slots ?? [])
    .filter(s => s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const passedSlots = slots.filter(s => new Date(s.date).getTime() < Date.now()).length;

  const studentMap = new Map<string, StudentCommentStatus>();
  (cls.students ?? []).forEach(s => {
    // Skip students who are no longer active in class
    if (!s.activeInClass) return;
    
    studentMap.set(s.student.id, {
      studentId: s.student.id,
      studentName: s.student.fullName || s.student.customer.fullName,
      totalCommentsExpected: 0,
      emptyCount: 0,
      briefCount: 0,
      duplicateCount: 0,
      overdueCount: 0,
      okCount: 0,
      comments: []
    });
  });

  for (let sessionIndex = 0; sessionIndex < slots.length; sessionIndex++) {
    const slot = slots[sessionIndex];
    const slotDate = new Date(slot.date);
    const isPast = slotDate.getTime() < Date.now();
    
    // Find teacher
    let teacherName = 'Không rõ';
    if (slot.teacherAttendance && slot.teacherAttendance.length > 0) {
      teacherName = slot.teacherAttendance[0].teacher.fullName;
    } else if (slot.teachers && slot.teachers.length > 0) {
      teacherName = slot.teachers[0].teacher.fullName;
    }

    // Pre-calculate frequencies of comments in THIS slot to detect 'duplicate_other'
    const slotCommentFreq = new Map<string, number>();
    (slot.studentAttendance ?? []).forEach(sa => {
      const text = getStudentAttendanceCommentContent(sa);
      if (text.length > 0) {
        slotCommentFreq.set(text, (slotCommentFreq.get(text) || 0) + 1);
      }
    });
    
    (slot.studentAttendance ?? []).forEach(sa => {
       const st = studentMap.get(sa.student.id);
       if (!st) return;

       const studentStatus = sa.status?.toUpperCase() || '';
       const isAbsent = ['ABSENT', 'ABSENT_UNEXCUSED', 'ABSENT_WITH_NOTICE'].includes(studentStatus);
       const isCheckpoint = exemptSessions.includes(sessionIndex + 1); // sessionIndex is 0-based, sessions are 1-based
       
       // Skip comment check if student is absent on non-checkpoint sessions
       if (isAbsent && !isCheckpoint) {
         return;
       }

       if (isPast) st.totalCommentsExpected++;

       const rawComment = getStudentAttendanceCommentContent(sa);
       const text = rawComment;
       let status: CommentStatus = 'ok';
       let isOverdue = false;
       let overdueHours = 0;
       
       if (!text) {
         if (isPast) status = 'empty';
       } else if (text.length < 30) {
         status = 'brief';
       } else {
         // Check duplicate within the same slot (other students)
         if ((slotCommentFreq.get(text) || 0) > 1) {
           status = 'duplicate_other';
         } 
         // Check duplicate with THIS student's previous comments
         else if (st.comments.some(c => c.text === text)) {
           status = 'duplicate_self';
         }
       }

       if (isPast && !text) {
           const hoursPassed = (Date.now() - slotDate.getTime()) / (1000 * 60 * 60);
           if (hoursPassed > 48) {
               status = 'overdue';
               isOverdue = true;
               overdueHours = hoursPassed;
           }
       }

       if (status === 'empty') { st.emptyCount++; emptyCount++; }
       else if (status === 'brief') { st.briefCount++; briefCount++; }
       else if (status === 'duplicate_self' || status === 'duplicate_other') { st.duplicateCount++; duplicateCount++; }
       else if (status === 'overdue') { st.overdueCount++; overdueCount++; }
       else if (status === 'ok' && isPast) { st.okCount++; okCount++; }

       st.comments.push({
         date: slot.date,
         sessionIndex,
         teacherName,
         text,
         status,
         isOverdue,
         overdueHours: isOverdue ? Math.floor(overdueHours) : undefined
       });
    });
  }

  return {
    classId: cls.id,
    passedSlots,
    totalSlots: slots.length,
    emptyCount,
    briefCount,
    duplicateCount,
    overdueCount,
    okCount,
    students: Array.from(studentMap.values())
  };
}

export function analyzeAttendance(cls: Class): ClassAttendanceAnalysis {
  const studentsWithAlerts: StudentAttendanceAnalysis[] = [];
  let totalAlerts = 0;
  
  const slots = (cls.slots ?? [])
    .filter(s => s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
  // Map student id to their attendance
  const studentMap = new Map<string, StudentAttendanceAnalysis>();
  
  (cls.students ?? []).forEach(s => {
    // Skip students who are no longer active in class
    if (!s.activeInClass) return;
    
    studentMap.set(s.student.id, {
      studentId: s.student.id,
      studentName: s.student.fullName || s.student.customer.fullName,
      alerts: [],
      absentCount: 0,
      consecutiveAbsentCount: 0,
      lateStageAbsentCount: 0,
      totalSlots: 0,
      sessions: []
    });
  });

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isLateStage = i >= 9; // 10th session or later
    
    (slot.studentAttendance ?? []).forEach(sa => {
      const st = studentMap.get(sa.student.id);
      if (!st) return;
      
      const isAbsent = ['ABSENT', 'ABSENT_UNEXCUSED'].includes(sa.status?.toUpperCase() || '');
      st.sessions.push({
        date: slot.date,
        status: sa.status || 'UNKNOWN',
        isLateStage
      });
    });
  }
  
  for (const st of Array.from(studentMap.values())) {
    let currentConsecutive = 0;
    st.totalSlots = st.sessions.length;
    
    for (let i = 0; i < st.sessions.length; i++) {
      const sess = st.sessions[i];
      const isAbsent = ['ABSENT', 'ABSENT_UNEXCUSED'].includes(sess.status?.toUpperCase());
      
      if (isAbsent) {
        st.absentCount++;
        currentConsecutive++;
        if (currentConsecutive >= 2) {
          st.consecutiveAbsentCount = Math.max(st.consecutiveAbsentCount, currentConsecutive);
        }
        if (sess.isLateStage) {
          st.lateStageAbsentCount++;
        }
      } else if (['PRESENT', 'LATE', 'EXCUSED'].includes(sess.status?.toUpperCase())) {
         currentConsecutive = 0;
      }
    }
    
    if (st.absentCount >= 3) st.alerts.push('frequent_absent');
    if (st.consecutiveAbsentCount >= 2) st.alerts.push('consecutive_absent');
    if (st.lateStageAbsentCount >= 1) st.alerts.push('late_stage_absent');
    
    if (st.alerts.length > 0) {
      studentsWithAlerts.push(st);
      totalAlerts += st.alerts.length;
    }
  }

  return {
    classId: cls.id,
    totalStudents: studentMap.size,
    totalAlerts,
    studentsWithAlerts
  };
}

/**
 * Detect repeating weekly pattern in session gaps
 * Returns array of gap values that form a weekly cycle, or null if no pattern found
 * 
 * Example: [2, 5, 2, 5, 2, 5] → [2, 5] (Tuesday & Thursday weekly)
 */
function detectWeeklyPattern(gaps: number[]): number[] | null {
  // Filter out outliers (holiday breaks, same-day sessions)
  const normalGaps = gaps.filter(g => g > 0 && g <= 14);
  
  if (normalGaps.length < 4) return null; // Need at least 4 gaps to detect pattern
  
  // Count frequency of each gap
  const frequency = new Map<number, number>();
  normalGaps.forEach(gap => {
    frequency.set(gap, (frequency.get(gap) || 0) + 1);
  });
  
  // Get gaps that appear at least twice, sorted by frequency
  const commonGaps = Array.from(frequency.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([gap]) => gap);
  
  if (commonGaps.length === 0) return null;
  
  // Try to find 2-gap pattern (most common: Tue-Thu, Mon-Wed-Fri, etc.)
  if (commonGaps.length >= 2) {
    const [gap1, gap2] = commonGaps.slice(0, 2);
    const sum = gap1 + gap2;
    
    // Check if they form a weekly cycle (6-8 days)
    if (sum >= 6 && sum <= 8) {
      return [gap1, gap2].sort((a, b) => a - b);
    }
  }
  
  // Try to find 3-gap pattern (e.g., Mon-Wed-Fri: 2-2-3)
  if (commonGaps.length >= 3) {
    const [gap1, gap2, gap3] = commonGaps.slice(0, 3);
    const sum = gap1 + gap2 + gap3;
    
    // Check if they form a weekly cycle
    if (sum >= 6 && sum <= 8) {
      return [gap1, gap2, gap3].sort((a, b) => a - b);
    }
  }
  
  // Single gap pattern (weekly classes)
  if (commonGaps.length === 1 && commonGaps[0] >= 6 && commonGaps[0] <= 8) {
    return [commonGaps[0]];
  }
  
  return null;
}

/**
 * Analyze session rescheduling patterns with intelligent pattern detection
 * 
 * Features:
 * 1. Detects repeating weekly patterns (e.g., Tue-Thu: 2-5-2-5)
 * 2. Handles holiday breaks (large gaps >14 days)
 * 3. Identifies same-day makeup sessions
 * 4. Accurate rescheduling detection based on detected pattern
 * 
 * IMPORTANT: Uses startTime field for accurate date calculation
 */
export function analyzeSessionRescheduling(cls: Class): SessionReschedulingAnalysis {
  const slots = (cls.slots ?? [])
    .filter(s => s.startTime || s.date)
    .sort((a, b) => {
      const aTime = a.startTime || a.date;
      const bTime = b.startTime || b.date;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

  if (slots.length < 2) {
    return {
      classId: cls.id,
      totalSessions: slots.length,
      rescheduledSessions: 0,
      classType: 'regular',
      averageDaysBetweenSessions: 0,
      sessions: slots.map((slot, idx) => ({
        sessionIndex: idx,
        date: slot.startTime || slot.date,
        daysSincePrevious: null,
        isRescheduled: false,
        reschedulingType: null,
        expectedDays: 7,
        deviation: 0
      }))
    };
  }

  // Calculate days between each session
  const sessionData = slots.map((slot, idx) => {
    const sessionDate = slot.startTime || slot.date;
    
    if (idx === 0) {
      return {
        sessionIndex: idx,
        date: sessionDate,
        daysSincePrevious: null
      };
    }
    
    const prevSlot = slots[idx - 1];
    const prevDate = new Date(prevSlot.startTime || prevSlot.date);
    const currDate = new Date(sessionDate);
    
    const prevDateOnly = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
    const currDateOnly = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
    const daysDiff = Math.round((currDateOnly.getTime() - prevDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      sessionIndex: idx,
      date: sessionDate,
      daysSincePrevious: daysDiff
    };
  });

  // Extract gaps for pattern detection
  const gaps = sessionData
    .slice(1)
    .map(s => s.daysSincePrevious)
    .filter(d => d !== null) as number[];

  // Detect repeating weekly pattern
  const detectedPattern = detectWeeklyPattern(gaps);
  
  // Debug: Log pattern detection
  if (detectedPattern) {
    console.log(`[Pattern Detection] Class ${cls.id}: Detected pattern [${detectedPattern.join(', ')}]`);
  }
  
  // Determine class type and expected days
  let classType: 'regular' | 'intensive';
  let baseExpectedDays: number;
  
  if (detectedPattern && detectedPattern.length > 1) {
    // Multi-session per week pattern detected
    classType = 'intensive';
    baseExpectedDays = 0; // Will use pattern instead
  } else {
    // No pattern or single-session per week
    const normalGaps = gaps.filter(g => g > 0 && g <= 14);
    const averageDays = normalGaps.length > 0
      ? normalGaps.reduce((sum, d) => sum + d, 0) / normalGaps.length
      : 7;
    
    classType = averageDays < 5 ? 'intensive' : 'regular';
    baseExpectedDays = detectedPattern ? detectedPattern[0] : (classType === 'regular' ? 7 : Math.round(averageDays));
  }

  // Threshold for detecting rescheduling
  const threshold = classType === 'regular' ? 3 : 2;

  let rescheduledCount = 0;

  // Track pattern position (excluding outliers and resetting after holiday breaks)
  let patternPosition = 0;
  
  const sessions = sessionData.map((session, idx) => {
    if (session.daysSincePrevious === null) {
      const firstExpected = detectedPattern ? detectedPattern[0] : baseExpectedDays;
      return {
        ...session,
        isRescheduled: false,
        reschedulingType: null as 'early' | 'late' | 'normal' | null,
        expectedDays: firstExpected,
        deviation: 0
      };
    }

    // Special handling for large gaps (holiday breaks) - check BEFORE pattern logic
    const isLikelyHolidayBreak = session.daysSincePrevious > 14;
    
    if (isLikelyHolidayBreak) {
      // Reset pattern position after holiday break
      patternPosition = 0;
      
      return {
        ...session,
        isRescheduled: false,
        reschedulingType: 'normal' as 'early' | 'late' | 'normal' | null,
        expectedDays: baseExpectedDays || 7,
        deviation: session.daysSincePrevious - (baseExpectedDays || 7)
      };
    }

    // Special case: Same-day sessions (makeup sessions)
    if (session.daysSincePrevious === 0) {
      const expected = detectedPattern 
        ? detectedPattern[patternPosition % detectedPattern.length]
        : baseExpectedDays;
      return {
        ...session,
        isRescheduled: false,
        reschedulingType: 'normal' as 'early' | 'late' | 'normal' | null,
        expectedDays: expected,
        deviation: -expected
      };
    }

    // Determine expected days for this session based on pattern
    let sessionExpectedDays: number;
    if (detectedPattern && detectedPattern.length > 1) {
      // Use alternating pattern based on position
      sessionExpectedDays = detectedPattern[patternPosition % detectedPattern.length];
    } else {
      sessionExpectedDays = baseExpectedDays;
    }
    
    const deviation = session.daysSincePrevious - sessionExpectedDays;
    const isRescheduled = Math.abs(deviation) > threshold;
    
    if (isRescheduled) rescheduledCount++;

    // Increment pattern position for next session
    patternPosition++;

    return {
      ...session,
      isRescheduled,
      reschedulingType: (isRescheduled 
        ? (deviation < 0 ? 'early' : 'late') 
        : 'normal') as 'early' | 'late' | 'normal' | null,
      expectedDays: sessionExpectedDays,
      deviation
    };
  });

  // Calculate average for display (excluding outliers)
  const normalGaps = gaps.filter(g => g > 0 && g <= 14);
  const averageDays = normalGaps.length > 0
    ? normalGaps.reduce((sum, d) => sum + d, 0) / normalGaps.length
    : 7;

  return {
    classId: cls.id,
    totalSessions: slots.length,
    rescheduledSessions: rescheduledCount,
    classType,
    averageDaysBetweenSessions: Math.round(averageDays * 10) / 10,
    sessions
  };
}

// ============================================================================
// CHECKPOINT SCORE ANALYSIS (CP1, CP2, Demo)
// ============================================================================

/**
 * Clean HTML and normalize text from comments
 */
function cleanText(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse score from comment text by label
 * Example: "Điểm lý thuyết: 4.5 điểm" -> 4.5
 */
function parseScoreByLabel(comment: string, label: string): number | null {
  const text = cleanText(comment);
  const match = text.match(new RegExp(`${label}\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*điểm`, 'i'));
  return match ? Number.parseFloat(match[1]) : null;
}

/**
 * Compute CP score from theory, practice, and ability scores
 * Formula: CP = 0.4 * (theory + practice)/2 + 0.6 * ability
 * 
 * Special case: If no theory/practice tests, use 100% ability score
 */
function computeCpScore(theory: number | null, practice: number | null, ability: number | null): number | null {
  // Special case: No theory/practice tests, only ability score
  if ((theory === null || practice === null) && ability !== null) {
    return ability; // 100% ability score
  }
  
  // Standard case: All scores present
  if (theory === null || practice === null || ability === null) {
    return null;
  }
  
  return 0.4 * ((theory + practice) / 2) + 0.6 * ability;
}

/**
 * Determine quality band for checkpoint score
 */
function getCheckpointQualityBand(score: number | null): 'excellent' | 'good' | 'average' | 'poor' | null {
  if (score === null) return null;
  if (score >= 4) return 'excellent';
  if (score >= 3.5) return 'good';
  if (score >= 3) return 'average';
  return 'poor';
}

/**
 * Determine quality band for demo score
 */
function getDemoQualityBand(score: number | null): 'good' | 'medium' | 'poor' | null {
  if (score === null) return null;
  if (score >= 4) return 'good';
  if (score >= 3) return 'medium';
  return 'poor';
}

/**
 * Analyze checkpoint scores (CP1 or CP2)
 * @param cls - Class data
 * @param sessionIndex - 0-indexed session number (CP1=4, CP2=8)
 */
function analyzeCheckpoint(cls: Class, sessionIndex: number): CheckpointAnalysis {
  const slots = (cls.slots ?? [])
    .filter(s => s.date || s.startTime)
    .sort((a, b) => {
      const aTime = a.startTime || a.date;
      const bTime = b.startTime || b.date;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

  const cpSlot = slots[sessionIndex];
  
  if (!cpSlot) {
    return {
      classId: cls.id,
      sessionIndex,
      sessionDate: null,
      hasSession: false,
      studentsWithScores: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
      averageScore: null,
      minScore: null,
      maxScore: null,
      excellentCount: 0,
      goodCount: 0,
      averageCount: 0,
      poorCount: 0,
      students: [],
      issueType: 'missing_session',
      missingScoreCount: 0
    };
  }

  const students = (cpSlot.studentAttendance ?? []).filter(Boolean);
  
  if (students.length === 0) {
    return {
      classId: cls.id,
      sessionIndex,
      sessionDate: cpSlot.startTime || cpSlot.date,
      hasSession: true,
      studentsWithScores: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
      averageScore: null,
      minScore: null,
      maxScore: null,
      excellentCount: 0,
      goodCount: 0,
      averageCount: 0,
      poorCount: 0,
      students: [],
      issueType: 'no_students',
      missingScoreCount: 0
    };
  }

  const studentScores: StudentCheckpointScore[] = [];
  const validScores: number[] = [];
  let missingScoreCount = 0;

  for (const attendance of students) {
    const commentContent = getStudentAttendanceCommentContent(attendance);
    const theory = parseScoreByLabel(commentContent, 'Điểm lý thuyết');
    const practice = parseScoreByLabel(commentContent, 'Điểm thực hành');
    const ability = parseScoreByLabel(commentContent, 'Điểm năng lực');
    const cpScore = computeCpScore(theory, practice, ability);
    
    const studentScore: StudentCheckpointScore = {
      studentId: attendance.student?.id || '',
      studentName: attendance.student?.fullName || '',
      attendanceStatus: attendance.status || '',
      theoryScore: theory,
      practiceScore: practice,
      abilityScore: ability,
      checkpointScore: cpScore,
      isPassed: cpScore !== null && cpScore >= 3.5,
      qualityBand: getCheckpointQualityBand(cpScore),
      comment: commentContent
    };

    studentScores.push(studentScore);

    if (cpScore !== null) {
      validScores.push(cpScore);
    } else {
      missingScoreCount++;
    }
  }

  const passCount = validScores.filter(s => s >= 3.5).length;
  const failCount = validScores.filter(s => s < 3.5).length;
  const excellentCount = validScores.filter(s => s >= 4).length;
  const goodCount = validScores.filter(s => s >= 3.5 && s < 4).length;
  const averageCount = validScores.filter(s => s >= 3 && s < 3.5).length;
  const poorCount = validScores.filter(s => s < 3).length;

  const averageScore = validScores.length > 0
    ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length
    : null;

  return {
    classId: cls.id,
    sessionIndex,
    sessionDate: cpSlot.startTime || cpSlot.date,
    hasSession: true,
    studentsWithScores: validScores.length,
    passCount,
    failCount,
    passRate: validScores.length > 0 ? (passCount / validScores.length) * 100 : 0,
    averageScore,
    minScore: validScores.length > 0 ? Math.min(...validScores) : null,
    maxScore: validScores.length > 0 ? Math.max(...validScores) : null,
    excellentCount,
    goodCount,
    averageCount,
    poorCount,
    students: studentScores,
    issueType: missingScoreCount > 0 ? 'partial_scores' : null,
    missingScoreCount
  };
}

/**
 * Compute Demo score from product score and ability score
 * Formula: DEMO = 0.6 * productScore + 0.4 * ability
 */
function computeDemoScore(productScore: number | null, ability: number | null): number | null {
  if (productScore === null || ability === null) {
    return null;
  }
  return 0.6 * productScore + 0.4 * ability;
}

/**
 * Analyze demo scores (final session, usually session 14)
 */
function analyzeDemo(cls: Class, sessionIndex: number = 13): CheckpointAnalysis {
  const slots = (cls.slots ?? [])
    .filter(s => s.date || s.startTime)
    .sort((a, b) => {
      const aTime = a.startTime || a.date;
      const bTime = b.startTime || b.date;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

  const demoSlot = slots[sessionIndex];
  
  if (!demoSlot) {
    return {
      classId: cls.id,
      sessionIndex,
      sessionDate: null,
      hasSession: false,
      studentsWithScores: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
      averageScore: null,
      minScore: null,
      maxScore: null,
      excellentCount: 0,
      goodCount: 0,
      averageCount: 0,
      poorCount: 0,
      students: [],
      issueType: 'missing_session',
      missingScoreCount: 0
    };
  }

  const students = (demoSlot.studentAttendance ?? []).filter(Boolean);
  
  if (students.length === 0) {
    return {
      classId: cls.id,
      sessionIndex,
      sessionDate: demoSlot.startTime || demoSlot.date,
      hasSession: true,
      studentsWithScores: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
      averageScore: null,
      minScore: null,
      maxScore: null,
      excellentCount: 0,
      goodCount: 0,
      averageCount: 0,
      poorCount: 0,
      students: [],
      issueType: 'no_students',
      missingScoreCount: 0
    };
  }

  const studentScores: StudentDemoScore[] = [];
  const validScores: number[] = [];
  let missingScoreCount = 0;

  for (const attendance of students) {
    // Parse Demo score directly (matches reference script)
    const commentContent = getStudentAttendanceCommentContent(attendance);
    const demoScore = parseScoreByLabel(commentContent, 'Điểm Demo');
    
    // For backward compatibility, also try old label if not found
    const productScore = demoScore !== null ? null : parseScoreByLabel(commentContent, 'Điểm sản phẩm cuối khoá');
    const ability = parseScoreByLabel(commentContent, 'Điểm năng lực');
    
    // Use direct demo score if available, otherwise compute from product + ability
    const finalDemoScore = demoScore !== null ? demoScore : computeDemoScore(productScore, ability);
    
    const studentScore: StudentDemoScore = {
      studentId: attendance.student?.id || '',
      studentName: attendance.student?.fullName || '',
      attendanceStatus: attendance.status || '',
      productScore,
      abilityScore: ability,
      demoScore: finalDemoScore,
      qualityBand: getDemoQualityBand(finalDemoScore),
      comment: commentContent
    };

    studentScores.push(studentScore);

    if (finalDemoScore !== null) {
      validScores.push(finalDemoScore);
    } else {
      missingScoreCount++;
    }
  }

  const goodCount = validScores.filter(s => s >= 4).length;
  const mediumCount = validScores.filter(s => s >= 3 && s < 4).length;
  const poorCount = validScores.filter(s => s < 3).length;
  const passCount = validScores.filter(s => s >= 3).length; // Pass threshold for demo is 3

  const averageScore = validScores.length > 0
    ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length
    : null;

  return {
    classId: cls.id,
    sessionIndex,
    sessionDate: demoSlot.startTime || demoSlot.date,
    hasSession: true,
    studentsWithScores: validScores.length,
    passCount,
    failCount: validScores.length - passCount,
    passRate: validScores.length > 0 ? (passCount / validScores.length) * 100 : 0,
    averageScore,
    minScore: validScores.length > 0 ? Math.min(...validScores) : null,
    maxScore: validScores.length > 0 ? Math.max(...validScores) : null,
    excellentCount: goodCount, // For demo, "excellent" = good (>=4)
    goodCount,
    averageCount: mediumCount,
    poorCount,
    students: studentScores,
    issueType: missingScoreCount > 0 ? 'partial_scores' : null,
    missingScoreCount
  };
}

export function analyzeClassQuality(cls: Class, exemptSessions?: number[]): AnalyzedClassForQuality {
  const cp1Analysis = analyzeCheckpoint(cls, 4); // Session 5 (0-indexed = 4)
  const cp2Analysis = analyzeCheckpoint(cls, 8); // Session 9 (0-indexed = 8)
  const demoAnalysis = analyzeDemo(cls, 13); // Session 14 (0-indexed = 13)
  
  // Calculate TBCK and rank for each demo student
  // by combining their CP1, CP2, and Demo scores
  const enrichedDemoStudents = demoAnalysis.students.map((demoStudent: any) => {
    // Find this student's CP scores
    const cp1Student = cp1Analysis.students.find((s: any) => s.studentId === demoStudent.studentId) as any;
    const cp2Student = cp2Analysis.students.find((s: any) => s.studentId === demoStudent.studentId) as any;
    
    const cp1Score = cp1Student?.checkpointScore ?? null;
    const cp2Score = cp2Student?.checkpointScore ?? null;
    const demoScore = demoStudent.demoScore;
    
    // Calculate TBCK
    const tbck = computeTBCK(cp1Score, cp2Score, demoScore);
    const { rank } = determineRank(tbck, demoScore);
    
    return {
      ...demoStudent,
      tbck,
      rank,
    };
  });
  
  return {
    cls,
    courseLineName: getCourseCategory(cls),
    commentAnalysis: analyzeComments(cls, exemptSessions),
    attendanceAnalysis: analyzeAttendance(cls),
    reschedulingAnalysis: analyzeSessionRescheduling(cls),
    cp1Analysis,
    cp2Analysis,
    demoAnalysis: {
      ...demoAnalysis,
      students: enrichedDemoStudents,
    },
  };
}
// Extracted reusable logic
// Improved calculations
