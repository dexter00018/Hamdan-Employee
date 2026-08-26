// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function AppSettingsModal({ context }: { context: Record<string, any> }) {
  const { Spinner, appSettings, appSettingsLoading, appSettingsModalOpen, appSettingsMsg, appSettingsSaving, saveAppSettings, setAppSettings, setAppSettingsModalOpen } = context;
  return (
    <>
      {/* APP SETTINGS MODAL */}
      {appSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center text-base flex-shrink-0">⚙️</span>
                <h3 className="mb-0">App Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setAppSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {appSettingsMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${appSettingsMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {appSettingsMsg.text}
              </div>
            )}

            {appSettingsLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading settings...</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="label-branded">Late Cutoff Time</label>
                  <p className="text-slate-400 text-[11px] mb-2">Time-ins after this are tagged &quot;Late&quot;. Used by Time In, attendance history, and dispute review.</p>
                  <div className="flex items-center gap-2">
                    <select
                      className="input-field"
                      value={appSettings.late_cutoff_hour}
                      onChange={(e) => setAppSettings((s) => ({ ...s, late_cutoff_hour: parseInt(e.target.value, 10) }))}
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select
                      className="input-field"
                      value={appSettings.late_cutoff_minute}
                      onChange={(e) => setAppSettings((s) => ({ ...s, late_cutoff_minute: parseInt(e.target.value, 10) }))}
                    >
                      {[0, 5, 10, 15, 16, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-slate-400 text-xs">(24h, PH time)</span>
                  </div>
                </div>

                <div>
                  <label className="label-branded">Default Leave Credits (per year)</label>
                  <p className="text-slate-400 text-[11px] mb-2">Applied to new Regular employees. Doesn&apos;t retroactively change existing employees&apos; credits.</p>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={appSettings.default_leave_credits}
                    onChange={(e) => setAppSettings((s) => ({ ...s, default_leave_credits: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>

                <div>
                  <label className="label-branded">Time-Out Reminder Hour</label>
                  <p className="text-slate-400 text-[11px] mb-2">Employees get a &quot;don&apos;t forget to time out&quot; reminder starting this hour (24h, PH time).</p>
                  <select
                    className="input-field"
                    value={appSettings.time_out_reminder_hour}
                    onChange={(e) => setAppSettings((s) => ({ ...s, time_out_reminder_hour: parseInt(e.target.value, 10) }))}
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="label-branded mb-1">Employee Service Settings</p>
                  <p className="text-slate-400 text-[11px] mb-4">Shared controls for the Employee and HR modules.</p>

                  <label className="label-branded">Help Desk Response Target (hours)</label>
                  <p className="text-slate-400 text-[11px] mb-2">Target time for HR to respond to a newly submitted employee request.</p>
                  <input type="number" min={1} max={168} className="input-field mb-4" value={appSettings.support_response_target_hours} onChange={(e) => setAppSettings((s) => ({ ...s, support_response_target_hours: Math.max(1, parseInt(e.target.value, 10) || 1) }))} />

                  <label className="label-branded">Payslip Acknowledgment Reminder (days)</label>
                  <p className="text-slate-400 text-[11px] mb-2">How many days after publishing before an unacknowledged payslip is considered overdue.</p>
                  <input type="number" min={1} max={30} className="input-field mb-4" value={appSettings.payslip_ack_reminder_days} onChange={(e) => setAppSettings((s) => ({ ...s, payslip_ack_reminder_days: Math.max(1, parseInt(e.target.value, 10) || 1) }))} />

                  <label className="label-branded">Dashboard Auto-Refresh (seconds)</label>
                  <p className="text-slate-400 text-[11px] mb-2">Recommended live-data refresh interval. Minimum 30 seconds to avoid excessive queries.</p>
                  <input type="number" min={30} max={600} step={10} className="input-field" value={appSettings.dashboard_refresh_seconds} onChange={(e) => setAppSettings((s) => ({ ...s, dashboard_refresh_seconds: Math.min(600, Math.max(30, parseInt(e.target.value, 10) || 60)) }))} />
                </div>

                <button
                  type="button"
                  onClick={saveAppSettings}
                  disabled={appSettingsSaving}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {appSettingsSaving ? (
                    <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Saving...</span>
                  ) : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
