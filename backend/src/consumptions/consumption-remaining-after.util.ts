import { Prisma } from '@prisma/client';

export type ConsumptionTimelineRow = {
  id: string;
  studentCourseId: string;
  consumedHours: Prisma.Decimal;
  consumptionTime: Date;
  createdAt: Date;
};

export type PageRowWithCourseRemaining = {
  id: string;
  studentCourseId: string;
  studentCourse: { remainingHours: Prisma.Decimal };
};

function compareConsumptionTimeline(
  a: ConsumptionTimelineRow,
  b: ConsumptionTimelineRow,
): number {
  const t = a.consumptionTime.getTime() - b.consumptionTime.getTime();
  if (t !== 0) return t;
  const ct = a.createdAt.getTime() - b.createdAt.getTime();
  if (ct !== 0) return ct;
  return a.id.localeCompare(b.id);
}

/**
 * 每条消课发生后的剩余课时 = 课程当前剩余 + 时间上晚于该条的所有消课的课时之和
 * （时间线顺序：consumptionTime → createdAt → id 升序）。
 */
export function mapConsumptionIdToRemainingAfter(
  pageRows: PageRowWithCourseRemaining[],
  timelineRows: ConsumptionTimelineRow[],
): Map<string, Prisma.Decimal> {
  const byCourse = new Map<string, ConsumptionTimelineRow[]>();
  for (const c of timelineRows) {
    const arr = byCourse.get(c.studentCourseId) ?? [];
    arr.push(c);
    byCourse.set(c.studentCourseId, arr);
  }
  for (const [, arr] of byCourse) {
    arr.sort(compareConsumptionTimeline);
  }

  const out = new Map<string, Prisma.Decimal>();
  for (const r of pageRows) {
    const ordered = byCourse.get(r.studentCourseId) ?? [];
    const idx = ordered.findIndex((c) => c.id === r.id);
    let sumLater = new Prisma.Decimal(0);
    if (idx !== -1) {
      for (let i = idx + 1; i < ordered.length; i++) {
        sumLater = sumLater.add(ordered[i].consumedHours);
      }
    }
    out.set(r.id, r.studentCourse.remainingHours.add(sumLater));
  }
  return out;
}
