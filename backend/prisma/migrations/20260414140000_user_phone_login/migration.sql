-- 登录账号改为手机号；username 仅作展示名称（取消唯一约束）

ALTER TABLE "users" ADD COLUMN "phone" TEXT;

UPDATE "users" SET "phone" = CASE "username"
  WHEN 'admin' THEN '13800000001'
  WHEN 'sales' THEN '13800000002'
  WHEN 'owner' THEN '13800000003'
  WHEN 'sales_a' THEN '13900000001'
  WHEN 'sales_b' THEN '13900000002'
  ELSE '199' || SUBSTRING(REPLACE("id", '-', ''), 1, 8)
END
WHERE "phone" IS NULL;

ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;

DROP INDEX IF EXISTS "users_username_key";

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

CREATE INDEX "users_username_idx" ON "users"("username");
