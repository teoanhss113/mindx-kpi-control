/**
 * Course Category Utilities
 * Centralized logic for categorizing courses into: Coding, Robotics, Art, Others
 * 
 * Used across all pages for consistent course categorization
 */

import { COURSES, type Course } from '@/constants';

/**
 * Categorize a class into one of the main course categories
 * Based on courseLine name, course name, and class name
 * 
 * @param cls - Class object with course.courseLine.name, course.name, and name
 * @returns 'Coding' | 'Robotics' | 'Art' | 'Others'
 */
export function getCourseCategory(cls: {
  course?: {
    courseLine?: { name?: string };
    name?: string;
  };
  name?: string;
}): Course {
  const line = (cls.course?.courseLine?.name || '').toUpperCase();
  const name = (cls.course?.name || '').toUpperCase();
  const cName = (cls.name || '').toUpperCase();
  const combined = `${line} ${name} ${cName}`;

  // Special cases first (THT, FLL → Others)
  if (combined.includes('THT') || combined.includes('FLL')) return 'Others';
  
  // Robotics
  if (combined.includes('ROB')) return 'Robotics';
  
  // Art
  if (combined.includes('ART') || combined.includes('XART')) return 'Art';
  
  // Coding (most patterns)
  if (
    combined.includes('C4K') || combined.includes('C4T') || 
    combined.includes('JSA') || combined.includes('JSI') || combined.includes('JSB') ||
    combined.includes('PYA') || combined.includes('WEB') || 
    combined.includes('GAME') || combined.includes('PRO') || 
    combined.includes('CODING') || combined.includes('PYTHON') || 
    combined.includes('CSB') || combined.includes('CSI')
  ) return 'Coding';

  return 'Others';
}

/**
 * Categorize by courseLine and className (for teacher schedule)
 * Simpler version that only checks courseLine and className
 * 
 * @param courseLine - Course line name
 * @param className - Class name (fallback if courseLine not available)
 * @returns 'Coding' | 'Robotics' | 'Art' | 'Others'
 */
export function getCourseLineCategory(
  courseLine?: string, 
  className?: string
): Course {
  // Check courseLine first
  if (courseLine) {
    const line = courseLine.toUpperCase();
    if (line.match(/C4K|C4T|JSA|JSI|JSB|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI/)) return 'Coding';
    if (line.includes('ROB')) return 'Robotics';
    if (line.includes('ART') || line.includes('XART')) return 'Art';
  }
  
  // Fallback to className if courseLine is not available
  if (className) {
    const name = className.toUpperCase();
    if (name.match(/C4K|C4T|JSA|JSI|JSB|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI/)) return 'Coding';
    if (name.includes('ROB')) return 'Robotics';
    if (name.includes('ART') || name.includes('XART')) return 'Art';
  }
  
  return 'Others';
}

/**
 * Categorize office hour into Coding / Robotics / Art / Others.
 *
 * Looks at every textual signal available — courseLines, courses (shortName +
 * name), and class name — because a single source can be missing or
 * inconsistently filled (e.g. courseLines empty while courses contains
 * "C4K-SB"). All sources are merged into one uppercase string and matched
 * against keyword sets.
 *
 * Priority: Robotics > Art > Coding > Others. Higher-priority categories win
 * when multiple keyword sets match (e.g. a robotics class whose description
 * also mentions "Coding"). THT/FLL are explicit exceptions that fall through
 * to "Others" even though they may co-occur with ROB/Coding tokens.
 *
 * Backward compatible: accepts either an OfficeHour-like object or just the
 * legacy `courseLines` array.
 */
export function getOfficeHourCategory(
  input:
    | { name?: string }[]
    | {
        courseLines?: { name?: string }[];
        courses?: { shortName?: string; name?: string }[];
        class?: { name?: string } | null;
      },
): Course {
  // Build combined uppercase haystack from every text source available.
  let haystack = '';
  if (Array.isArray(input)) {
    haystack = input.map(cl => cl?.name || '').join(' ');
  } else {
    const lines = (input.courseLines || []).map(cl => cl?.name || '').join(' ');
    const courses = (input.courses || [])
      .map(c => `${c?.shortName || ''} ${c?.name || ''}`)
      .join(' ');
    const cls = input.class?.name || '';
    haystack = `${lines} ${courses} ${cls}`;
  }
  haystack = haystack.toUpperCase();
  if (!haystack.trim()) return 'Others';

  // Explicit "Others" overrides — these are STEM-adjacent classes that
  // should not be lumped into Coding/Robotics.
  if (/\bTHT\b|\bFLL\b/.test(haystack)) return 'Others';

  // Robotics first — covers ROB, ROBO, ROBOTICS, ROBONIX, etc.
  if (/\bROB/.test(haystack)) return 'Robotics';

  // Art — XART contains ART, but match XART explicitly first for clarity.
  if (/\bXART|\bART\b/.test(haystack)) return 'Art';

  // Coding — broad token set covering MindX product codes.
  if (/C4K|C4T|JSA|JSI|JSB|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI/.test(haystack)) {
    return 'Coding';
  }

  return 'Others';
}

/**
 * Get all available course categories
 * @returns Array of course categories
 */
export function getAllCourseCategories(): readonly Course[] {
  return COURSES;
}
// Updated admin utilities
// Reduced memory usage
