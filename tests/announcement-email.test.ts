import { describe, expect, it } from 'vitest';
import { validateEvent, employeeProfiles, buildEmails } from '../lib/automations/announcement-email.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const record = { id, content: '<script>alert("bad")</script>\nمرحبا', image_url: null, updated_at: '2026-09-10T09:00:00Z' };
const event = { schema: 'public', table: 'announcements', type: 'INSERT', record };
const config = { announcement: record, testMode: false, fromEmail: 'hr@example.com', portalUrl: 'https://manila.test/employee' };
describe('announcement email automation', () => {
  it('accepts inserts and changed updates, ignores unrelated events', () => {
    expect(validateEvent(event)?.announcement.id).toBe(id);
    expect(validateEvent({ ...event, type: 'DELETE' })).toBeNull();
    expect(validateEvent({ ...event, table: 'profiles' })).toBeNull();
    expect(validateEvent({ ...event, type: 'UPDATE', old_record: record })).toBeNull();
    expect(validateEvent({ ...event, type: 'UPDATE', old_record: { ...record, content: 'Old' } })).toBeTruthy();
    expect(validateEvent({ ...event, type: 'UPDATE', old_record: { ...record, image_url: 'old-image' } })).toBeTruthy();
  });
  it('rejects incomplete announcements', () => {
    expect(() => validateEvent({ ...event, record: { ...record, updated_at: 'bad' } })).toThrow();
    expect(() => validateEvent({ ...event, record: { ...record, content: '' } })).toThrow();
  });
  it('includes only employees and deduplicates profile IDs', () => {
    expect(employeeProfiles([{ json: { id, role: 'employee' } }, { json: { id, role: 'employee' } }, { json: { id: '22222222-2222-4222-8222-222222222222', role: 'admin' } }])).toHaveLength(1);
  });
  it('escapes markup, preserves Arabic and uses the Manila portal', () => {
    const [mail] = buildEmails([{ json: { email: 'employee@example.com' } }], config);
    expect(mail.json.html).toContain('&lt;script&gt;');
    expect(mail.json.html).not.toContain('<script>');
    expect(mail.json.html).toContain('مرحبا');
    expect(mail.json.html).toContain('Manila time');
    expect(mail.json.html).toContain(config.portalUrl);
  });
  it('sends individual messages and excludes invalid, banned, deleted and duplicate addresses', () => {
    const mails = buildEmails([
      { json: { email: 'one@example.com' } }, { json: { email: 'ONE@example.com' } },
      { json: { user: { email: 'two@example.com' } } },
      { json: { email: 'bad@example.com,other@example.com' } },
      { json: { email: 'banned@example.com', banned_until: '2999-01-01' } },
      { json: { email: 'deleted@example.com', deleted_at: '2026-01-01' } },
    ], config);
    expect(mails.map((m: any) => m.json.toEmail)).toEqual(['one@example.com', 'two@example.com']);
  });
  it('test mode sends only to the configured tester', () => {
    const mails = buildEmails([{ json: { email: 'employee@example.com' } }], { ...config, testMode: true, testEmail: 'tester@example.com' });
    expect(mails).toHaveLength(1);
    expect(mails[0].json.toEmail).toBe('tester@example.com');
    expect(mails[0].json.subject).toContain('[TEST]');
    expect(() => buildEmails([], { ...config, testMode: true, testEmail: '' })).toThrow();
  });
  it('does not embed external or unsafe image URLs', () => {
    const [mail] = buildEmails([{ json: { email: 'employee@example.com' } }], { ...config, announcement: { ...record, image_url: 'javascript:alert(1)' } });
    expect(mail.json.html).not.toContain('<img');
  });
});
