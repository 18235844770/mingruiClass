-- =============================================================================
-- 明睿教务：空库建表脚本（PostgreSQL）
-- 与当前 prisma/schema.prisma 一致；并含「同校区未删除学生姓名唯一」部分索引。
--
-- 用法（在已存在的数据库上，例如 mingrui_class）：
--   psql -U postgres -d mingrui_class -f scripts/create-tables.sql
--
-- 注意：
-- - 仅适用于空库或确认无同名表。若已有表请勿重复执行。
-- - 生产环境更推荐使用：npx prisma migrate deploy（会维护 _prisma_migrations）。
--   若只用本脚本建表，后续再执行 migrate deploy 可能冲突；二选一或自行对齐迁移表。
-- - 重新生成本文件：npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_campuses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "grade" TEXT,
    "gender" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_status" BOOLEAN NOT NULL,
    "remark" TEXT,
    "campus_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_courses" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "course_price" DECIMAL(12,2) NOT NULL,
    "paid_status" BOOLEAN NOT NULL DEFAULT false,
    "total_hours" DECIMAL(10,2) NOT NULL,
    "remaining_hours" DECIMAL(10,2) NOT NULL,
    "course_type" TEXT NOT NULL,
    "remark" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_consumptions" (
    "id" TEXT NOT NULL,
    "student_course_id" TEXT NOT NULL,
    "consumed_hours" DECIMAL(10,2) NOT NULL,
    "consumption_time" TIMESTAMP(3) NOT NULL,
    "operator_id" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "detail" JSONB,
    "campus_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "user_campuses_campus_id_idx" ON "user_campuses"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_campuses_user_id_campus_id_key" ON "user_campuses"("user_id", "campus_id");

-- CreateIndex
CREATE INDEX "students_campus_id_name_idx" ON "students"("campus_id", "name");

-- CreateIndex
CREATE INDEX "students_campus_id_created_by_idx" ON "students"("campus_id", "created_by");

-- CreateIndex
CREATE INDEX "students_campus_id_grade_idx" ON "students"("campus_id", "grade");

-- CreateIndex
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");

-- 同校区内「未软删除」学生姓名唯一（迁移 20260402120000，Prisma schema 无对应声明）
CREATE UNIQUE INDEX "students_campus_id_name_active_key" ON "students"("campus_id", "name") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "student_courses_student_id_idx" ON "student_courses"("student_id");

-- CreateIndex
CREATE INDEX "student_courses_deleted_at_idx" ON "student_courses"("deleted_at");

-- CreateIndex
CREATE INDEX "course_consumptions_student_course_id_idx" ON "course_consumptions"("student_course_id");

-- CreateIndex
CREATE INDEX "course_consumptions_consumption_time_idx" ON "course_consumptions"("consumption_time");

-- CreateIndex
CREATE INDEX "course_consumptions_operator_id_idx" ON "course_consumptions"("operator_id");

-- CreateIndex
CREATE INDEX "operation_logs_operator_id_idx" ON "operation_logs"("operator_id");

-- CreateIndex
CREATE INDEX "operation_logs_campus_id_idx" ON "operation_logs"("campus_id");

-- CreateIndex
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs"("created_at");

-- CreateIndex
CREATE INDEX "operation_logs_deleted_at_idx" ON "operation_logs"("deleted_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_campuses" ADD CONSTRAINT "user_campuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_campuses" ADD CONSTRAINT "user_campuses_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_consumptions" ADD CONSTRAINT "course_consumptions_student_course_id_fkey" FOREIGN KEY ("student_course_id") REFERENCES "student_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_consumptions" ADD CONSTRAINT "course_consumptions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
