import type { StudentAttendance } from '@/types/classes';

export function stripCommentHtml(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getStudentAttendanceCommentContent(attendance: Pick<StudentAttendance, 'comment' | 'commentByAreas'> | null | undefined): string {
  const areaContents = (attendance?.commentByAreas || [])
    .map(area => area?.content || '')
    .map(stripCommentHtml)
    .filter(Boolean);

  const mainComment = stripCommentHtml(attendance?.comment || '');
  
  // Combine all contents to ensure we don't miss anything. 
  // Order: Areas first, then the main comment.
  return [...areaContents, mainComment].join('\n').trim();
}
