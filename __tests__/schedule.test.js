const { generateSlots, groupSlotsByDay } = require('../src/services/schedule');
const { DateTime, Interval } = require('luxon');

describe('Schedule Service', () => {
  describe('generateSlots', () => {
    test('devrait générer des créneaux pour une plage donnée', () => {
      const now = DateTime.now();
      const range = Interval.fromDateTimes(now, now.plus({ days: 7 }));
      
      const schedule = {
        timezone: 'Europe/Paris',
        slotDurationMinutes: 60,
        maxConcurrentPerSlot: 1,
        days: {
          mon: [{ start: '09:00', end: '11:00' }],
          tue: [{ start: '09:00', end: '11:00' }],
          wed: [{ start: '14:00', end: '16:00' }],
          thu: [],
          fri: [{ start: '09:00', end: '17:00' }],
          sat: [],
          sun: []
        },
        exceptions: {}
      };

      const slots = generateSlots(range, schedule);

      expect(Array.isArray(slots)).toBe(true);
      
      // Vérifier structure des créneaux
      if (slots.length > 0) {
        slots.forEach(slot => {
          expect(slot).toHaveProperty('start');
          expect(slot).toHaveProperty('end');
          expect(typeof slot.start).toBe('string');
          expect(typeof slot.end).toBe('string');
        });
      }
    });

    test('ne devrait pas générer de créneaux si aucun jour actif', () => {
      const now = DateTime.now();
      const range = Interval.fromDateTimes(now, now.plus({ days: 7 }));
      
      const schedule = {
        timezone: 'Europe/Paris',
        slotDurationMinutes: 60,
        maxConcurrentPerSlot: 1,
        days: {
          mon: [],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: []
        },
        exceptions: {}
      };

      const slots = generateSlots(range, schedule);
      expect(slots).toHaveLength(0);
    });
  });

  describe('groupSlotsByDay', () => {
    test('devrait grouper les créneaux par jour', () => {
      const now = DateTime.now();
      const tomorrow = now.plus({ days: 1 });
      
      const slots = [
        { id: '1', start: now.toISO(), end: now.plus({ hours: 1 }).toISO(), duration: 60 },
        { id: '2', start: now.plus({ hours: 2 }).toISO(), end: now.plus({ hours: 3 }).toISO(), duration: 60 },
        { id: '3', start: tomorrow.toISO(), end: tomorrow.plus({ hours: 1 }).toISO(), duration: 60 }
      ];

      const grouped = groupSlotsByDay(slots);

      expect(grouped).toHaveProperty('days');
      expect(Array.isArray(grouped.days)).toBe(true);
      expect(grouped.days.length).toBeGreaterThan(0);

      grouped.days.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('slots');
        expect(Array.isArray(day.slots)).toBe(true);
      });
    });

    test('devrait retourner tableau vide si aucun créneau', () => {
      const grouped = groupSlotsByDay([]);
      expect(grouped).toEqual({ days: [] });
    });
  });
});
