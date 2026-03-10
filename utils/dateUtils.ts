export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEndDate(date: Date): Date {
  const start = getWeekStartDate(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}\u2013${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} \u2013 ${endMonth} ${end.getDate()}`;
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function daysUntil(dateStr: string): number {
  if (!dateStr || dateStr.trim().length === 0) return 0;
  const target = parseDate(dateStr);
  if (isNaN(target.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPace(miles: number, totalSeconds: number): string {
  if (miles <= 0 || totalSeconds <= 0) return '--';
  const paceSeconds = totalSeconds / miles;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
}

export function getWeeksInRange(startDate: Date, endDate: Date): Date[][] {
  const weeks: Date[][] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    weeks.push(getWeekDates(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
