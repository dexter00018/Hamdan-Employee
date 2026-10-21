import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { answerEmployeeDashboardQuestion, detectDashboardQuestion, detectPayslipQuestion, daysUntil, streakFromRows } from '@/lib/server/employee-ai-dashboard';

type Row = Record<string, unknown>;
function fakeClient(tables: Record<string, Row[]>) {
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])]; let single = false;
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { rows = rows.filter(r => r[column] === value); return chain; },
      gte: (column: string, value: string) => { rows = rows.filter(r => String(r[column]) >= value); return chain; },
      lte: (column: string, value: string) => { rows = rows.filter(r => String(r[column]) <= value); return chain; },
      order: (column: string, options?: { ascending: boolean }) => { rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (options?.ascending === false ? -1 : 1)); return chain; },
      limit: (n: number) => { rows = rows.slice(0, n); return chain; },
      maybeSingle: () => { single = true; return chain; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve),
    };
    return chain;
  });
  return { client: { from } as unknown as SupabaseClient, from };
}

describe('Ask AI dashboard-card alignment', () => {
  it('detects streak questions in English and Filipino', () => {
    expect(detectDashboardQuestion('What is my attendance streak?')).toBe('attendance_streak');
    expect(detectDashboardQuestion('Ano ang streak ko ngayong taon?')).toBe('attendance_streak');
    expect(detectDashboardQuestion('How many consecutive work days have I worked?')).toBe('attendance_streak');
  });

  it('detects holiday questions in English and Filipino, including after-a-holiday anchors', () => {
    expect(detectDashboardQuestion('When is the next company holiday?')).toBe('company_holiday');
    expect(detectDashboardQuestion('Ano ang susunod na holiday?')).toBe('company_holiday');
    expect(detectDashboardQuestion('Ano ang susunod na holiday pagkatapos ng Christmas?')).toBe('company_holiday');
    expect(detectDashboardQuestion('What holiday comes after Christmas?')).toBe('company_holiday');
    expect(detectDashboardQuestion('Mga holiday sa company')).toBe('company_holiday');
  });

  it('detects the employee start-date and tenure questions', () => {
    expect(detectDashboardQuestion('Kailan ako nagsimula pumasok?')).toBe('start_date');
    expect(detectDashboardQuestion('Kailan ako nag simula dito?')).toBe('start_date');
    expect(detectDashboardQuestion('What is my start date?')).toBe('start_date');
    expect(detectDashboardQuestion('When did I join the company?')).toBe('start_date');
    expect(detectDashboardQuestion('Gaano katagal na ako dito?')).toBe('start_date');
    expect(detectDashboardQuestion('How long have I been working here?')).toBe('start_date');
  });

  it('detects project tracking start questions separately from hired dates', () => {
    expect(detectDashboardQuestion('Kailan ako nag simula dito sa project na ito?')).toBe('project_start');
    expect(detectDashboardQuestion('When did I start on the project?')).toBe('project_start');
    expect(detectDashboardQuestion('Gaano katagal na ako sa tracker?')).toBe('project_start');
  });

  it('detects remaining offset hours locally instead of paying an n8n round trip', () => {
    expect(detectDashboardQuestion('Ilan na lang ang offset hours ko?')).toBe('offset_balance');
    expect(detectDashboardQuestion('How many offset hours do I have left?')).toBe('offset_balance');
    expect(detectDashboardQuestion('Magkano na lang matitira kong offset?')).toBe('offset_balance');
    expect(detectDashboardQuestion('What is my offset balance?')).toBe('offset_balance');
  });

  it('detects employment status questions', () => {
    expect(detectDashboardQuestion('Ano ang employment status ko?')).toBe('employment_status');
    expect(detectDashboardQuestion('Regular na ba ako?')).toBe('employment_status');
  });

  it('leaves explanatory and other-person questions to the other handlers', () => {
    expect(detectDashboardQuestion('How does Offset work?')).toBeNull();
    expect(detectDashboardQuestion('Paano maka-offset?')).toBeNull();
    expect(detectDashboardQuestion('Paano mag-start ng project sa tracker?')).toBeNull();
    expect(detectDashboardQuestion('What time do I start?')).toBeNull();
    expect(detectDashboardQuestion('What are the deductions in my payslip?')).toBeNull();
    expect(detectDashboardQuestion('Who is my direct lead?')).toBeNull();
    expect(detectDashboardQuestion('')).toBeNull();
  });

  it('computes the streak with the exact card math: skip Leave, stop at Late/Absent', () => {
    const rows = [
      { log_date: '2026-10-21', status: 'Present' },
      { log_date: '2026-10-20', status: 'Late' },
      { log_date: '2026-10-17', status: 'Present' },
      { log_date: '2026-10-16', status: 'On Leave' },
      { log_date: '2026-10-15', status: 'Present' },
      { log_date: '2026-10-14', status: 'Absent' },
      { log_date: '2026-10-13', status: 'Present' },
    ];
    expect(streakFromRows(rows, '2026-10-21')).toBe(1);
    expect(streakFromRows(rows, '2026-10-17')).toBe(2);
    expect(streakFromRows(rows, '2026-10-14')).toBe(0);
    expect(streakFromRows(rows, '2026-10-13')).toBe(1);
  });

  it('ignores future dates and empty history', () => {
    expect(streakFromRows([{ log_date: '2026-10-22', status: 'Present' }], '2026-10-21')).toBe(0);
    expect(streakFromRows([], '2026-10-21')).toBe(0);
  });

  it('matches the dashboard daysUntil holiday math', () => {
    expect(daysUntil('2026-10-21', '2026-10-21')).toBe(0);
    expect(daysUntil('2026-10-22', '2026-10-21')).toBe(1);
    expect(daysUntil('2026-11-01', '2026-10-21')).toBe(11);
  });

  it('answers the streak question from owned attendance rows only', async () => {
    const db = fakeClient({ attendance_logs: [
      { user_id: 'alice', log_date: '2026-10-21', status: 'Present' },
      { user_id: 'alice', log_date: '2026-10-20', status: 'Present' },
      { user_id: 'alice', log_date: '2026-10-17', status: 'Late' },
      { user_id: 'bob', log_date: '2026-10-21', status: 'Present' },
      { user_id: 'bob', log_date: '2026-10-20', status: 'Present' },
    ] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'What is my attendance streak?', language: 'en' });
    expect(answer?.answer).toContain('2 consecutive work days');
    expect(answer?.answer).toContain('Late');
    expect(answer?.source).toBe('dashboard_live');
  });

  it('answers the next holiday from the holidays table with a countdown and upcoming list', async () => {
    const db = fakeClient({ holidays: [
      { holiday_date: '2099-11-01', name: "All Saints' Day" },
      { holiday_date: '2099-12-25', name: 'Christmas' },
    ] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Kailan ang next holiday?', language: 'auto' });
    expect(answer?.answer).toContain("All Saints' Day");
    expect(answer?.answer).toContain('Christmas');
  });

  it('answers the holiday after an anchored holiday like Christmas', async () => {
    const db = fakeClient({ holidays: [
      { holiday_date: '2099-12-24', name: 'Company Day' },
      { holiday_date: '2099-12-25', name: 'Christmas' },
      { holiday_date: '2100-01-01', name: 'New Year Celebration' },
    ] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Ano ang susunod na holiday pagkatapos ng Christmas?', language: 'auto' });
    expect(answer?.answer).toContain('Pagkatapos ng Christmas');
    expect(answer?.answer).toContain('New Year Celebration');
    expect(answer?.answer).not.toContain('susunod na holiday ay Company Day');
  });

  it('answers the last-holiday case when the anchor is scheduled last', async () => {
    const db = fakeClient({ holidays: [
      { holiday_date: '2099-12-25', name: 'Christmas' },
    ] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'What holiday comes after Christmas?', language: 'en' });
    expect(answer?.answer).toContain('last scheduled company holiday');
  });

  it('answers gracefully when no holiday is scheduled', async () => {
    const db = fakeClient({ holidays: [] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'When is the next company holiday?', language: 'en' });
    expect(answer?.answer).toContain('No company holiday');
  });

  it('answers remaining offset hours with the exact card math, including pending early-out reservations', async () => {
    const db = fakeClient({
      offset_transactions: [
        { user_id: 'alice', kind: 'earned', hours: 5, minutes: 0 },
        { user_id: 'alice', kind: 'used', hours: 1, minutes: 0 },
      ],
      offset_usage_requests: [{ user_id: 'alice', status: 'Pending', hours: 0, required_minutes: 60 }],
      early_out_offset_requests: [{ user_id: 'alice', status: 'Pending', required_minutes: 30 }],
      leave_requests: [{ user_id: 'alice', status: 'Pending', funding_source: 'offset', offset_minutes_required: 30 }],
    });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Ilan na lang ang offset hours ko?', language: 'auto' });
    // Approved 5h minus used 1h minus reserved 60+30+30 minutes = 2h 0m.
    expect(answer?.answer).toContain('2h');
    expect(answer?.answer).toContain('reserved');
  });

  it('answers the zero-offset case without inventing a balance', async () => {
    const db = fakeClient({ offset_transactions: [] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'How many offset hours do I have left?', language: 'en' });
    expect(answer?.answer).toContain('no approved offset balance');
  });

  it('answers the hired date and tenure years from the government-IDs record', async () => {
    const db = fakeClient({ employee_government_ids: [{ user_id: 'alice', hired_date: '2024-02-15', employment_status: 'Regular' }] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Kailan ako nagsimula pumasok?', language: 'auto' });
    expect(answer?.answer).toContain('February 15, 2024');
    expect(answer?.answer).toContain('taon');
  });

  it('falls back to the earliest attendance log when no hired date exists', async () => {
    const db = fakeClient({
      employee_government_ids: [{ user_id: 'alice', hired_date: null, employment_status: 'Regular' }],
      attendance_logs: [{ user_id: 'alice', log_date: '2025-03-10', status: 'Present' }],
    });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'When did I start working here?', language: 'en' });
    expect(answer?.answer).toContain('first attendance record');
    expect(answer?.answer).toContain('March 10, 2025');
  });

  it('answers the project start date from the most recent tracked project', async () => {
    const db = fakeClient({
      manpower_sessions: [
        { user_id: 'alice', project_id: 'proj-1', started_at: '2099-06-01T09:00:00+08:00' },
        { user_id: 'alice', project_id: 'proj-1', started_at: '2097-12-05T09:00:00+08:00' },
        { user_id: 'alice', project_id: 'proj-2', started_at: '2097-01-10T09:00:00+08:00' },
      ],
      manpower_projects: [{ id: 'proj-1', name: 'Tower B Refit' }],
    });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Kailan ako nag simula dito sa project na ito?', language: 'auto' });
    expect(answer?.answer).toContain('Tower B Refit');
    expect(answer?.answer).toContain('2097');
  });

  it('answers the employment status from the government-IDs record', async () => {
    const db = fakeClient({ employee_government_ids: [{ user_id: 'alice', employment_status: 'Regular' }] });
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'Ano ang employment status ko?', language: 'auto' });
    expect(answer?.answer).toContain('Regular');
  });

  it('never queries the database when the question is not dashboard-scoped', async () => {
    const db = fakeClient({});
    const answer = await answerEmployeeDashboardQuestion({ client: db.client, userId: 'alice', question: 'How much is my salary?', language: 'en' });
    expect(answer).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('Ask AI local payslip routing', () => {
  it('routes own-pay questions to the verified payslip pipeline with the right metric and cutoff mode', () => {
    expect(detectPayslipQuestion('ano ang latest deduction ko ngayong month')).toMatchObject({ metric: 'deductions', cutoffMode: 'current_month' });
    expect(detectPayslipQuestion('What are the deductions in my payslip?')).toMatchObject({ metric: 'deductions', cutoffMode: 'explicit' });
    expect(detectPayslipQuestion('What are the deductions in my latest payslip?')).toMatchObject({ metric: 'deductions', cutoffMode: 'latest' });
    expect(detectPayslipQuestion('How much is my net pay sa payslip?')).toMatchObject({ metric: 'net_pay', cutoffMode: 'explicit' });
    expect(detectPayslipQuestion('Magkano ang sweldo ko?')).toMatchObject({ metric: 'payslip_summary', cutoffMode: 'explicit' });
  });

  it('leaves explanatory and lookup payslip questions to the guides', () => {
    expect(detectPayslipQuestion('How do I read my payslip?')).toBeNull();
    expect(detectPayslipQuestion('Where are my payslips?')).toBeNull();
    expect(detectPayslipQuestion('Saan makikita ang payslip ko?')).toBeNull();
    expect(detectPayslipQuestion('Is my payslip secure?')).toBeNull();
    expect(detectPayslipQuestion('Deductions sa payslip ng iba')).toBeNull();
    expect(detectPayslipQuestion('')).toBeNull();
  });
});
