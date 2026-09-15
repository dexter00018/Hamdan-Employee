// These self-contained functions are embedded into n8n Code nodes by the builder.
export function validateEvent(body) {
  if (!body || body.schema !== 'public' || body.table !== 'announcements' || !['INSERT', 'UPDATE'].includes(body.type)) return null;
  const record = body.record;
  if (!record || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id ?? '') ||
      typeof record.content !== 'string' || !record.content.trim() || !Number.isFinite(Date.parse(record.updated_at))) {
    throw new Error('Invalid announcement event');
  }
  if (body.type === 'UPDATE' && body.old_record?.content === record.content &&
      (body.old_record?.image_url ?? null) === (record.image_url ?? null)) return null;
  return { announcement: { id: record.id, content: record.content, image_url: record.image_url, updated_at: record.updated_at } };
}

export function employeeProfiles(items) {
  const seen = new Set();
  return items.flatMap((item, index) => {
    const p = item.json;
    if (p.role !== 'employee' || !/^[0-9a-f-]{36}$/i.test(p.id ?? '') || seen.has(p.id)) return [];
    seen.add(p.id);
    return [{ json: { id: p.id }, pairedItem: { item: index } }];
  });
}

export function buildEmails(items, config) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const emailValid = (s) => typeof s === 'string' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s);
  if (typeof config.testMode !== 'boolean') throw new Error('Set testMode to true or false');
  if (!emailValid(config.fromEmail)) throw new Error('Configure a valid SMTP sender');
  if (config.testMode && !emailValid(config.testEmail)) throw new Error('Set Config.testEmail to your own email before testing');
  if (!config.portalUrl || !/^https:\/\/[^/]+\/employee$/.test(config.portalUrl) || config.portalUrl.includes('.example')) throw new Error('Verify the Manila portal URL before changing this workflow');
  const a = config.announcement;
  const seen = new Set();
  const recipients = [];
  for (const [index, item] of items.entries()) {
    const user = item.json.user ?? item.json;
    if (user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > Date.now()) || !emailValid(user.email)) continue;
    const email = user.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email: user.email, index });
  }
  if (config.testMode) {
    recipients.splice(0, recipients.length, { email: config.testEmail, index: 0 });
  }
  let image = '';
  // Only render images from this project's public announcement bucket.
  if (typeof a.image_url === 'string' && a.image_url.startsWith('https://msoomcjzzudibiyezclj.supabase.co/storage/v1/object/public/announcements/')) {
    image = `<p><img src="${esc(a.image_url)}" alt="Announcement image" width="536" style="max-width:100%;height:auto;border-radius:8px;"></p>`;
  }
  const timestamp = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short', hour12: true }).format(new Date(a.updated_at));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="padding:28px 32px;background:#0f172a;color:#fff;font-size:22px;font-weight:bold">Hamdan Studio</td></tr><tr><td style="padding:32px;color:#0f172a"><h1 style="font-size:22px;margin:0 0 12px">New announcement</h1><p style="color:#64748b;font-size:12px">${esc(timestamp)} · Manila time</p><div dir="auto" style="font-size:15px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere">${esc(a.content)}</div>${image}<p style="margin-top:28px"><a href="${esc(config.portalUrl)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-weight:bold">View announcement in portal →</a></p></td></tr></table></td></tr></table></body></html>`;
  return recipients.map(({ email, index }) => ({ json: {
    toEmail: email, fromEmail: config.fromEmail,
    subject: `${config.testMode ? '[TEST] ' : ''}Hamdan Studio — New announcement`, html,
    announcementId: a.id, announcementVersion: a.updated_at,
  }, pairedItem: { item: index } }));
}
