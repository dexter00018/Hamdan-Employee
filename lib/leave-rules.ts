export function countChargeableLeaveDays(start: string, end: string, holidayDates: Iterable<string> = []) {
  const holidays = new Set(holidayDates);
  const cursor = new Date(`${start}T00:00:00Z`);
  const lastDay = new Date(`${end}T00:00:00Z`);
  let count = 0;

  while (cursor <= lastDay) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(dateKey)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
