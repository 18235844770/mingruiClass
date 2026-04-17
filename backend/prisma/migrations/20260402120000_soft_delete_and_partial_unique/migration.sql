-- 3.4 软删除字段 + 同校区姓名「仅未删除」唯一（部分唯一索引）

ALTER TABLE "students" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "student_courses" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "operation_logs" ADD COLUMN "deleted_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "students_campus_id_name_key";

CREATE UNIQUE INDEX "students_campus_id_name_active_key" ON "students"("campus_id", "name") WHERE "deleted_at" IS NULL;

CREATE INDEX "students_campus_id_name_idx" ON "students"("campus_id", "name");
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");
CREATE INDEX "student_courses_deleted_at_idx" ON "student_courses"("deleted_at");
CREATE INDEX "operation_logs_deleted_at_idx" ON "operation_logs"("deleted_at");
