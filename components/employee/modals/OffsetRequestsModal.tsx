'use client';
import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Props = { open: boolean; onClose: () => void; userId: string | null };
type Request = { id: string; eligible_hours: number; status: string; time_out_at: string; created_at: string };
export default function OffsetRequestsModal({ open, onClose, userId }: Props) {
  const [requests, setRequests] = useState<Request[]>([]); const [balance, setBalance] = useState(0); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!userId) return; (async () => { setLoading(true); const [{ data: r }, { data: t }] = await Promise.all([supabase.from('offset_requests').select('id,eligible_hours,status,time_out_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }), supabase.from('offset_transactions').select('kind,hours').eq('user_id', userId)]); setRequests((r || []) as Request[]); setBalance((t || []).reduce((n, x: any) => n + (x.kind === 'earned' ? x.hours : -x.hours), 0)); setLoading(false); })(); }, [userId]);
  return <ModalShell open={open} onClose={onClose} title="Offset Request" description="Hours completed after 7:00 PM Manila time are rounded down and sent to HR for approval." icon={<Clock3 size={20} />} size="md"><div className="space-y-4"><div className="rounded-2xl bg-cyan-50 p-4 dark:bg-cyan-950/30"><p className="text-xs text-slate-500">Available approved offset</p><p className="text-3xl font-bold text-cyan-700 dark:text-cyan-300">{balance} hrs</p><p className="text-xs text-slate-500">9 approved hours can be converted to one paid leave day by HR.</p></div>{loading ? <p>Loading…</p> : <div className="space-y-2">{requests.length ? requests.map(r => <div key={r.id} className="flex items-center justify-between rounded-xl border p-3"><div><b>{r.eligible_hours} hour{r.eligible_hours !== 1 ? 's' : ''}</b><p className="text-xs text-slate-500">Timed out {new Date(r.time_out_at).toLocaleString()}</p></div><span className="text-xs font-semibold">{r.status}</span></div>) : <p className="text-sm text-slate-500">No offset requests yet.</p>}</div>}</div></ModalShell>;
}
