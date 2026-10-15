import { useMemo } from 'react';
import { getRepeatedTrialMatches, type RepeatedTrialAnalysis } from '@/lib/repeatedTrialStudents';
import { RawStatusBadge } from '@/components/ui';

function getTrialEvidenceLabel(status: string, resultAfterTrial?: {
  isTrialed?: boolean;
  isHasOrder?: boolean;
  isHasPayment?: boolean;
}) {
  const normalizedStatus = status?.trim().toUpperCase();
  if (resultAfterTrial?.isTrialed) return 'Kết quả sau học thử: Đã học thử';
  if (normalizedStatus === 'WAITING' || normalizedStatus === 'PENDING') {
    return `Lịch hẹn ${normalizedStatus}: đang chờ xác nhận, chưa có kết quả sau học thử`;
  }
  if (!resultAfterTrial) {
    return `Lịch hẹn ${normalizedStatus || 'chưa rõ trạng thái'}: chưa có kết quả sau học thử`;
  }
  if (resultAfterTrial.isHasPayment) {
    return 'Có thanh toán nhưng chưa đánh dấu Đã học thử';
  }
  if (resultAfterTrial.isHasOrder) {
    return 'Có đơn hàng nhưng chưa đánh dấu Đã học thử';
  }
  return 'Kết quả sau học thử đã có nhưng chưa đánh dấu Đã học thử';
}

export function RepeatedTrialHistory({ analysis, officeHourId, appointmentId }: {
  analysis: RepeatedTrialAnalysis;
  officeHourId: string;
  appointmentId: string;
}) {
  const matches = useMemo(() => getRepeatedTrialMatches(analysis, officeHourId, appointmentId),
    [analysis, officeHourId, appointmentId]);
  if (!matches.length) return null;
  const sessionCount = new Set(matches.map(item => item.officeHourId)).size;
  return (
    <details style={{ margin: '6px 0', padding: 8, borderRadius: 'var(--radius-comfortable)',
      border: '1px solid var(--border-secondary)', background: 'var(--bg-elevated)', fontSize: 12 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--status-warning)', fontWeight: 600 }}>
        Nghi trùng ở {sessionCount} ca khác · Xem lịch sử
      </summary>
      <div style={{ marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Cần đối soát tên và thông tin liên hệ; có thể trùng tên hoặc dùng chung liên hệ phụ huynh.
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto' }}>
        {matches.map(item => (
          <li key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{item.appointment.candidate?.fullName || 'Không rõ tên'}</strong>
            <div>{item.reasons.join(' · ')}</div>
            {item.appointmentCourseNames.length > 0 && (
              <div>Khoá học lịch hẹn: <strong style={{ color: 'var(--text-primary)' }}>{item.appointmentCourseNames.join(', ')}</strong></div>
            )}
            <div>
              Khoá học của ca: <strong style={{ color: 'var(--text-primary)' }}>
                {item.sessionCourseNames.length > 0 ? item.sessionCourseNames.join(', ') : 'Chưa có'}
              </strong>
            </div>
            {(item.sessionCourseLineNames.length > 0 || item.sessionCourseTopicNames.length > 0) && (
              <div>
                {[...item.sessionCourseLineNames, ...item.sessionCourseTopicNames].join(' · ')}
              </div>
            )}
            <div>{item.appointment.candidate?.phoneNumber || 'Chưa có SĐT'}</div>
            {item.appointment.candidate?.email && <div>{item.appointment.candidate.email}</div>}
            {item.appointment.candidate?.dob && <div>Ngày sinh: {item.appointment.candidate.dob.date}/{item.appointment.candidate.dob.month}/{item.appointment.candidate.dob.year}</div>}
            <div>{new Date(item.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
            <div>{item.centreName} · {item.teacherName}</div>
            <div>Ca: <RawStatusBadge status={item.sessionStatus} /></div>
            <div>Lịch hẹn: <RawStatusBadge status={item.appointment.status} /></div>
            <div>{getTrialEvidenceLabel(item.appointment.status, item.appointment.resultAfterTrial)}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
