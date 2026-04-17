-- Per-course payment flag; student totals derived from courses
ALTER TABLE "student_courses" ADD COLUMN "paid_status" BOOLEAN NOT NULL DEFAULT false;

-- Seed course-level paid flag from existing student-level flag (best-effort for legacy rows)
UPDATE "student_courses" sc
SET "paid_status" = s."paid_status"
FROM "students" s
WHERE sc."student_id" = s."id" AND sc."deleted_at" IS NULL;

-- Recompute student total_amount from sum of active course prices
UPDATE "students" s
SET "total_amount" = COALESCE(t.sum_price, 0)
FROM (
  SELECT "student_id", SUM("course_price") AS sum_price
  FROM "student_courses"
  WHERE "deleted_at" IS NULL
  GROUP BY "student_id"
) t
WHERE s."id" = t."student_id" AND s."deleted_at" IS NULL;

UPDATE "students" s
SET "total_amount" = 0
WHERE s."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "student_courses" sc
    WHERE sc."student_id" = s."id" AND sc."deleted_at" IS NULL
  );

-- Student paid = has at least one active course and all are paid
UPDATE "students" s
SET "paid_status" = EXISTS (
    SELECT 1 FROM "student_courses" sc
    WHERE sc."student_id" = s."id" AND sc."deleted_at" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "student_courses" sc
    WHERE sc."student_id" = s."id" AND sc."deleted_at" IS NULL AND sc."paid_status" = false
  )
WHERE s."deleted_at" IS NULL;
