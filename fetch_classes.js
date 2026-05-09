#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'https://lms-api.mindx.edu.vn/';
const DEFAULT_PAGE_SIZE = 150;
const HARDCODED_AUTHORIZATION = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjVlODJhZmI0ZWY2OWI3NjM4MzA2OWFjNmI1N2U3ZTY1MjAzYmZlOTYiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiVEUgUGhhbiBOZ-G7jWMgSG_DoG5nIEFuaCIsImlkIjoiNWZmMjZiOWYzNzI5MjAwOTlkMjU4ODIzIiwidXNlcm5hbWUiOiJhbmhwbmgwMDEiLCJyb2xlcyI6WyI1ZmIzNzk4NTBkZGNjYTQ3OGU5M2RlZjgiXSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL21pbmR4LWVkdS1wcm9kIiwiYXVkIjoibWluZHgtZWR1LXByb2QiLCJhdXRoX3RpbWUiOjE3NzU0NDc4MTIsInVzZXJfaWQiOiJaakVuTW9ha3FZVE1mNUdOdkVXZEl1OXlPRGEyIiwic3ViIjoiWmpFbk1vYWtxWVRNZjVHTnZFV2RJdTl5T0RhMiIsImlhdCI6MTc3NTQ0NzgxMiwiZXhwIjoxNzc1NDUxNDEyLCJlbWFpbCI6ImFuaHBuaEBtaW5keC5jb20udm4iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfbnVtYmVyIjoiKzg0MzY2NzU0MzQyIiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhbmhwbmhAbWluZHguY29tLnZuIl0sInBob25lIjpbIis4NDM2Njc1NDM0MiJdfSwic2lnbl9pbl9wcm92aWRlciI6ImN1c3RvbSJ9fQ.WNP6crY-n_Hri2gAVc2y616JkXYUhmg5J5TvY0x3dT_cAAtNh7e36pGoQ7PHZC_hX_n-i1YtqAfKQ1pdxYHD10Q7MzwK5pHDzsqZ7I9ONVhyl33oj2DaK8MrAgyliOU4NiyeGuggygqszoJhFbUXcPYEGjnvV_-l2Tm-0RhuQbm65XtzyjAvz4HFc8CmSrwddbdzCyIETtp06safrq_TDTmTxBkbetUY4ILg2ffMUjDz6XQE7RfXMvglAN9eQ_51hEYVOOgvpl7HzH_XDsq86_aqje9PdsXn8Vo8DUMQtCcmx3E3hVsoqyevXMXi2F7t2oomuxmirI_Rt0OGkdQXvg';

const QUERY = `query GetClasses($search: String, $centre: String, $operationMethodId: [String], $openStatus: [String], $centres: [String], $courses: [String], $courseLines: [String], $startDateFrom: Date, $startDateTo: Date, $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date, $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String, $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String], $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $teacherId: String, $teacherSlot: [String], $passedSessionIndex: Int, $unpassedSessionIndex: Int, $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery) {
  classes(payload: {filter_textSearch: $search, centre_equals: $centre, centre_in: $centres, operationMethodId_in: $operationMethodId, teacher_equals: $teacherId, teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines, startDate_gt: $startDateFrom, startDate_lt: $startDateTo, endDate_gt: $endDateFrom, endDate_lt: $endDateTo, haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo, status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status, attendanceStatus_in: $attendanceStatus, studentAttendanceStatus_in: $studentAttendanceStatus, teacherAttendanceStatus_in: $teacherAttendanceStatus, attendanceChecked_exists: $attendanceCheckedExists, haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex, unpassedSessionIndex: $unpassedSessionIndex, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, comments: $comments, openStatus: $openStatus}) {
    data {
      id
      name
      level
      course {
        id
        name
        shortName
      }
      classSites {
        _id
        name
      }
      startDate
      endDate
      status
      centre {
        id
        name
        shortName
      }
      openingRoomNo
      numberOfSessions
      numberOfSessionsStatus
      sessionHour
      totalHour
      slots {
        _id
        date
        startTime
        endTime
        sessionHour
        summary
        homework
        teachers {
          _id
          teacher {
            id
            username
            code
            fullName
            email
            phoneNumber
            user
            imageUrl
          }
          role {
            id
            name
            shortName
          }
          isActive
        }
        teacherAttendance {
          _id
          teacher {
            id
            username
            code
            fullName
            email
            phoneNumber
            user
            imageUrl
          }
          status
          note
          createdBy
          createdAt
          lastModifiedBy
          lastModifiedAt
        }
        studentAttendance {
          _id
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
          }
          status
          comment
          sendCommentStatus
        }
      }
      students {
        _id
        student {
          id
          customer {
            fullName
            phoneNumber
            email
            facebook
            zalo
          }
        }
        note
        activeInClass
        createdBy
        createdAt
      }
      teachers {
        _id
        teacher {
          id
          username
          code
          fullName
          email
          phoneNumber
          user
          imageUrl
        }
        role {
          id
          name
          shortName
        }
        isActive
      }
      operator {
        id
        username
        firstName
        middleName
        lastName
      }
      operationMethod {
        id
        name
      }
      classOpeningPlanId
      hasSchedule
      createdBy
      createdAt
      lastModifiedBy
      lastModifiedAt
    }
    pagination {
      type
      total
    }
  }
}`;

function parseArgs(argv) {
  const options = {
    output: 'classes_demo.export.json',
    pageSize: DEFAULT_PAGE_SIZE,
    endDateFrom: '2026-02-28T17:00:00.000Z',
    endDateTo: '2026-03-31T16:59:59.999Z',
    statusIn: ['FINISHED'],
    authorization: process.env.LMS_AUTHORIZATION || HARDCODED_AUTHORIZATION,
    authFile: '',
  };

  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--output' && argv[index + 1]) {
      options.output = argv[++index];
    } else if (arg === '--page-size' && argv[index + 1]) {
      options.pageSize = Number(argv[++index]);
    } else if (arg === '--end-date-from' && argv[index + 1]) {
      options.endDateFrom = argv[++index];
    } else if (arg === '--end-date-to' && argv[index + 1]) {
      options.endDateTo = argv[++index];
    } else if (arg === '--status-in' && argv[index + 1]) {
      options.statusIn = argv[++index].split(',').map(value => value.trim()).filter(Boolean);
    } else if (arg === '--authorization' && argv[index + 1]) {
      options.authorization = argv[++index];
    } else if (arg === '--auth-file' && argv[index + 1]) {
      options.authFile = argv[++index];
    }
  }

  return options;
}

function stripTrailingJsonExtension(filePath) {
  if (/\.json$/i.test(filePath)) {
    return filePath.replace(/\.json$/i, '');
  }

  return filePath;
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(rows, headers) {
  const headerLine = headers.map(csvEscape).join(',');
  const lines = rows.map(row => headers.map(header => csvEscape(row[header])).join(','));
  return `${[headerLine, ...lines].join('\n')}\n`;
}

function toCsvWithColumns(rows, columns) {
  const headerLine = columns.map(column => csvEscape(column.header)).join(',');
  const lines = rows.map(row => columns.map(column => csvEscape(row[column.key])).join(','));
  return `${[headerLine, ...lines].join('\n')}\n`;
}

function toDateOnly(value) {
  if (!value) {
    return null;
  }

  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}

function daysBetween(start, end) {
  if (!start || !end) {
    return null;
  }

  return (toDateOnly(end) - toDateOnly(start)) / 86400000;
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseScoreByLabel(comment, label) {
  const text = cleanText(comment);
  const match = text.match(new RegExp(`${label}\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*điểm`, 'i'));
  return match ? Number.parseFloat(match[1]) : null;
}

function computeCpScore(theory, practice, ability) {
  if ([theory, practice, ability].some(value => typeof value !== 'number')) {
    return null;
  }

  return 0.2 * (theory + practice) + 0.6 * ability;
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTeacherSet(slot) {
  const teachers = (slot?.teachers || [])
    .filter(Boolean)
    .map(teacherRecord => teacherRecord.teacher?.id || teacherRecord.teacher?.username)
    .filter(Boolean)
    .sort();

  return teachers.join(',');
}

function summarizeClassMeta(classRecord) {
  return {
    classId: classRecord.id || '',
    className: classRecord.name || '',
    level: classRecord.level || '',
    courseName: classRecord.course?.name || '',
    courseShortName: classRecord.course?.shortName || '',
    centreName: classRecord.centre?.name || '',
    centreShortName: classRecord.centre?.shortName || '',
    status: classRecord.status || '',
    sessionCount: classRecord.numberOfSessions ?? '',
    sessionHour: classRecord.sessionHour ?? '',
    totalHour: classRecord.totalHour ?? '',
    hasSchedule: classRecord.hasSchedule ? 'true' : 'false',
  };
}

function buildCp2Analysis(classRecords) {
  const classRows = [];
  const studentRows = [];

  for (const classRecord of classRecords) {
    const slots = (classRecord.slots || []).filter(Boolean).slice().sort((left, right) => {
      const leftDate = toDateOnly(left.date);
      const rightDate = toDateOnly(right.date);
      return leftDate - rightDate;
    });

    const cpSlot = slots[8];
    const students = (cpSlot?.studentAttendance || []).filter(Boolean);
    const meta = summarizeClassMeta(classRecord);

    if (!cpSlot) {
      classRows.push({
        ...meta,
        cpStudentCount: 0,
        cpPassCount: 0,
        cpFailCount: 0,
        cpPassRate: '',
        cpAverage: '',
        cpMin: '',
        cpMax: '',
        cpGiỏiCount: 0,
        cpTrungBinhCount: 0,
        cpYeuCount: 0,
        issueType: 'Thiếu buổi 9',
        remark: 'Không có buổi 9',
      });
      continue;
    }

    if (!students.length) {
      classRows.push({
        ...meta,
        cpStudentCount: 0,
        cpPassCount: 0,
        cpFailCount: 0,
        cpPassRate: '',
        cpAverage: '',
        cpMin: '',
        cpMax: '',
        cpGiỏiCount: 0,
        cpTrungBinhCount: 0,
        cpYeuCount: 0,
        issueType: 'Buổi 9 không có học sinh',
        remark: 'Buổi 9 không có dữ liệu học sinh',
      });
      continue;
    }

    const scoredStudents = [];
    let missingCount = 0;

    for (const attendance of students) {
      const theory = parseScoreByLabel(attendance.comment, 'Điểm lý thuyết');
      const practice = parseScoreByLabel(attendance.comment, 'Điểm thực hành');
      const ability = parseScoreByLabel(attendance.comment, 'Điểm năng lực');
      const cp = computeCpScore(theory, practice, ability);

      studentRows.push({
        ...meta,
        cpDate: cpSlot.date || '',
        cpSlotId: cpSlot._id || '',
        studentId: attendance.student?.id || '',
        studentName: attendance.student?.fullName || '',
        attendanceStatus: attendance.status || '',
        theoryScore: theory === null ? '' : theory.toFixed(3),
        practiceScore: practice === null ? '' : practice.toFixed(3),
        abilityScore: ability === null ? '' : ability.toFixed(3),
        cpScore: cp === null ? '' : cp.toFixed(3),
        remark: cp === null ? 'Thiếu điểm hoặc lỗi định dạng nhận xét, không tính CP' : '',
      });

      if (cp === null) {
        missingCount += 1;
        continue;
      }

      scoredStudents.push(cp);
    }

    const passCount = scoredStudents.filter(value => value >= 3.5).length;
    const failCount = scoredStudents.filter(value => value < 3.5).length;

    classRows.push({
      ...meta,
      cpStudentCount: scoredStudents.length,
      cpPassCount: passCount,
      cpFailCount: failCount,
      cpPassRate: scoredStudents.length ? `${((100 * passCount) / scoredStudents.length).toFixed(1)}%` : '',
      cpAverage: scoredStudents.length ? average(scoredStudents).toFixed(3) : '',
      cpMin: scoredStudents.length ? Math.min(...scoredStudents).toFixed(3) : '',
      cpMax: scoredStudents.length ? Math.max(...scoredStudents).toFixed(3) : '',
      cpGiỏiCount: scoredStudents.filter(value => value >= 4).length,
      cpTrungBinhCount: scoredStudents.filter(value => value >= 3 && value < 4).length,
      cpYeuCount: scoredStudents.filter(value => value < 3).length,
      issueType: missingCount > 0 ? 'Thiếu một phần điểm CP2' : '',
      remark: missingCount > 0 ? `${missingCount} học sinh không có CP hợp lệ` : '',
    });
  }

  return { classRows, studentRows };
}

function buildDemoAnalysis(classRecords) {
  const classRows = [];
  const studentRows = [];

  for (const classRecord of classRecords) {
    const slots = (classRecord.slots || []).filter(Boolean).slice().sort((left, right) => {
      const leftDate = toDateOnly(left.date);
      const rightDate = toDateOnly(right.date);
      return leftDate - rightDate;
    });

    const demoSlot = slots[13];
    const students = (demoSlot?.studentAttendance || []).filter(Boolean);
    const meta = summarizeClassMeta(classRecord);

    if (!demoSlot) {
      classRows.push({
        ...meta,
        demoStudentCount: 0,
        demoGoodCount: 0,
        demoMediumCount: 0,
        demoPoorCount: 0,
        demoAverage: '',
        issueType: 'Thiếu buổi 14',
        remark: 'Không có buổi 14',
      });
      continue;
    }

    if (!students.length) {
      classRows.push({
        ...meta,
        demoStudentCount: 0,
        demoGoodCount: 0,
        demoMediumCount: 0,
        demoPoorCount: 0,
        demoAverage: '',
        issueType: 'Buổi 14 không có học sinh',
        remark: 'Buổi 14 không có dữ liệu học sinh',
      });
      continue;
    }

    const scores = [];
    let missingCount = 0;

    for (const attendance of students) {
      const rawScore = parseScoreByLabel(attendance.comment, 'Điểm Demo');

      studentRows.push({
        ...meta,
        demoDate: demoSlot.date || '',
        demoSlotId: demoSlot._id || '',
        studentId: attendance.student?.id || '',
        studentName: attendance.student?.fullName || '',
        attendanceStatus: attendance.status || '',
        demoScore: rawScore === null ? '' : rawScore.toFixed(3),
        qualityBand: rawScore === null ? '' : rawScore >= 4 ? 'Tốt' : rawScore >= 3 ? 'Trung bình' : 'Kém',
        remark: rawScore === null ? 'Thiếu điểm Demo hoặc lỗi định dạng nhận xét' : '',
      });

      if (rawScore === null) {
        missingCount += 1;
        continue;
      }

      scores.push(rawScore);
    }

    const goodCount = scores.filter(value => value >= 4).length;
    const mediumCount = scores.filter(value => value >= 3 && value < 4).length;
    const poorCount = scores.filter(value => value < 3).length;

    classRows.push({
      ...meta,
      demoStudentCount: scores.length,
      demoGoodCount: goodCount,
      demoMediumCount: mediumCount,
      demoPoorCount: poorCount,
      demoAverage: scores.length ? average(scores).toFixed(3) : '',
      issueType: missingCount > 0 ? 'Thiếu một phần điểm Demo' : '',
      remark: missingCount > 0 ? `${missingCount} học sinh không có điểm Demo hợp lệ` : '',
    });
  }

  return { classRows, studentRows };
}

function buildOperationsAnalysis(classRecords) {
  const classRows = [];
  const gapRows = [];

  for (const classRecord of classRecords) {
    const slots = (classRecord.slots || []).filter(Boolean).slice().sort((left, right) => {
      const leftDate = toDateOnly(left.date);
      const rightDate = toDateOnly(right.date);
      return leftDate - rightDate;
    });

    const meta = summarizeClassMeta(classRecord);
    const teacherSeq = slots.map(getTeacherSet);
    const uniqueTeacherSeq = [...new Set(teacherSeq.filter(Boolean))];
    let teacherSwitchCount = 0;

    for (let index = 1; index < teacherSeq.length; index += 1) {
      if (teacherSeq[index] !== teacherSeq[index - 1]) {
        teacherSwitchCount += 1;
      }
    }

    const dateGaps = [];
    let delayedGapCount = 0;
    let denseGapCount = 0;

    for (let index = 1; index < slots.length; index += 1) {
      const previousSlot = slots[index - 1];
      const currentSlot = slots[index];
      const gapDays = daysBetween(previousSlot.date, currentSlot.date);
      const gapType = gapDays > 7 ? 'delayed' : gapDays < 7 ? 'dense' : 'normal';

      if (gapType === 'delayed') {
        delayedGapCount += 1;
      } else if (gapType === 'dense') {
        denseGapCount += 1;
      }

      dateGaps.push(gapDays);
      gapRows.push({
        ...meta,
        slotFromId: previousSlot._id || '',
        slotToId: currentSlot._id || '',
        slotFromDate: previousSlot.date || '',
        slotToDate: currentSlot.date || '',
        gapDays: gapDays === null ? '' : gapDays.toFixed(3),
        gapType,
        issueType: gapType === 'delayed' ? 'Chậm buổi' : gapType === 'dense' ? 'Lịch dày' : '',
        remark: gapType === 'delayed' ? 'Khoảng cách lớn hơn 7 ngày' : gapType === 'dense' ? 'Lịch học dày hơn 1 tuần' : '',
        fromSummary: cleanText(previousSlot.summary || ''),
        toSummary: cleanText(currentSlot.summary || ''),
      });
    }

    classRows.push({
      ...meta,
      slotCount: slots.length,
      teacherSwitchCount,
      teacherSwitchRate: slots.length > 1 ? `${((100 * teacherSwitchCount) / (slots.length - 1)).toFixed(1)}%` : '',
      uniqueTeacherSequenceCount: uniqueTeacherSeq.length,
      delayedGapCount,
      denseGapCount,
      maxGapDays: dateGaps.length ? Math.max(...dateGaps).toFixed(3) : '',
      minGapDays: dateGaps.length ? Math.min(...dateGaps).toFixed(3) : '',
      gapPattern: dateGaps.length ? dateGaps.map(value => value.toFixed(3)).join(' | ') : '',
      issueType: delayedGapCount > 0 ? 'Chậm buổi' : denseGapCount > 0 ? 'Lịch dày' : '',
      remark: delayedGapCount > 0 ? `${delayedGapCount} khoảng trễ trên 7 ngày` : denseGapCount > 0 ? 'Có lịch học dày hơn 1 tuần' : '',
    });
  }

  return { classRows, gapRows };
}

function buildOutputFiles(baseOutputPath) {
  const basePath = stripTrailingJsonExtension(baseOutputPath);
  return {
    jsonPath: baseOutputPath,
    cp2ClassCsvPath: `${basePath}.cp2.classes.csv`,
    cp2StudentCsvPath: `${basePath}.cp2.students.csv`,
    demoClassCsvPath: `${basePath}.demo.classes.csv`,
    demoStudentCsvPath: `${basePath}.demo.students.csv`,
    operationsClassCsvPath: `${basePath}.operations.classes.csv`,
    operationsGapCsvPath: `${basePath}.operations.gaps.csv`,
    centreSummaryCsvPath: `${basePath}.centre.summary.csv`,
  };
}

function parsePercent(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCentreSummary(cp2ClassRows, demoClassRows, operationsClassRows) {
  const centreMap = new Map();

  function ensure(centreName) {
    if (!centreMap.has(centreName)) {
      centreMap.set(centreName, {
        centreName,
        classCount: 0,
        cp2ClassesWithData: 0,
        cp2Students: 0,
        cp2Pass: 0,
        cp2Fail: 0,
        cp2WeightedAvgSum: 0,
        cp2WeightedAvgCount: 0,
        cp2IssueClasses: 0,
        demoClassesWithData: 0,
        demoStudents: 0,
        demoGood: 0,
        demoMedium: 0,
        demoPoor: 0,
        demoWeightedAvgSum: 0,
        demoWeightedAvgCount: 0,
        demoIssueClasses: 0,
        operationsClasses: 0,
        delayedClassCount: 0,
        denseClassCount: 0,
        teacherSwitchCountSum: 0,
        teacherSwitchRateSum: 0,
        teacherSwitchRateCount: 0,
      });
    }

    return centreMap.get(centreName);
  }

  for (const row of cp2ClassRows) {
    const item = ensure(row.centreName || 'UNKNOWN');
    item.classCount += 1;
    if (Number(row.cpStudentCount) > 0) {
      item.cp2ClassesWithData += 1;
      item.cp2Students += Number(row.cpStudentCount);
      item.cp2Pass += Number(row.cpPassCount);
      item.cp2Fail += Number(row.cpFailCount);
      item.cp2WeightedAvgSum += Number(row.cpAverage || 0) * Number(row.cpStudentCount);
      item.cp2WeightedAvgCount += Number(row.cpStudentCount);
    }
    if (row.issueType) {
      item.cp2IssueClasses += 1;
    }
  }

  for (const row of demoClassRows) {
    const item = ensure(row.centreName || 'UNKNOWN');
    if (Number(row.demoStudentCount) > 0) {
      item.demoClassesWithData += 1;
      item.demoStudents += Number(row.demoStudentCount);
      item.demoGood += Number(row.demoGoodCount);
      item.demoMedium += Number(row.demoMediumCount);
      item.demoPoor += Number(row.demoPoorCount);
      item.demoWeightedAvgSum += Number(row.demoAverage || 0) * Number(row.demoStudentCount);
      item.demoWeightedAvgCount += Number(row.demoStudentCount);
    }
    if (row.issueType) {
      item.demoIssueClasses += 1;
    }
  }

  for (const row of operationsClassRows) {
    const item = ensure(row.centreName || 'UNKNOWN');
    item.operationsClasses += 1;
    item.teacherSwitchCountSum += Number(row.teacherSwitchCount || 0);
    const switchRate = parsePercent(row.teacherSwitchRate);
    if (switchRate !== null) {
      item.teacherSwitchRateSum += switchRate;
      item.teacherSwitchRateCount += 1;
    }
    if (Number(row.delayedGapCount || 0) > 0) {
      item.delayedClassCount += 1;
    }
    if (Number(row.denseGapCount || 0) > 0) {
      item.denseClassCount += 1;
    }
  }

  return [...centreMap.values()]
    .map(item => ({
      centreName: item.centreName,
      classCount: item.classCount,
      cp2ClassesWithData: item.cp2ClassesWithData,
      cp2Students: item.cp2Students,
      cp2Pass: item.cp2Pass,
      cp2Fail: item.cp2Fail,
      cp2PassRate: item.cp2Students ? `${((100 * item.cp2Pass) / item.cp2Students).toFixed(1)}%` : '',
      cp2Average: item.cp2WeightedAvgCount ? (item.cp2WeightedAvgSum / item.cp2WeightedAvgCount).toFixed(3) : '',
      cp2IssueClasses: item.cp2IssueClasses,
      demoClassesWithData: item.demoClassesWithData,
      demoStudents: item.demoStudents,
      demoGood: item.demoGood,
      demoMedium: item.demoMedium,
      demoPoor: item.demoPoor,
      demoAverage: item.demoWeightedAvgCount ? (item.demoWeightedAvgSum / item.demoWeightedAvgCount).toFixed(3) : '',
      demoIssueClasses: item.demoIssueClasses,
      delayedClassCount: item.delayedClassCount,
      denseClassCount: item.denseClassCount,
      teacherSwitchCountSum: item.teacherSwitchCountSum,
      teacherSwitchRateAvg: item.teacherSwitchRateCount ? `${(item.teacherSwitchRateSum / item.teacherSwitchRateCount).toFixed(1)}%` : '',
    }))
    .sort((left, right) => left.centreName.localeCompare(right.centreName));
}

async function fetchPage(pageIndex, pageSize, options, authorization) {
  const body = {
    operationName: 'GetClasses',
    variables: {
      search: '',
      centres: [],
      courses: [],
      courseLines: [],
      startDate: [null, null],
      statusIn: options.statusIn,
      pageIndex,
      itemsPerPage: pageSize,
      orderBy: 'createdAt_desc',
      type: 'OFFSET',
      teacherSlot: [],
      passedSessionIndex: null,
      unpassedSessionIndex: null,
      haveSlotIn: {},
      comments: { criteria: [] },
    },
    query: QUERY,
  };

  if (options.endDateFrom || options.endDateTo) {
    body.variables.endDate = [options.endDateFrom, options.endDateTo];
    body.variables.endDateFrom = options.endDateFrom;
    body.variables.endDateTo = options.endDateTo;
  }

  const maxRetries = 4;
  const retryableStatus = new Set([429, 502, 503, 504]);
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let response;

    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          accept: '*/*',
          authorization,
          'content-language': 'en',
          'content-type': 'application/json',
          'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          Referer: 'https://lms.mindx.edu.vn/',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Request failed (${response.status} ${response.statusText}): ${errorText}`);
      lastError = error;

      if (retryableStatus.has(response.status) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }

      throw error;
    }

    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw new Error(`GraphQL error: ${JSON.stringify(payload.errors)}`);
    }

    if (!payload?.data?.classes) {
      throw new Error(`Invalid GraphQL payload: ${JSON.stringify(payload)}`);
    }

    return payload;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Unknown error while fetching page');
}

async function main() {
  const options = parseArgs(process.argv);
  let authorization = options.authorization;

  if (!authorization && options.authFile) {
    authorization = fs.readFileSync(options.authFile, 'utf8').trim();
  }

  if (!authorization) {
    console.error('Missing authorization token. Use one of these options:');
    console.error('1) LMS_AUTHORIZATION environment variable');
    console.error('2) --authorization "<token>"');
    console.error('3) --auth-file ./token.txt (file contains token only)');
    process.exit(1);
  }

  const mergedClasses = [];
  let total = null;
  let pageIndex = 0;

  while (true) {
    const payload = await fetchPage(pageIndex, options.pageSize, options, authorization);
    const classesPayload = payload?.data?.classes;
    const pageData = classesPayload?.data || [];

    if (total === null) {
      total = classesPayload?.pagination?.total ?? pageData.length;
    }

    mergedClasses.push(...pageData);

    if (mergedClasses.length >= total) {
      break;
    }

    // Some backends cap page size (e.g. 100) even when a larger pageSize is requested.
    // Stop only when the API returns an empty page, or when we already reached pagination.total.
    if (pageData.length === 0) {
      break;
    }

    pageIndex += 1;
  }

  const outputPaths = buildOutputFiles(options.output);
  const cp2Analysis = buildCp2Analysis(mergedClasses);
  const demoAnalysis = buildDemoAnalysis(mergedClasses);
  const operationsAnalysis = buildOperationsAnalysis(mergedClasses);
  const centreSummaryRows = buildCentreSummary(
    cp2Analysis.classRows,
    demoAnalysis.classRows,
    operationsAnalysis.classRows,
  );

  const output = {
    data: {
      classes: {
        data: mergedClasses,
        pagination: {
          type: 'OFFSET',
          total: mergedClasses.length,
        },
      },
    },
  };

  fs.writeFileSync(outputPaths.jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  fs.writeFileSync(
    outputPaths.cp2ClassCsvPath,
    toCsvWithColumns(cp2Analysis.classRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'sessionCount', header: 'Số buổi' },
      { key: 'sessionHour', header: 'Giờ mỗi buổi' },
      { key: 'totalHour', header: 'Tổng giờ' },
      { key: 'cpStudentCount', header: 'Số học sinh có điểm CP2' },
      { key: 'cpPassCount', header: 'Số học sinh đạt CP2' },
      { key: 'cpFailCount', header: 'Số học sinh chưa đạt CP2' },
      { key: 'cpPassRate', header: 'Tỷ lệ đạt CP2' },
      { key: 'cpAverage', header: 'Điểm CP2 trung bình' },
      { key: 'cpMin', header: 'Điểm CP2 thấp nhất' },
      { key: 'cpMax', header: 'Điểm CP2 cao nhất' },
      { key: 'cpGiỏiCount', header: 'Số học sinh giỏi' },
      { key: 'cpTrungBinhCount', header: 'Số học sinh trung bình' },
      { key: 'cpYeuCount', header: 'Số học sinh yếu' },
      { key: 'issueType', header: 'Loại vấn đề' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.cp2StudentCsvPath,
    toCsvWithColumns(cp2Analysis.studentRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'cpDate', header: 'Ngày CP2' },
      { key: 'studentName', header: 'Tên học sinh' },
      { key: 'attendanceStatus', header: 'Trạng thái điểm danh' },
      { key: 'theoryScore', header: 'Điểm lý thuyết' },
      { key: 'practiceScore', header: 'Điểm thực hành' },
      { key: 'abilityScore', header: 'Điểm năng lực' },
      { key: 'cpScore', header: 'Điểm CP2' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.demoClassCsvPath,
    toCsvWithColumns(demoAnalysis.classRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'sessionCount', header: 'Số buổi' },
      { key: 'sessionHour', header: 'Giờ mỗi buổi' },
      { key: 'totalHour', header: 'Tổng giờ' },
      { key: 'demoStudentCount', header: 'Số học sinh có điểm Demo' },
      { key: 'demoGoodCount', header: 'Số sản phẩm tốt' },
      { key: 'demoMediumCount', header: 'Số sản phẩm trung bình' },
      { key: 'demoPoorCount', header: 'Số sản phẩm kém' },
      { key: 'demoAverage', header: 'Điểm Demo trung bình' },
      { key: 'issueType', header: 'Loại vấn đề' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.demoStudentCsvPath,
    toCsvWithColumns(demoAnalysis.studentRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'demoDate', header: 'Ngày Demo' },
      { key: 'studentName', header: 'Tên học sinh' },
      { key: 'attendanceStatus', header: 'Trạng thái điểm danh' },
      { key: 'demoScore', header: 'Điểm Demo' },
      { key: 'qualityBand', header: 'Xếp loại sản phẩm' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.operationsClassCsvPath,
    toCsvWithColumns(operationsAnalysis.classRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'sessionCount', header: 'Số buổi' },
      { key: 'sessionHour', header: 'Giờ mỗi buổi' },
      { key: 'totalHour', header: 'Tổng giờ' },
      { key: 'slotCount', header: 'Số slot thực tế' },
      { key: 'teacherSwitchCount', header: 'Số lần đổi giáo viên' },
      { key: 'teacherSwitchRate', header: 'Tỷ lệ đổi giáo viên' },
      { key: 'delayedGapCount', header: 'Số khoảng trễ > 7 ngày' },
      { key: 'denseGapCount', header: 'Số khoảng dày < 7 ngày' },
      { key: 'maxGapDays', header: 'Khoảng cách lớn nhất (ngày)' },
      { key: 'minGapDays', header: 'Khoảng cách nhỏ nhất (ngày)' },
      { key: 'issueType', header: 'Loại vấn đề' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.operationsGapCsvPath,
    toCsvWithColumns(operationsAnalysis.gapRows, [
      { key: 'className', header: 'Tên lớp' },
      { key: 'courseShortName', header: 'Khóa học' },
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'slotFromDate', header: 'Ngày buổi trước' },
      { key: 'slotToDate', header: 'Ngày buổi sau' },
      { key: 'gapDays', header: 'Khoảng cách (ngày)' },
      { key: 'gapType', header: 'Loại khoảng cách' },
      { key: 'issueType', header: 'Loại vấn đề' },
      { key: 'remark', header: 'Nhận xét' },
    ]),
    'utf8',
  );

  fs.writeFileSync(
    outputPaths.centreSummaryCsvPath,
    toCsvWithColumns(centreSummaryRows, [
      { key: 'centreName', header: 'Cơ sở' },
      { key: 'classCount', header: 'Tổng số lớp' },
      { key: 'cp2ClassesWithData', header: 'Số lớp có dữ liệu CP2' },
      { key: 'cp2Students', header: 'Số học sinh CP2' },
      { key: 'cp2Pass', header: 'Số học sinh đạt CP2' },
      { key: 'cp2Fail', header: 'Số học sinh chưa đạt CP2' },
      { key: 'cp2PassRate', header: 'Tỷ lệ đạt CP2' },
      { key: 'cp2Average', header: 'Điểm CP2 trung bình' },
      { key: 'cp2IssueClasses', header: 'Số lớp có vấn đề CP2' },
      { key: 'demoClassesWithData', header: 'Số lớp có dữ liệu Demo' },
      { key: 'demoStudents', header: 'Số học sinh Demo' },
      { key: 'demoGood', header: 'Số sản phẩm tốt' },
      { key: 'demoMedium', header: 'Số sản phẩm trung bình' },
      { key: 'demoPoor', header: 'Số sản phẩm kém' },
      { key: 'demoAverage', header: 'Điểm Demo trung bình' },
      { key: 'demoIssueClasses', header: 'Số lớp có vấn đề Demo' },
      { key: 'delayedClassCount', header: 'Số lớp có trễ buổi' },
      { key: 'denseClassCount', header: 'Số lớp có lịch dày' },
      { key: 'teacherSwitchCountSum', header: 'Tổng số lần đổi giáo viên' },
      { key: 'teacherSwitchRateAvg', header: 'Tỷ lệ đổi giáo viên trung bình' },
    ]),
    'utf8',
  );

  console.log(`Wrote JSON: ${outputPaths.jsonPath}`);
  console.log(`Wrote CSV: ${outputPaths.cp2ClassCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.cp2StudentCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.demoClassCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.demoStudentCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.operationsClassCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.operationsGapCsvPath}`);
  console.log(`Wrote CSV: ${outputPaths.centreSummaryCsvPath}`);
  console.log(`Wrote ${mergedClasses.length} classes in total`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});