'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type Dispute = { id: string; status: string; dispute_date: string; dispute_type?: string | null; original_time_in?: string | null; original_time_out?: string | null; claimed_time_in?: string | null; claimed_time_out?: string | null; reason?: string | null; hr_notes?: string | null; reviewed_at?: string | null; created_at: string; employee?: { full_name?: string | null } | null; reviewer?: { full_name?: string | null } | null };
type Props = { open: boolean; onClose: () => void; disputeClaimed: (dispute: Dispute) => string | null | undefined; disputeFieldLabel: (dispute: Dispute) => string; disputeOriginal: (dispute: Dispute) => string | null | undefined; disputeTypeLabel: (dispute: Dispute) => string; disputes: Dispute[]; formatPh: (iso: string) => string; selectedDisputeDetail: Dispute | null; setSelectedDisputeDetail: Dispatch<SetStateAction<Dispute | null>> };

export default function DisputeHistoryModal({ open, onClose, disputeClaimed, disputeFieldLabel, disputeOriginal, disputeTypeLabel, disputes, formatPh, selectedDisputeDetail, setSelectedDisputeDetail }: Props) {
  const close = () => { setSelectedDisputeDetail(null); onClose(); };
  return (
    <ModalShell open={open} onClose={close} title={selectedDisputeDetail ? 'Dispute Details' : 'Dispute History'} size="sm">
            <div className="overflow-y-auto flex-1">
              {selectedDisputeDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedDisputeDetail.employee?.full_name ?? 'Unknown'}</span>
                    <span className={selectedDisputeDetail.status === 'Approved' ? 'tag-present' : 'tag-late'}>{selectedDisputeDetail.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="tag-excused">{disputeTypeLabel(selectedDisputeDetail)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dispute Date</p>
                      <p className="text-slate-700 text-xs">{selectedDisputeDetail.dispute_date}</p>
                    </div>
                    {disputeOriginal(selectedDisputeDetail) && (
                      <div>
                        <p className="label-branded mb-0.5">Original {disputeFieldLabel(selectedDisputeDetail)}</p>
                        <p className="text-slate-700 text-xs">{formatPh(disputeOriginal(selectedDisputeDetail)!)}</p>
                      </div>
                    )}
                    <div>
                      <p className="label-branded mb-0.5">Claimed {disputeFieldLabel(selectedDisputeDetail)}</p>
                      <p className="text-slate-700 text-xs">{disputeClaimed(selectedDisputeDetail) ? formatPh(disputeClaimed(selectedDisputeDetail)!) : '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Employee&apos;s Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedDisputeDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedDisputeDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedDisputeDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedDisputeDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{selectedDisputeDetail.reviewer?.full_name ? ` by ${selectedDisputeDetail.reviewer.full_name}` : ''}</p>
                    )}
                    <p>Filed: {new Date(selectedDisputeDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : disputes.filter((d) => d.status !== 'Pending').length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-sm font-medium">No resolved disputes yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {disputes.filter((d) => d.status !== 'Pending').map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDisputeDetail(d)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</span>
                        <span className="text-slate-400 text-xs"> · {disputeTypeLabel(d)} · {d.dispute_date}</span>
                      </div>
                      <span className={d.status === 'Approved' ? 'tag-present' : 'tag-late'}>{d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={close}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
    </ModalShell>
  );
}
