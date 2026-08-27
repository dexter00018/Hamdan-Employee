import {
  CalendarClock,
  CarFront,
  CircleAlert,
  Clock3,
  FileText,
  HandCoins,
  Headphones,
  Plane,
} from 'lucide-react';

type Props = {
  attendanceLabel: 'Time In' | 'Time Out' | 'Completed';
  attendanceDisabled: boolean;
  onAttendanceAction: () => void;
  onAttendanceHistory: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onDocuments: () => void;
  onCommute: () => void;
  onHelpdesk: () => void;
};

export default function EmployeeQuickActions({
  attendanceLabel,
  attendanceDisabled,
  onAttendanceAction,
  onAttendanceHistory,
  onLeave,
  onDisputes,
  onPayslips,
  onDocuments,
  onCommute,
  onHelpdesk,
}: Props) {
  const actions = [
    { label: attendanceLabel, icon: Clock3, action: onAttendanceAction, disabled: attendanceDisabled },
    { label: 'Attendance', icon: CalendarClock, action: onAttendanceHistory },
    { label: 'My Leave', icon: Plane, action: onLeave },
    { label: 'Disputes', icon: CircleAlert, action: onDisputes },
    { label: 'Payslips', icon: HandCoins, action: onPayslips },
    { label: 'Documents', icon: FileText, action: onDocuments },
    { label: 'Commute', icon: CarFront, action: onCommute },
    { label: 'Helpdesk', icon: Headphones, action: onHelpdesk },
  ];

  return (
    <section aria-labelledby="employee-quick-actions-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="employee-quick-actions-title" className="text-base font-semibold sm:text-lg">Quick Actions</h2>
          <p className="mt-0.5 text-xs text-slate-500">Your most-used employee tools</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {actions.map(({ label, icon: Icon, action, disabled }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            disabled={disabled}
            className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition hover:border-green-200 hover:bg-green-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#292f2b] dark:hover:border-green-700 dark:hover:bg-[#263b2f] sm:px-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-green-50 text-[#16a34a] dark:bg-[#263b2f] dark:text-[#8ee6a7]">
              <Icon aria-hidden="true" size={19} strokeWidth={2} />
            </span>
            <span className="w-full truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200 sm:text-xs">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
