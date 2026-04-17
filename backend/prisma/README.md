# Prisma 使用说明

## 环境变量

复制 `backend/.env.example` 为 `backend/.env`，填写可用的 PostgreSQL 连接串：

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/mingrui_class?schema=public"
```

## 迁移顺序（第三阶段）

| 目录 | 说明 |
| --- | --- |
| `migrations/20260401120000_phase3_business_tables` | 初版业务表（roles / students / …） |
| `migrations/20260402120000_soft_delete_and_partial_unique` | 软删除字段 + 同校区姓名部分唯一索引 |

## 应用迁移与种子

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
```

开发环境（交互式）：

```bash
npx prisma migrate dev
```

## 验证

见仓库根目录 **`第三阶段-数据库验证清单.md`**（3.5）。

## 说明

- 若本地曾用旧 schema（无 `roles`、用户仅 `roleCode`）建过库，请使用**空库**或 `npx prisma migrate reset`（**会清空数据**）后再执行上述命令。  
- 种子脚本含 **演示学生 / 演示课程 / 演示消课**（幂等，见 `prisma/seed.ts`）。
