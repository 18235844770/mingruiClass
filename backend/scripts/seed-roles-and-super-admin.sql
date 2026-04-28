-- =============================================================================
-- 创建基础角色（admin / sales / owner）并插入超级管理员
-- 与 prisma/seed.ts 中角色定义及 SUPER_ADMIN_LOGIN_ACCOUNT 一致。
--
-- 前置：已执行建表（如 scripts/create-tables.sql 或 prisma migrate deploy）
--
-- 用法：
--   psql -U postgres -d mingrui_class -f scripts/seed-roles-and-super-admin.sql
--
-- 默认登录：手机号 13800000001，密码 admin123（bcrypt 成本因子 10）
-- 上线后请立即修改密码。需其他密码时可在 backend 目录执行：
--   node -e "require('bcryptjs').hash('新密码',10).then(console.log)"
-- 将下方 PASSWORD_HASH 替换为输出整串。
-- =============================================================================

BEGIN;

-- 角色（code 唯一；已存在则跳过，不改动已有 id）
INSERT INTO roles (id, code, name, created_at, updated_at) VALUES
  (gen_random_uuid()::text, 'admin',  '管理员', NOW(), NOW()),
  (gen_random_uuid()::text, 'sales',  '销售',   NOW(), NOW()),
  (gen_random_uuid()::text, 'owner',  '老板',   NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 超级管理员：users.phone 为登录账号（与代码常量一致）
INSERT INTO users (id, phone, username, password_hash, role_id, status, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  '13800000001',
  '管理员',
  '$2b$10$gRB2kqumJOjRAng642/.U.i3r7RCFcKJyJvk0HAbtjAZMC/eRqLHS',
  r.id,
  'active',
  NOW(),
  NOW()
FROM roles r
WHERE r.code = 'admin'
ON CONFLICT (phone) DO UPDATE SET
  username      = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  role_id       = EXCLUDED.role_id,
  status        = EXCLUDED.status,
  updated_at    = NOW();

COMMIT;
