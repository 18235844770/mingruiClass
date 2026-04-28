import { Prisma } from '@prisma/client';
import {
  mapConsumptionIdToRemainingAfter,
  type ConsumptionTimelineRow,
} from './consumption-remaining-after.util';

describe('mapConsumptionIdToRemainingAfter', () => {
  const t0 = new Date('2025-01-01T10:00:00.000Z');
  const t1 = new Date('2025-01-02T10:00:00.000Z');

  it('computes per-row remaining after each consumption', () => {
    const pageRows = [
      {
        id: 'c-old',
        studentCourseId: 'sc-1',
        studentCourse: { remainingHours: new Prisma.Decimal('5') },
      },
      {
        id: 'c-new',
        studentCourseId: 'sc-1',
        studentCourse: { remainingHours: new Prisma.Decimal('5') },
      },
    ];
    const timeline: ConsumptionTimelineRow[] = [
      {
        id: 'c-old',
        studentCourseId: 'sc-1',
        consumedHours: new Prisma.Decimal('2'),
        consumptionTime: t0,
        createdAt: t0,
      },
      {
        id: 'c-new',
        studentCourseId: 'sc-1',
        consumedHours: new Prisma.Decimal('3'),
        consumptionTime: t1,
        createdAt: t1,
      },
    ];
    const map = mapConsumptionIdToRemainingAfter(pageRows, timeline);
    expect(map.get('c-new')!.toString()).toBe('5');
    expect(map.get('c-old')!.toString()).toBe('8');
  });
});
