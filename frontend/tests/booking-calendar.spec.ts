import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaDateTime, agendaOffset } from '../src/app/shared/utils/booking-time.util.ts';
import { bookingCalendarDays, bookingDateKey, parseBookingDate } from '../src/app/features/booking/utils/booking-calendar.util.ts';

test('calendar starts on Monday and includes leap-day dates without spilling into the following month', () => {
  const cells = bookingCalendarDays(2024, 1, '2024-02-01');

  assert.equal(cells[0].date, '2024-01-29');
  assert.equal(cells[0].inCurrentMonth, false);
  assert.equal(cells.length, 35);
  assert.deepEqual(cells.find((cell) => cell.date === '2024-02-29'), {
    date: '2024-02-29', day: 29, inCurrentMonth: true, disabled: false
  });
});

test('calendar disables past dates and every day outside its displayed month', () => {
  const cells = bookingCalendarDays(2026, 0, '2026-01-15');

  assert.equal(cells.find((cell) => cell.date === '2026-01-14')?.disabled, true);
  assert.equal(cells.find((cell) => cell.date === '2026-01-15')?.disabled, false);
  assert.ok(cells.filter((cell) => !cell.inCurrentMonth).every((cell) => cell.disabled));
});

test('booking dates parse strictly and serialize using local calendar fields', () => {
  assert.equal(parseBookingDate('2026-02-29'), null);
  assert.equal(parseBookingDate('2026-02-28')?.getDate(), 28);
  assert.equal(bookingDateKey(new Date(2026, 0, 2)), '2026-01-02');
});

test('booking time uses Brussels offsets and the correct calendar day in winter and summer', () => {
  const winter = new Date('2027-01-15T23:30:00Z');
  const summer = new Date('2027-07-15T22:30:00Z');
  assert.deepEqual(agendaDateTime(winter), { date: '2027-01-16', time: '00:30' });
  assert.deepEqual(agendaDateTime(summer), { date: '2027-07-16', time: '00:30' });
  assert.equal(agendaOffset(winter, 'Europe/Brussels'), '+01:00');
  assert.equal(agendaOffset(summer, 'Europe/Brussels'), '+02:00');
  assert.deepEqual(agendaDateTime(winter, 'America/Sao_Paulo'), { date: '2027-01-15', time: '20:30' });
});
