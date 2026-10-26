// Single icon entry point for the dashboard: renders the bundled custom
// SVG illustrations (suffix `_art`) or the Fluent 3D emoji renders.
// Keeps every call site addressable by plain string name.
import Icon3D from './Icon3D';
import IconPayslip from './IconPayslip';
import IconDisputes from './IconDisputes';
import IconCalendarLive from './IconCalendarLive';
import IconLeavePlanner from './IconLeavePlanner';
import IconHolidays from './IconHolidays';
import IconBeachCalendar from './IconBeachCalendar';
import IconDirectoryArt from './IconDirectoryArt';
import IconHistoryArt from './IconHistoryArt';
import IconStreakArt from './IconStreakArt';
import IconGlobeArt from './IconGlobeArt';

type Props = { name: string; size?: number; className?: string };

export default function AnyIcon({ name, size = 24, className = '' }: Props) {
  switch (name) {
    case 'payslip_art':
      return <IconPayslip size={size} className={className} />;
    case 'disputes_art':
      return <IconDisputes size={size} className={className} />;
    case 'calendar_live_art':
      return <IconCalendarLive size={size} className={className} />;
    case 'leave_art':
      return <IconLeavePlanner size={size} className={className} />;
    case 'holidays_art':
      return <IconHolidays size={size} className={className} />;
    case 'directory_art':
      return <IconDirectoryArt size={size} className={className} />;
    case 'history_art':
      return <IconHistoryArt size={size} className={className} />;
    case 'streak_art':
      return <IconStreakArt size={size} className={className} />;
    case 'globe_art':
      return <IconGlobeArt size={size} className={className} />;
    case 'beach_calendar_art':
      return <IconBeachCalendar size={size} className={className} />;
    default:
      return <Icon3D name={name} size={size} className={className} />;
  }
}
