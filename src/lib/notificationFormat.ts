/**
 * Shared notification formatting helpers.
 * Safe to import from both client (sendNotification.ts) and server (notificationService.ts).
 */

export interface OHInfo {
  id?: string;
  startTime?: string;
  endTime?: string;
  centreId?: string;
  centreName?: string;
  courses?: string[];
  type?: string;
}

const DOW_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export const OFFICE_HOUR_TYPE_LABELS: Record<string, string> = {
  Office: 'Trực tại cơ sở',
  Trial: 'Trực trực tuyến',
  Event: 'Sự kiện',
  Makeup: 'Bù học',
  Tutor: 'Dạy kèm',
  Fixed: 'Trực tại cơ sở',
};

export function getOfficeHourTypeLabel(type: string | null | undefined): string {
  return OFFICE_HOUR_TYPE_LABELS[type || ''] || type || '—';
}

function sessionLabel(endIso: string): string {
  const h = parseInt(
    new Intl.DateTimeFormat('vi-VN', { hour: 'numeric', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).format(new Date(endIso)),
    10,
  );
  if (h <= 12) return 'Sáng';
  if (h <= 18) return 'Chiều';
  return 'Tối';
}

/**
 * Format an office-hour into a compact readable label, e.g.:
 * "Thứ 3 14/05 Chiều 14:00–16:00 · Hà Nội 1 · C4K-SB, C4T-VA"
 */
export function formatOHLabel(info?: OHInfo): string {
  if (!info) return '';
  const parts: string[] = [];

  if (info.startTime) {
    try {
      const fmtTime = (iso: string) =>
        new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit', minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
        }).format(new Date(iso));

      const vnDate = new Date(new Date(info.startTime).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const dow = DOW_VI[vnDate.getDay()];
      const ddmm = `${String(vnDate.getDate()).padStart(2, '0')}/${String(vnDate.getMonth() + 1).padStart(2, '0')}`;
      const session = info.endTime ? sessionLabel(info.endTime) : '';
      const timeRange = info.endTime
        ? `${fmtTime(info.startTime)}–${fmtTime(info.endTime)}`
        : fmtTime(info.startTime);

      parts.push(`${dow} ${ddmm} ${session} ${timeRange}`.trim());
    } catch { /* ignore invalid dates */ }
  }

  if (info.centreName) parts.push(info.centreName);
  if (info.courses?.length) parts.push(info.courses.slice(0, 2).join(', '));

  return parts.join(' · ');
}
