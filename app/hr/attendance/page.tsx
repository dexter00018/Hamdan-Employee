import type { Metadata } from 'next';
import HRPortal from '@/components/hr/HRPortal';

export const metadata: Metadata = { title: 'Attendance History | Hamdan HR' };

export default async function HRAttendancePage({ searchParams }: PageProps<'/hr/attendance'>) {
  const params = await searchParams;
  const employee = typeof params.employee === 'string' ? params.employee : '';
  return <HRPortal view="attendance" initialEmployeeId={employee} />;
}
