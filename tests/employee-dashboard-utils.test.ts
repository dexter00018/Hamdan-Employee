import { describe, expect, it } from 'vitest';
import {
  computeAttendanceStreak,
  computeCurrentCutoffKey,
  countLeaveDays,
  countLeaveHolidays,
  directoryInitials,
  disputeClaimed,
  disputeFieldLabel,
  disputeOriginal,
  disputeTypeLabel,
  formatCreditValue,
  formatLateDuration,
  formatMonthLabel,
  formatMonthOnly,
  formatOffsetShort,
  isLeaveStatus,
  matchesCutoff,
  maskValue,
  splitHolidays,
  streakMessageFor,
} from '@/lib/employee/dashboard-utils';

describe('dashboard-utils: directory + masking', () => {
  it('takes first letters of up to two words', () => {
    expect(directoryInitials('John Dexter Ramos')).toBe('JD');
    expect(directoryInitials('John')).toBe('J');
  });

  it('falls back to ? when the name is missing', () => {
    expect(directoryInitials(null)).toBe('?');
  });

  it('masks all but the first two characters', () => {
    expect(maskValue('12345678')).toBe('12••••••');
    expect(maskValue('12')).toBe('12');
  });
});

describe('dashboard-utils: cutoff keys', () => {
  it('matches whole-month, first-half, and second-half cutoffs', () => {
    expect(matchesCutoff('2026-10-05', '2026-10:ALL')).toBe(true);
    expect(matchesCutoff('2026-10-05', '2026-10:H1')).toBe(true);
    expect(matchesCutoff('2026-10-05', '2026-10:H2')).toBe(false);
    expect(matchesCutoff('2026-10-20', '2026-10:H1')).toBe(false);
    expect(matchesCutoff('2026-10-20', '2026-10:H2')).toBe(true);
    expect(matchesCutoff('2026-09-20', '2026-10:H2')).toBe(false);
    expect(matchesCutoff(undefined, '2026-10:H2')).toBe(false);
  });

  it('builds the current cutoff key from today', () => {
    const key = computeCurrentCutoffKey();
    expect(key).toMatch(/^\d{4}-\d{2}:(H1|H2)$/);
  });
});

describe('dashboard-utils: attendance streak', () => {
  it('counts consecutive non-late, non-absent days, most recent first', () => {
    const history = [
      { log_date: '2026-10-20', status: 'Present' },
      { log_date: '2026-10-17', status: 'Late' },
      { log_date: '2026-10-16', status: 'Present' },
    ];
    expect(computeAttendanceStreak(history, '2026-10-20')).toBe(1);
  });

  it('breaks on Absent', () => {
    const history = [
      { log_date: '2026-10-20', status: 'Present' },
      { log_date: '2026-10-17', status: 'Absent' },
      { log_date: '2026-10-16', status: 'Present' },
    ];
    expect(computeAttendanceStreak(history, '2026-10-20')).toBe(1);
  });

  it('skips Leave days without breaking the streak', () => {
    const history = [
      { log_date: '2026-10-20', status: 'Vacation Leave' },
      { log_date: '2026-10-17', status: 'Present' },
      { log_date: '2026-10-16', status: 'Sick Leave' },
      { log_date: '2026-10-15', status: 'Present' },
    ];
    expect(computeAttendanceStreak(history, '2026-10-20')).toBe(2);
  });

  it('counts all days when nothing breaks the streak', () => {
    const history = [
      { log_date: '2026-10-20', status: 'Present' },
      { log_date: '2026-10-17', status: 'Present' },
    ];
    expect(computeAttendanceStreak(history, '2026-10-20')).toBe(2);
  });

  it('ignores rows from after today', () => {
    const history = [
      { log_date: '2026-10-25', status: 'Present' },
      { log_date: '2026-10-17', status: 'Present' },
    ];
    expect(computeAttendanceStreak(history, '2026-10-20')).toBe(1);
  });
});

describe('dashboard-utils: streak messages', () => {
  it('matches each streak tier', () => {
    expect(streakMessageFor(0)).toBe('Start your streak today!');
    expect(streakMessageFor(4)).toBe('Nice start!');
    expect(streakMessageFor(9)).toBe('Great job!');
    expect(streakMessageFor(19)).toBe('Impressive!');
    expect(streakMessageFor(20)).toBe('Outstanding!');
  });
});

describe('dashboard-utils: holidays', () => {
  const holidays = [
    { holiday_date: '2026-10-01', name: 'Past Holiday' },
    { holiday_date: '2026-12-25', name: 'Christmas Day' },
    { holiday_date: '2026-11-02', name: 'Next Holiday' },
  ];

  it('splits upcoming (nearest first) and past (most recent first)', () => {
    const { upcomingHolidays, pastHolidays } = splitHolidays(holidays, '2026-10-21');
    expect(upcomingHolidays.map((h) => h.name)).toEqual(['Next Holiday', 'Christmas Day']);
    expect(pastHolidays.map((h) => h.name)).toEqual(['Past Holiday']);
  });

  it('counts chargeable leave days Mon-Fri excluding holidays', () => {
    const holidayDates = new Set(['2026-10-22']);
    // Oct 21 (Tue) .. Oct 23 (Fri): 3 weekdays minus 1 holiday = 2
    expect(countLeaveDays('2026-10-21', '2026-10-23', holidayDates)).toBe(2);
    // Weekend spread: Sat-Sun excluded
    expect(countLeaveDays('2026-10-24', '2026-10-25', new Set())).toBe(0);
    expect(countLeaveDays('', '2026-10-23', new Set())).toBe(0);
    expect(countLeaveDays('2026-10-23', '2026-10-21', new Set())).toBe(0);
  });

  it('counts holidays inside the requested range only', () => {
    expect(countLeaveHolidays('2026-10-01', '2026-11-30', holidays)).toBe(2);
    expect(countLeaveHolidays('2026-12-01', '2026-12-31', holidays)).toBe(1);
    expect(countLeaveHolidays('2026-10-02', '2026-10-15', holidays)).toBe(0);
  });
});

describe('dashboard-utils: formatted values', () => {
  it('formats credit values without trailing .0', () => {
    expect(formatCreditValue(10)).toBe('10');
    expect(formatCreditValue(10.5)).toBe('10.5');
  });

  it('formats compact offset durations', () => {
    expect(formatOffsetShort(200)).toBe('3h 20m');
    expect(formatOffsetShort(180)).toBe('3h');
    expect(formatOffsetShort(45)).toBe('45m');
    expect(formatOffsetShort(0)).toBe('0m');
    expect(formatOffsetShort(-5)).toBe('0m');
  });

  it('formats late durations', () => {
    expect(formatLateDuration(0)).toBe('0 min');
    expect(formatLateDuration(45)).toBe('45 min');
    expect(formatLateDuration(150)).toBe('2h 30m');
  });

  it('detects any leave-flavored status', () => {
    expect(isLeaveStatus('Sick Leave')).toBe(true);
    expect(isLeaveStatus('vacation leave')).toBe(true);
    expect(isLeaveStatus('Present')).toBe(false);
    expect(isLeaveStatus(null)).toBe(false);
  });
});

describe('dashboard-utils: month labels', () => {
  it('labels whole months and cutoff halves', () => {
    expect(formatMonthOnly('2026-10')).toBe('October 2026');
    expect(formatMonthLabel('2026-10:ALL')).toBe('October 2026 (Whole Month)');
    expect(formatMonthLabel('2026-10:H1')).toBe('October 1-15, 2026');
    expect(formatMonthLabel('2026-02:H2')).toBe('February 16-28, 2026');
  });
});

describe('dashboard-utils: dispute helpers', () => {
  it('labels each dispute kind', () => {
    expect(disputeTypeLabel({ attendance_log_id: 5 })).toBe('Late tag dispute');
    expect(disputeTypeLabel({ attendance_log_id: null })).toBe('Missed time-in');
    expect(disputeTypeLabel({ dispute_type: 'TimeOut', attendance_log_id: 5 })).toBe('Missed time-out');
  });

  it('picks original/claimed values by dispute type', () => {
    const timeOut = { dispute_type: 'TimeOut', original_time_out: '18:59', claimed_time_out: '19:30' };
    expect(disputeOriginal(timeOut)).toBe('18:59');
    expect(disputeClaimed(timeOut)).toBe('19:30');
    const timeIn = { dispute_type: 'TimeIn', original_time_in: '08:47', claimed_time_in: '08:00' };
    expect(disputeOriginal(timeIn)).toBe('08:47');
    expect(disputeClaimed(timeIn)).toBe('08:00');
    expect(disputeFieldLabel(timeOut)).toBe('Time-Out');
    expect(disputeFieldLabel(timeIn)).toBe('Time-In');
  });
});
