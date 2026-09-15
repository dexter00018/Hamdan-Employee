import { describe, expect, it } from 'vitest';
import { helpdeskEvent, helpdeskEmail } from '../lib/automations/helpdesk-email.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const r = { id, user_id: id, category: 'IT Concern', subject: 'Cannot log in', description: '<script>test</script>\nمرحبا', hr_notes: null as string | null, status: 'Open', created_at: '2026-09-14T08:00:00Z', updated_at: '2026-09-14T09:00:00Z' };
const body = { schema: 'public', table: 'employee_support_requests', type: 'INSERT', record: r };
const user = { id, email: 'requestor@example.com' };
const config = { fromEmail: 'hr@hamdanstudio.com', hrEmail: 'hr@hamdanstudio.com', portalUrl: 'https://manila.test', testMode: false, testEmail: 'hr@hamdanstudio.com' };
describe('helpdesk notifications', () => {
  it('routes new requests from HR to HR with category-subject format', () => {
    const event = helpdeskEvent(body)!;
    const mail = helpdeskEmail(event, user, config)!;
    expect(mail.fromEmail).toBe('hr@hamdanstudio.com');
    expect(mail.toEmail).toBe('hr@hamdanstudio.com');
    expect(mail.subject).toBe('IT Concern - Cannot log in');
    expect(mail.html).toContain('/hr');
  });
  it('routes changed HR replies only to the requestor', () => {
    const event = helpdeskEvent({ ...body, type: 'UPDATE', old_record: r, record: { ...r, hr_notes: 'Please reset your password.' } })!;
    const mail = helpdeskEmail(event, { user }, config)!;
    expect(mail.toEmail).toBe(user.email);
    expect(mail.html).toContain('Please reset your password.');
    expect(mail.html).toContain('/employee');
  });
  it('skips status-only, unchanged, cleared replies and unrelated events', () => {
    expect(helpdeskEvent({ ...body, type: 'UPDATE', old_record: r, record: { ...r, status: 'Resolved' } })).toBeNull();
    expect(helpdeskEvent({ ...body, type: 'UPDATE', old_record: { ...r, hr_notes: 'Done' }, record: { ...r, hr_notes: ' Done ' } })).toBeNull();
    expect(helpdeskEvent({ ...body, type: 'DELETE' })).toBeNull();
    expect(helpdeskEvent({ ...body, table: 'announcements' })).toBeNull();
  });
  it('escapes content and strips header control characters with summary fallback', () => {
    const event = helpdeskEvent({ ...body, record: { ...r, category: 'IT\r\nConcern', subject: '' } })!;
    const mail = helpdeskEmail(event, user, config)!;
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toContain('IT Concern - ');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('مرحبا');
  });
  it('rejects identity changes and malformed records', () => {
    expect(() => helpdeskEvent({ ...body, record: { ...r, user_id: 'bad' } })).toThrow();
    expect(() => helpdeskEvent({ ...body, type: 'UPDATE', old_record: { ...r, user_id: 'other' }, record: { ...r, hr_notes: 'Reply' } })).toThrow();
    expect(() => helpdeskEmail(helpdeskEvent(body)!, { ...user, id: 'other' }, config)).toThrow();
  });
  it('test mode redirects replies to tester and labels the subject', () => {
    const event = helpdeskEvent({ ...body, type: 'UPDATE', old_record: r, record: { ...r, hr_notes: 'Reply' } })!;
    const mail = helpdeskEmail(event, user, { ...config, testMode: true })!;
    expect(mail.toEmail).toBe(config.testEmail);
    expect(mail.subject).toBe('[TEST] IT Concern - Cannot log in');
    expect(helpdeskEmail(event, { ...user, banned_until: '2999-01-01' }, config)).toBeNull();
    expect(() => helpdeskEmail(event, { ...user, email: 'a@b.com,c@d.com' }, config)).toThrow();
  });
});
