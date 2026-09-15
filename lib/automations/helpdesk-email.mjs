// Self-contained functions embedded into n8n Code nodes by the workflow builder.
export function helpdeskEvent(body) {
  if (body?.schema !== 'public' || body.table !== 'employee_support_requests' || !['INSERT', 'UPDATE'].includes(body.type)) return null;
  const r = body.record;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!r || !uuid.test(r.id ?? '') || !uuid.test(r.user_id ?? '') || typeof r.description !== 'string' || typeof r.category !== 'string') throw new Error('Invalid helpdesk record');
  if (body.type === 'UPDATE') {
    if (!body.old_record || body.old_record.user_id !== r.user_id) throw new Error('Invalid helpdesk update');
    if (typeof r.hr_notes !== 'string' || !r.hr_notes.trim() || r.hr_notes.trim() === String(body.old_record.hr_notes ?? '').trim()) return null;
  }
  return { kind: body.type === 'INSERT' ? 'request' : 'reply', request: r };
}

export function helpdeskEmail(event, authResponse, config) {
  const user = authResponse.user ?? authResponse;
  const r = event.request;
  if (user.id !== r.user_id) throw new Error('Requestor identity mismatch');
  const validEmail = (s) => typeof s === 'string' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s);
  if (typeof config.testMode !== 'boolean' || (config.testMode && !validEmail(config.testEmail))) throw new Error('Configure testMode and a valid testEmail');
  if (!['request', 'reply'].includes(event.kind)) throw new Error('Invalid notification kind');
  if (event.kind === 'reply' && (user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > Date.now()))) return null;
  if (event.kind === 'reply' && !validEmail(user.email)) throw new Error('Requestor has no valid email');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const oneLine = (s, max) => String(s ?? '').replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const category = oneLine(r.category, 60) || 'Help Desk';
  const summary = oneLine(r.subject, 120) || oneLine(r.description, 120) || 'HR Request';
  const reply = event.kind === 'reply';
  const title = reply ? 'HR replied to your request' : 'New Help Desk Request';
  if (!config.portalUrl || !/^https:\/\/[^/]+$/.test(config.portalUrl) || config.portalUrl.includes('.example') || !validEmail(config.fromEmail) || !validEmail(config.hrEmail)) throw new Error('Configure Manila portalUrl, fromEmail and hrEmail');
  const portal = config.portalUrl + (reply ? '/employee' : '/hr');
  const date = new Date((reply ? r.updated_at : r.created_at) ?? '');
  const timestamp = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short', hour12: true }).format(date) + ' · Manila time' : 'See portal for timestamp';
  const details = [['Category', category], ['Subject', summary], ['Requestor email', validEmail(user.email) ? user.email : 'Not available'], ['Status', r.status ?? 'Open'], ['Request ID', r.id], ['Date', timestamp]];
  const rows = details.map(([label, value]) => `<tr><td style="padding:10px 12px;color:#64748b;vertical-align:top;width:125px">${esc(label)}</td><td style="padding:10px 12px;overflow-wrap:anywhere" dir="auto">${esc(value)}</td></tr>`).join('');
  const content = (text) => `<div dir="auto" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.7">${esc(text)}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6f4;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#10241c;padding:28px 32px;color:#fff;font-size:23px;font-weight:bold">Hamdan Studio<div style="font-size:12px;font-weight:normal;color:#c3d5c9;margin-top:8px">HELP DESK / HR REQUEST</div></td></tr><tr><td style="padding:30px 32px"><span style="background:#e7f4eb;color:#245a3a;padding:7px 12px;border-radius:16px;font-size:12px">${reply ? 'HR RESPONSE' : 'NEW REQUEST'}</span><h1 style="font-size:23px;margin:22px 0 18px">${title}</h1><table role="presentation" width="100%" style="background:#f5f8f6;border:1px solid #dce7df;border-radius:8px;font-size:13px">${rows}</table>${reply ? `<h2 style="font-size:16px;margin-top:26px">HR response</h2>${content(r.hr_notes)}` : ''}<h2 style="font-size:16px;margin-top:26px">${reply ? 'Your original request' : 'Request description'}</h2>${content(r.description)}<p style="margin:28px 0 16px"><a href="${portal}" style="display:inline-block;background:#10241c;color:#fff;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:bold">${reply ? 'View your request' : 'Open HR Help Desk'} →</a></p><p style="font-size:12px;color:#64748b;line-height:1.6">Open Help Desk in the portal to view this request and continue the conversation. Email replies are not added to the portal.</p></td></tr></table></td></tr></table></body></html>`;
  return { fromEmail: config.fromEmail, toEmail: config.testMode ? config.testEmail : reply ? user.email : config.hrEmail, subject: `${config.testMode ? '[TEST] ' : ''}${category} - ${summary}`, html, requestId: r.id, kind: event.kind };
}
