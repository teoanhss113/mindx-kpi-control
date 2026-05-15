/**
 * kpiScoring.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all KPI scoring logic, colors, and legend labels.
 *
 * Score levels (1–5):
 *   5 → Xuất sắc  #059669  (Emerald)
 *   4 → Tốt       #84cc16  (Lime)
 *   3 → Trung bình #d97706  (Amber)
 *   2 → Yếu       #f97316  (Orange)
 *   1 → Kém       #dc2626  (Red)
 */

// ─── Color palette ────────────────────────────────────────────────────────────

export const KPI_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '#059669', // Emerald — Xuất sắc
  4: '#84cc16', // Lime    — Tốt
  3: '#d97706', // Amber   — Trung bình
  2: '#f97316', // Orange  — Yếu
  1: '#dc2626', // Red     — Kém
};

/** Return the hex color string for a given score level. */
export const kpiColor = (score: 1 | 2 | 3 | 4 | 5): string => KPI_COLORS[score];

// ─── Legend labels ────────────────────────────────────────────────────────────

/** Legend items for Completion Rate charts. Ordered score 5→1. */
export const COMPLETION_LEGEND = [
  { score: 5 as const, label: '> 95%' },
  { score: 4 as const, label: '91–95%' },
  { score: 3 as const, label: '86–90%' },
  { score: 2 as const, label: '80–85%' },
  { score: 1 as const, label: '< 80%' },
];

/** Legend items for Teacher Change Rate charts. Ordered score 5→1. */
export const TEACHER_CHANGE_LEGEND = [
  { score: 5 as const, label: '0–1%' },
  { score: 4 as const, label: '1–3%' },
  { score: 3 as const, label: '3–5%' },
  { score: 2 as const, label: '5–7%' },
  { score: 1 as const, label: '> 7%' },
];

/** Legend items for Survey Score charts. Ordered score 5→1. */
export const SURVEY_LEGEND = [
  { score: 5 as const, label: '> 4.7' },
  { score: 4 as const, label: '4.5–4.7' },
  { score: 3 as const, label: '4.0–4.4' },
  { score: 2 as const, label: '3.5–3.9' },
  { score: 1 as const, label: '< 3.5' },
];

/** Legend items for Teacher Survey collection rate charts/cards. Ordered score 5→1. */
export const TEACHER_POINT_LEGEND = [
  { score: 5 as const, label: '≥ 95%' },
  { score: 4 as const, label: '81–94%' },
  { score: 3 as const, label: '71–80%' },
  { score: 2 as const, label: '51–70%' },
  { score: 1 as const, label: '≤ 50%' },
];

/** Legend items for Conversion Rate (Trial → Paid) charts. Ordered score 5→1. */
export const CONVERSION_LEGEND = [
  { score: 5 as const, label: '> 40%' },
  { score: 4 as const, label: '31–40%' },
  { score: 3 as const, label: '26–30%' },
  { score: 2 as const, label: '15–25%' },
  { score: 1 as const, label: '< 15%' },
];

// ─── Scoring functions ────────────────────────────────────────────────────────

/**
 * Completion Rate KPI (Tỷ lệ Hoàn thành)
 *   > 95%    → 5
 *   91–95%   → 4
 *   86–90%   → 3
 *   80–85%   → 2
 *   < 80%    → 1
 */
export function completionScore(rate: number): 1 | 2 | 3 | 4 | 5 {
  if (rate > 95) return 5;
  if (rate >= 91) return 4;
  if (rate >= 86) return 3;
  if (rate >= 80) return 2;
  return 1;
}

/**
 * Teacher Change Rate KPI (Tỷ lệ thay đổi Giáo viên)
 *   0–1%  → 5
 *   1–3%  → 4
 *   3–5%  → 3
 *   5–7%  → 2
 *   > 7%  → 1
 */
export function teacherChangeScore(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct <= 1) return 5;
  if (pct <= 3) return 4;
  if (pct <= 5) return 3;
  if (pct <= 7) return 2;
  return 1;
}

/**
 * Multi-teacher rate KPI (Tỷ lệ lớp có ≥3 giáo viên)
 *   0%       → 5
 *   0–0.5%   → 4
 *   0.5–1%   → 3
 *   1–1.5%   → 2
 *   > 1.5%   → 1
 */
export function multiTeacherScore(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct === 0) return 5;
  if (pct <= 0.5) return 4;
  if (pct <= 1) return 3;
  if (pct <= 1.5) return 2;
  return 1;
}

/**
 * Survey Score KPI (Điểm Khảo sát)
 *   > 4.7    → 5
 *   4.5–4.7  → 4
 *   4.0–4.4  → 3
 *   3.5–3.9  → 2
 *   < 3.5    → 1
 */
export function surveyScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score > 4.7) return 5;
  if (score >= 4.5) return 4;
  if (score >= 4.0) return 3;
  if (score >= 3.5) return 2;
  return 1;
}

/**
 * Teacher Survey collection rate KPI (Tỷ lệ lấy Khảo sát Giáo viên)
 *   ≥ 95%   → 5
 *   81–94%  → 4
 *   71–80%  → 3
 *   51–70%  → 2
 *   ≤ 50%   → 1
 */
export function teacherPointScore(rate: number): 1 | 2 | 3 | 4 | 5 {
  if (rate >= 95) return 5;
  if (rate >= 81) return 4;
  if (rate >= 71) return 3;
  if (rate >= 51) return 2;
  return 1;
}

/**
 * Conversion Rate KPI (Tỷ lệ chuyển đổi học viên trải nghiệm)
 *   > 40%    → 5
 *   31–40%   → 4
 *   26–30%   → 3
 *   15–25%   → 2
 *   < 15%    → 1
 */
export function conversionScore(rate: number): 1 | 2 | 3 | 4 | 5 {
  if (rate > 40) return 5;
  if (rate >= 31) return 4;
  if (rate >= 26) return 3;
  if (rate >= 15) return 2;
  return 1;
}

// ─── Convenience color helpers ────────────────────────────────────────────────

/** Color for a Completion Rate value (0–100). */
export const completionColor = (rate: number): string =>
  kpiColor(completionScore(rate));

/** Color for a Teacher Change Rate value (0–100). */
export const teacherChangeColor = (pct: number): string =>
  kpiColor(teacherChangeScore(pct));

/** Color for a Survey Score value (0–5). */
export const surveyColor = (score: number): string =>
  kpiColor(surveyScore(score));

/** Color for a Teacher Survey collection rate value (0–100). */
export const teacherPointColor = (rate: number): string =>
  kpiColor(teacherPointScore(rate));

/** Color for a Conversion Rate value (0–100). */
export const conversionColor = (rate: number): string =>
  kpiColor(conversionScore(rate));

// Optimized scoring logic
// Optimized scoring logic
// Optimized calculation algorithms

// Optimized scoring algorithms

// Optimized calculations
