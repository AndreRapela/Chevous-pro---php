import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasOverlappingRules, mergeAvailableSlots, providerIdsForSlot } from '../src/app/features/booking/utils/availability.util.ts';

describe('availability utilities', () => {
  it('combina horários sem duplicação e em ordem', () => {
    assert.deepEqual(mergeAvailableSlots([
      { providerId: 'a', slots: ['09:30', '08:00'] },
      { providerId: 'b', slots: ['08:00', '10:00'] }
    ]), ['08:00', '09:30', '10:00']);
  });

  it('encontra somente os profissionais disponíveis no horário', () => {
    assert.deepEqual([...providerIdsForSlot([
      { providerId: 'a', slots: ['08:00'] },
      { providerId: 'b', slots: ['09:00'] },
      { providerId: 'c', slots: ['08:00', '09:00'] }
    ], '08:00')], ['a', 'c']);
  });

  it('aceita faixas contíguas e rejeita sobreposição', () => {
    assert.equal(hasOverlappingRules([
      { weekday: 1, startTime: '08:00', endTime: '12:00' },
      { weekday: 1, startTime: '12:00', endTime: '17:00' }
    ]), false);
    assert.equal(hasOverlappingRules([
      { weekday: 1, startTime: '08:00', endTime: '12:30' },
      { weekday: 1, startTime: '12:00', endTime: '17:00' }
    ]), true);
  });
});
