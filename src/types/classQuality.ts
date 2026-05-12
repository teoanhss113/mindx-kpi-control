import { Class } from './classes';
import type { ParsedArea, TemplateMatch } from '@/lib/commentContent';

export type CommentStatus = 'ok' | 'empty' | 'brief' | 'duplicate_self' | 'duplicate_other' | 'template_exact' | 'template_modified' | 'overdue';

export type AttendanceAlert = 'frequent_absent' | 'consecutive_absent' | 'late_stage_absent';

export interface StudentCommentStatus {
  studentId: string;
  studentName: string;
  totalCommentsExpected: number;
  emptyCount: number;
  briefCount: number;
  duplicateCount: number;
  overdueCount: number;
  okCount: number;
  comments: {
    date: string;
    sessionIndex: number;
    teacherName: string;
    text: string;
    status: CommentStatus;
    templateMatch?: TemplateMatch;
    isOverdue: boolean;
    overdueHours?: number;
    parsedAreas?: ParsedArea[];
  }[];
}

export interface ClassCommentAnalysis {
  classId: string;
  passedSlots: number;
  totalSlots: number;
  emptyCount: number;
  briefCount: number;
  duplicateCount: number;
  overdueCount: number;
  okCount: number;
  students: StudentCommentStatus[];
}

export interface StudentAttendanceAnalysis {
  studentId: string;
  studentName: string;
  alerts: AttendanceAlert[];
  absentCount: number;
  consecutiveAbsentCount: number;
  lateStageAbsentCount: number;
  totalSlots: number;
  sessions: { date: string; status: string; isLateStage: boolean }[];
}

export interface ClassAttendanceAnalysis {
  classId: string;
  totalStudents: number;
  totalAlerts: number;
  studentsWithAlerts: StudentAttendanceAnalysis[];
}

export interface SessionReschedulingAnalysis {
  classId: string;
  totalSessions: number;
  rescheduledSessions: number;
  classType: 'regular' | 'intensive'; // regular: ~1 session/week, intensive: multiple sessions/week
  averageDaysBetweenSessions: number;
  sessions: {
    sessionIndex: number;
    date: string;
    daysSincePrevious: number | null;
    isRescheduled: boolean;
    reschedulingType: 'early' | 'late' | 'normal' | null; // early: < expected, late: > expected
    expectedDays: number;
    deviation: number; // days difference from expected
  }[];
}

export interface StudentCheckpointScore {
  studentId: string;
  studentName: string;
  attendanceStatus: string;
  theoryScore: number | null;
  practiceScore: number | null;
  abilityScore: number | null;
  checkpointScore: number | null; // CP = 0.4 * (theory + practice)/2 + 0.6 * ability (or 100% ability if no tests)
  isPassed: boolean; // >= 3.5
  qualityBand: 'excellent' | 'good' | 'average' | 'poor' | null; // >=4, >=3.5, >=3, <3
  comment: string;
}

export interface StudentDemoScore {
  studentId: string;
  studentName: string;
  attendanceStatus: string;
  productScore?: number | null; // Điểm sản phẩm cuối khoá
  abilityScore?: number | null;  // Điểm năng lực
  demoScore: number | null; // DEMO = 0.6 * productScore + 0.4 * ability (or direct "Điểm Demo")
  qualityBand: 'good' | 'medium' | 'poor' | null; // >=4, >=3, <3
  comment: string;
  // TBCK fields (calculated when CP1, CP2, Demo are available)
  tbck?: number | null; // TBCK = 0.4 * (CP1+CP2)/2 + 0.6 * Demo
  rank?: 'A' | 'B' | 'C' | 'D' | null; // Rank based on TBCK and Demo
}

export interface CheckpointAnalysis {
  classId: string;
  sessionIndex: number; // 0-indexed (CP1=4, CP2=8, Demo=13)
  sessionDate: string | null;
  hasSession: boolean;
  studentsWithScores: number;
  passCount: number; // >= 3.5 for CP, >= 3 for Demo
  failCount: number;
  passRate: number; // percentage
  averageScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  excellentCount: number; // >= 4
  goodCount: number; // >= 3.5 (CP) or >= 4 (Demo)
  averageCount: number; // >= 3
  poorCount: number; // < 3
  students: (StudentCheckpointScore | StudentDemoScore)[];
  issueType: 'missing_session' | 'no_students' | 'partial_scores' | null;
  missingScoreCount: number;
}

export interface AnalyzedClassForQuality {
  cls: Class;
  courseLineName: string;
  commentAnalysis: ClassCommentAnalysis;
  attendanceAnalysis: ClassAttendanceAnalysis;
  reschedulingAnalysis: SessionReschedulingAnalysis;
  cp1Analysis: CheckpointAnalysis;
  cp2Analysis: CheckpointAnalysis;
  demoAnalysis: CheckpointAnalysis;
}
