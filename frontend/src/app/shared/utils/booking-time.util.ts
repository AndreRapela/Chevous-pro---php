export const BOOKING_TIMEZONE = 'Europe/Brussels';

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

export function agendaDateTime(instant: Date, timezone = BOOKING_TIMEZONE): { date: string; time: string } {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    dateFormatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`, time: `${parts['hour']}:${parts['minute']}` };
}

export function agendaOffset(instant: Date, timezone: string): string {
  let formatter = offsetFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'longOffset' });
    offsetFormatters.set(timezone, formatter);
  }
  const offset = formatter.formatToParts(instant).find(({ type }) => type === 'timeZoneName')?.value;
  return offset?.replace(/^GMT/, '') || '+00:00';
}
