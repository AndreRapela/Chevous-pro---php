export interface BookingCalendarDay {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  disabled: boolean;
}

export function parseBookingDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? date
    : null;
}

export function bookingDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function bookingCalendarDays(year: number, month: number, minimumDate: string): BookingCalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - leadingDays + 1);
    const key = bookingDateKey(date);
    const inCurrentMonth = date.getMonth() === month;
    return { date: key, day: date.getDate(), inCurrentMonth, disabled: !inCurrentMonth || key < minimumDate };
  });
}
