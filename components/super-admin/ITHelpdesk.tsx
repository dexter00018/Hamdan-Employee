'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
const t = (text: string) => text;
import HelpDeskRequestsModal, { type HelpdeskRequest } from '@/components/hr/modals/HelpDeskRequestsModal';

export default function ITHelpdesk({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<HelpdeskRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { status: string; hr_notes: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await supabase.from('employee_support_requests').select('*').eq('category', 'IT Concern').order('created_at', { ascending: false });
      if (result.error) throw result.error;
      const rows = result.data || [];
      const ids = [...new Set(rows.map(r => r.user_id))];
      const profiles = ids.length ? await supabase.from('profiles').select('id,full_name,employee_id').in('id', ids) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const byId = new Map((profiles.data || []).map(p => [p.id, p]));
      setRequests(rows.map(r => ({ ...r, employee: byId.get(r.user_id) || null })));
      setDrafts(Object.fromEntries(rows.map(r => [r.id, { status: r.status, hr_notes: r.hr_notes || '' }])));
    } catch (e) { setError(e instanceof Error ? e.message : t('Unable to load requests.')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  async function save(id: string) {
    const draft = drafts[id];
    if (!draft || ['Resolved', 'Cancelled'].includes(requests.find(r => r.id === id)?.status || '')) return;
    setSavingId(id);
    setError('');
    try {
      const result = await supabase.from('employee_support_requests').update({ status: draft.status, hr_notes: draft.hr_notes.trim() || null }).eq('id', id).eq('category', 'IT Concern').not('status', 'in', '(Resolved,Cancelled)').select('id').maybeSingle();
      if (result.error || !result.data) window.alert(t('Unable to save. The ticket may already be resolved.'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Unable to save. The ticket may already be resolved.'));
    } finally { setSavingId(null); }
  }
  return <HelpDeskRequestsModal department="IT" open={open} onClose={onClose} error={error} loading={loading} requests={requests} drafts={drafts} setDrafts={setDrafts} savingId={savingId} onSave={save} />;
}
