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

  if (areaContents.length > 0) return areaContents.join('\n');
  return stripCommentHtml(attendance?.comment || '');
}
