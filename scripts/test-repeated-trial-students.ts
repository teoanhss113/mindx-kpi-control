// Run: npx tsx --test scripts/test-repeated-trial-students.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Appointment, Candidate, OfficeHour } from '../src/types/officeHours';
import {
  analyzeRepeatedTrialStudents, getAppointmentOccurrenceKey, getRepeatedTrialMatches, getRepeatedTrialOfficeHourSummary,
  matchesTrialStudentSearch, normalizeStudentName, normalizeStudentPhone,
} from '../src/lib/repeatedTrialStudents';

const appointment = (id: string, candidate: Partial<Candidate> = {}): Appointment => ({
  id, title: '', status: 'WAITING', createdAt: 0,
  candidate: { id, fullName: '', ...candidate },
});
const session = (id: string, appointments: Appointment[], overrides: Partial<OfficeHour> = {}): OfficeHour => ({
  id, appointments, courses: [], courseLines: [], courseTopics: [], centre: null,
  startTime: '2026-09-01T08:00:00Z', endTime: '2026-09-01T09:00:00Z',
  status: 'APPROVED', type: 'Trial', studentCount: appointments.length, createdAt: 0, ...overrides,
});

test('empty input and missing candidate do not match or throw', () => {
  assert.equal(analyzeRepeatedTrialStudents([]).repeatedAppointmentCount, 0);
  const missing = { ...appointment('x'), candidate: undefined } as unknown as Appointment;
  const analysis = analyzeRepeatedTrialStudents([session('a', [missing]), session('b', [missing])]);
  assert.equal(analysis.repeatedAppointmentCount, 0);
});

test('only multiple distinct sessions trigger an alert', () => {
  const a = appointment('a', { id: 'student' });
  const b = appointment('b', { id: 'student' });
  assert.equal(analyzeRepeatedTrialStudents([session('one', [a, b])]).repeatedAppointmentCount, 0);
  const analysis = analyzeRepeatedTrialStudents([session('one', [a, b]), session('two', [a])]);
  assert.equal(analysis.officeHourIds.size, 2);
  assert.equal(analysis.repeatedAppointmentCount, 3);
  assert.equal(getRepeatedTrialMatches(analysis, 'one', 'a').length, 1);
});

test('candidate ID matches despite changed name/contact', () => {
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { id: 'same', fullName: 'An' })]),
    session('two', [appointment('b', { id: 'same', fullName: 'Bình' })]),
  ]);
  assert.deepEqual(getRepeatedTrialMatches(analysis, 'one', 'a')[0].reasons, ['Cùng mã học viên']);
});

test('phone formatting and Vietnamese country code normalize consistently', () => {
  for (const phone of ['0901 234 567', '+84 901-234-567', '0084901234567', '(0901) 234.567']) {
    assert.equal(normalizeStudentPhone(phone), '0901234567');
  }
  for (const phone of ['', '0000000000', '123', '0901234567 / 0912345678', 'N/A']) {
    assert.equal(normalizeStudentPhone(phone), '');
  }
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { phoneNumber: '0901 234 567' })]),
    session('two', [appointment('b', { phoneNumber: '+84 901234567' })]),
  ]);
  assert.deepEqual(getRepeatedTrialMatches(analysis, 'one', 'a')[0].reasons, ['Trùng số điện thoại']);
});

test('names are case/accent/whitespace insensitive but preserve word boundaries', () => {
  assert.equal(normalizeStudentName(' Đặng   ÁNH '), 'dang anh');
  assert.notEqual(normalizeStudentName('An Na'), normalizeStudentName('Anna'));
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { fullName: 'Đặng Ánh' })]),
    session('two', [appointment('b', { fullName: ' dang   ANH ' })]),
  ]);
  assert.equal(getRepeatedTrialMatches(analysis, 'one', 'a')[0].reasons.length, 1);
});

test('placeholder values do not merge unrelated records', () => {
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { fullName: 'N/A', phoneNumber: '0000000000', email: '-' })]),
    session('two', [appointment('b', { fullName: 'N/A', phoneNumber: '0000000000', email: '-' })]),
  ]);
  assert.equal(analysis.repeatedAppointmentCount, 0);
});

test('multiple matching fields produce one occurrence with all evidence', () => {
  const candidate = { id: 'same', fullName: 'Mai An', phoneNumber: '0901234567', email: 'TEST@example.com' };
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', candidate)]),
    session('two', [appointment('b', { ...candidate, email: ' test@EXAMPLE.com ' })]),
  ]);
  assert.equal(analysis.repeatedAppointmentCount, 2);
  const matches = getRepeatedTrialMatches(analysis, 'one', 'a');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].reasons.length, 4);
});

test('does not infer a transitive identity through shared family contact/name', () => {
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { fullName: 'An', phoneNumber: '0901234567' })]),
    session('two', [appointment('b', { fullName: 'Bình', phoneNumber: '0901234567' })]),
    session('three', [appointment('c', { fullName: 'Bình', phoneNumber: '0987654321' })]),
  ]);
  assert.deepEqual(getRepeatedTrialMatches(analysis, 'one', 'a').map(item => item.officeHourId), ['two']);
  assert.deepEqual(getRepeatedTrialMatches(analysis, 'three', 'c').map(item => item.officeHourId), ['two']);
  assert.equal(getRepeatedTrialMatches(analysis, 'two', 'b').length, 2);
});

test('repeated payloads do not inflate counts; appointment IDs are scoped to a session', () => {
  const a = appointment('a', { id: 'same' });
  const one = session('one', [a, a]);
  const analysis = analyzeRepeatedTrialStudents([one, one, session('two', [a])]);
  assert.equal(analysis.repeatedAppointmentCount, 2);
  assert.equal(getRepeatedTrialMatches(analysis, 'one', 'a').length, 1);
  assert.notEqual(getAppointmentOccurrenceKey('a:b', 'c'), getAppointmentOccurrenceKey('a', 'b:c'));
});

test('excludes canceled/rejected/abandoned sessions and canceled appointments without mutating source', () => {
  const data = [
    session('one', [appointment('a', { id: 'same' })]),
    session('two', [appointment('b', { id: 'same' })], { status: 'CANCELED' }),
    session('three', [appointment('c', { id: 'same' })], { status: 'REJECTED' }),
    session('four', [appointment('d', { id: 'same' })], { status: 'ABANDONED' }),
    session('five', [{ ...appointment('e', { id: 'same' }), status: 'CANCELED' }]),
    session('six', [appointment('f', { id: 'same' })]),
  ];
  const original = JSON.stringify(data);
  const analysis = analyzeRepeatedTrialStudents(data);
  const matches = getRepeatedTrialMatches(analysis, 'one', 'a');
  assert.equal(analysis.repeatedAppointmentCount, 2);
  assert.deepEqual(matches.map(item => item.officeHourId), ['six']);
  assert.equal(matches[0].appointment.status, 'WAITING');
  assert.equal(matches[0].appointment.resultAfterTrial?.isTrialed, undefined);
  assert.equal(JSON.stringify(data), original);
});

test('full direct history remains available and chronologically ordered', () => {
  const data = Array.from({ length: 6 }, (_, index) => session(`s${index}`, [appointment('a', { id: 'same' })], {
    startTime: `2026-09-0${6 - index}T08:00:00Z`,
  }));
  const matches = getRepeatedTrialMatches(analyzeRepeatedTrialStudents(data), 's0', 'a');
  assert.equal(matches.length, 5);
  assert.equal(matches[0].officeHourId, 's5');
  assert.equal(matches[4].officeHourId, 's1');
});

test('history exposes appointment and session course context', () => {
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [appointment('a', { id: 'same' })], {
      courses: [{ id: 'scratch', name: 'Scratch Foundation', shortName: 'Scratch' }],
      courseLines: [{ id: 'coding', name: 'Coding' }],
      courseTopics: [{ id: 'game', name: 'Game' }],
    }),
    session('two', [{
      ...appointment('b', { id: 'same' }),
      courses: [{ id: 'python', name: 'Python Foundation', shortName: 'Python' }],
    }], {
      courses: [{ id: 'web', name: 'Web Fullstack', shortName: 'Web' }],
      courseLines: [{ id: 'coding', name: 'Coding' }],
      courseTopics: [{ id: 'app', name: 'App' }],
    }),
  ]);
  const [match] = getRepeatedTrialMatches(analysis, 'one', 'a');
  assert.deepEqual(match.appointmentCourseNames, ['Python']);
  assert.deepEqual(match.sessionCourseNames, ['Web']);
  assert.deepEqual(match.sessionCourseLineNames, ['Coding']);
  assert.deepEqual(match.sessionCourseTopicNames, ['App']);
});

test('office-hour summary exposes repeated reasons and course relation', () => {
  const analysis = analyzeRepeatedTrialStudents([
    session('one', [
      appointment('a', { id: 'same-id', fullName: 'Mai An', phoneNumber: '0901234567' }),
      appointment('b', { fullName: 'Lan Chi', phoneNumber: '0987654321' }),
    ], {
      courses: [{ id: 'scratch', name: 'Scratch Foundation', shortName: 'Scratch' }],
    }),
    session('two', [appointment('c', { id: 'same-id', fullName: 'Khac', phoneNumber: '0901234567' })], {
      courses: [{ id: 'scratch', name: 'Scratch Foundation', shortName: 'Scratch' }],
    }),
    session('three', [appointment('d', { fullName: 'Lan Chi', phoneNumber: '0987654321' })], {
      courses: [{ id: 'python', name: 'Python Foundation', shortName: 'Python' }],
    }),
  ]);
  const summary = getRepeatedTrialOfficeHourSummary(analysis, 'one');
  assert.equal(summary.appointmentCount, 2);
  assert.deepEqual(summary.reasonLabels, ['Mã HV', 'SĐT', 'Tên']);
  assert.equal(summary.hasSameCourse, true);
  assert.equal(summary.hasDifferentCourse, true);
  assert.equal(summary.hasUnknownCourse, false);
});

test('search supports name accents, normalized phone, email and ID', () => {
  const candidate: Candidate = { id: 'student-123', fullName: 'Đặng Ánh', phoneNumber: '+84 901234567', email: 'Test@example.com' };
  for (const query of [' dang anh ', '0901234567', 'test@EXAMPLE.COM', 'student-123']) {
    assert.equal(matchesTrialStudentSearch(candidate, query), true, query);
  }
  assert.equal(matchesTrialStudentSearch(candidate, 'khong khop'), false);
  assert.equal(matchesTrialStudentSearch(undefined, 'test'), false);
});
