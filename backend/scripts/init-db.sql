-- 1️⃣ 创建或修改用户
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mingrui_user') THEN
    CREATE ROLE mingrui_user LOGIN PASSWORD 'StrongPassword_ChangeMe';
  ELSE
    ALTER ROLE mingrui_user WITH LOGIN PASSWORD 'StrongPassword_ChangeMe';
  END IF;
END
$$;

-- ⚠️ 2️⃣ CREATE DATABASE 必须单独执行，不能在 DO 块里
-- 请在 shell 里先执行：
-- psql -U postgres -d postgres -c "CREATE DATABASE mingrui_class OWNER mingrui_user;"

-- 3️⃣ 连接目标数据库
\connect mingrui_class

-- 4️⃣ 授权
GRANT ALL PRIVILEGES ON DATABASE mingrui_class TO mingrui_user;

-- 5️⃣ Schema 权限
GRANT USAGE, CREATE ON SCHEMA public TO mingrui_user;
ALTER SCHEMA public OWNER TO mingrui_user;
ALTER DATABASE mingrui_class OWNER TO mingrui_user;

-- 6️⃣ 默认权限，保证以后新建表/序列都归用户
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO mingrui_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO mingrui_user;