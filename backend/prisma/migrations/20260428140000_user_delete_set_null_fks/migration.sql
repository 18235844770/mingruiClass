-- 删除用户时：学生建档人、消课操作人、操作日志操作人改为可空并 ON DELETE SET NULL，避免外键阻止删除

ALTER TABLE "students" DROP CONSTRAINT "students_created_by_fkey";
ALTER TABLE "students" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "course_consumptions" DROP CONSTRAINT "course_consumptions_operator_id_fkey";
ALTER TABLE "course_consumptions" ALTER COLUMN "operator_id" DROP NOT NULL;
ALTER TABLE "course_consumptions" ADD CONSTRAINT "course_consumptions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operation_logs" DROP CONSTRAINT "operation_logs_operator_id_fkey";
ALTER TABLE "operation_logs" ALTER COLUMN "operator_id" DROP NOT NULL;
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
