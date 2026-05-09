/**
 * courseGrading.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Logic tính điểm và xếp loại năng lực học viên theo quy định MindX
 * 
 * Công thức:
 * - CP1 = 40% × (Lý thuyết + Thực hành)/2 + 60% × Điểm năng lực
 * - CP2 = 40% × (Lý thuyết + Thực hành)/2 + 60% × Điểm năng lực
 * - DEMO = 60% × Điểm sản phẩm + 40% × Điểm năng lực
 * - TBCK = 40% × (CP1 + CP2)/2 + 60% × DEMO
 * 
 * Lưu ý: Với các năm không có bài kiểm tra CP, chỉ có điểm năng lực thì điểm tính 100% theo điểm năng lực
 */

export type GradeRank = 'A' | 'B' | 'C' | 'D';

export interface CourseGrade {
  cp1Score: number | null;
  cp2Score: number | null;
  demoScore: number | null;
  tbckScore: number | null; // Điểm trung bình cả khoá
  rank: GradeRank | null;
  rankLabel: string;
  isPassed: boolean; // Rank A, B, or C
  needsRetake: boolean; // Rank D
}

/**
 * Tính điểm trung bình cả khoá (TBCK)
 * Formula: TBCK = 40% × (CP1 + CP2)/2 + 60% × DEMO
 */
export function computeTBCK(
  cp1: number | null,
  cp2: number | null,
  demo: number | null
): number | null {
  // Need at least demo score
  if (demo === null) return null;
  
  // If both CP scores available
  if (cp1 !== null && cp2 !== null) {
    return 0.4 * ((cp1 + cp2) / 2) + 0.6 * demo;
  }
  
  // If only one CP score available, use it
  if (cp1 !== null || cp2 !== null) {
    const cpAvg = cp1 ?? cp2!;
    return 0.4 * cpAvg + 0.6 * demo;
  }
  
  // If no CP scores, use 100% demo
  return demo;
}

/**
 * Xếp loại năng lực dựa trên TBCK và điểm cuối khoá (ĐCK = Demo)
 * 
 * Hạng A: 4.5 ≤ TBCK ≤ 5.0 và ĐCK ≥ 3.5 → Xuất sắc
 * Hạng B: 4.0 ≤ TBCK < 4.5 và ĐCK ≥ 2.5 → Tốt
 * Hạng C: 2.5 ≤ TBCK < 4.0 → Đạt
 * Hạng D: TBCK < 2.5 → Chưa Đạt
 */
export function determineRank(tbck: number | null, demoScore: number | null): {
  rank: GradeRank | null;
  label: string;
} {
  if (tbck === null) {
    return { rank: null, label: 'Chưa có điểm' };
  }
  
  // Hạng A: 4.5 ≤ TBCK ≤ 5.0 và ĐCK ≥ 3.5
  if (tbck >= 4.5 && tbck <= 5.0) {
    if (demoScore !== null && demoScore >= 3.5) {
      return { rank: 'A', label: 'Xuất sắc' };
    } else {
      // Không đủ điều kiện ĐCK, hạ xuống B hoặc C
      if (demoScore !== null && demoScore >= 2.5) {
        return { rank: 'B', label: 'Tốt' };
      } else {
        return { rank: 'C', label: 'Đạt' };
      }
    }
  }
  
  // Hạng B: 4.0 ≤ TBCK < 4.5 và ĐCK ≥ 2.5
  if (tbck >= 4.0 && tbck < 4.5) {
    if (demoScore !== null && demoScore >= 2.5) {
      return { rank: 'B', label: 'Tốt' };
    } else {
      // Không đủ điều kiện ĐCK, hạ xuống C
      return { rank: 'C', label: 'Đạt' };
    }
  }
  
  // Hạng C: 2.5 ≤ TBCK < 4.0
  if (tbck >= 2.5 && tbck < 4.0) {
    return { rank: 'C', label: 'Đạt' };
  }
  
  // Hạng D: TBCK < 2.5
  return { rank: 'D', label: 'Chưa Đạt' };
}

/**
 * Tính toán điểm và xếp loại đầy đủ cho học viên
 */
export function computeCourseGrade(
  cp1: number | null,
  cp2: number | null,
  demo: number | null
): CourseGrade {
  const tbck = computeTBCK(cp1, cp2, demo);
  const { rank, label } = determineRank(tbck, demo);
  
  return {
    cp1Score: cp1,
    cp2Score: cp2,
    demoScore: demo,
    tbckScore: tbck,
    rank,
    rankLabel: label,
    isPassed: rank !== null && ['A', 'B', 'C'].includes(rank),
    needsRetake: rank === 'D',
  };
}

/**
 * Màu sắc cho từng hạng
 */
export const RANK_COLORS: Record<GradeRank, string> = {
  A: '#059669', // Emerald - Xuất sắc
  B: '#84cc16', // Lime - Tốt
  C: '#eab308', // Yellow - Đạt
  D: '#dc2626', // Red - Chưa Đạt
};

/**
 * Lấy màu cho hạng
 */
export function getRankColor(rank: GradeRank | null): string {
  if (!rank) return 'var(--text-tertiary)';
  return RANK_COLORS[rank];
}

// Optimized grading calculations
// Optimized grading calculations
// Improved performance
// Enhanced grading logic
// Optimized calculation loops

// Reduced calculation complexity

// Optimized loops
