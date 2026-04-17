-- Ensure a second campus exists for switch-campus checks

INSERT INTO campuses (id, name, status, created_at, updated_at)

SELECT '22222222-2222-4222-8222-222222222222', '自检校区2-UUID', 'active', NOW(), NOW()

WHERE NOT EXISTS (

  SELECT 1 FROM campuses WHERE id = '22222222-2222-4222-8222-222222222222'

);



INSERT INTO campuses (id, name, status, created_at, updated_at)

SELECT 'selfcheck-campus-2', '自检校区2', 'active', NOW(), NOW()

WHERE NOT EXISTS (

  SELECT 1 FROM campuses WHERE name = '自检校区2'

);



-- Ensure sales_a and sales_b users exist, reusing seed password hash

INSERT INTO users (id, username, phone, password_hash, role_id, status, created_at, updated_at)

SELECT 'selfcheck-sales-a', '销售A-自检', '13900000001', admin_u.password_hash, sales_r.id, 'active', NOW(), NOW()

FROM users admin_u

JOIN roles sales_r ON sales_r.code = 'sales'

WHERE admin_u.phone = '13800000001'

  AND NOT EXISTS (SELECT 1 FROM users WHERE id = 'selfcheck-sales-a');



INSERT INTO users (id, username, phone, password_hash, role_id, status, created_at, updated_at)

SELECT 'selfcheck-sales-b', '销售B-自检', '13900000002', admin_u.password_hash, sales_r.id, 'active', NOW(), NOW()

FROM users admin_u

JOIN roles sales_r ON sales_r.code = 'sales'

WHERE admin_u.phone = '13800000001'

  AND NOT EXISTS (SELECT 1 FROM users WHERE id = 'selfcheck-sales-b');



-- Bind sales_a to primary campus and second campus

INSERT INTO user_campuses (id, user_id, campus_id, created_at, updated_at)

SELECT 'selfcheck-uc-a-c1', u.id, c.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.name = '示例校区'

WHERE u.id = 'selfcheck-sales-a'

  AND NOT EXISTS (

    SELECT 1 FROM user_campuses uc WHERE uc.user_id = u.id AND uc.campus_id = c.id

  );



INSERT INTO user_campuses (id, user_id, campus_id, created_at, updated_at)

SELECT 'selfcheck-uc-a-c2-uuid', u.id, c.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.id = '22222222-2222-4222-8222-222222222222'

WHERE u.id = 'selfcheck-sales-a'

  AND NOT EXISTS (

    SELECT 1 FROM user_campuses uc WHERE uc.user_id = u.id AND uc.campus_id = c.id

  );



-- Bind sales_b to primary campus only

INSERT INTO user_campuses (id, user_id, campus_id, created_at, updated_at)

SELECT 'selfcheck-uc-b-c1', u.id, c.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.name = '示例校区'

WHERE u.id = 'selfcheck-sales-b'

  AND NOT EXISTS (

    SELECT 1 FROM user_campuses uc WHERE uc.user_id = u.id AND uc.campus_id = c.id

  );



-- Seed visible test students with clear names (idempotent)

INSERT INTO students (

  id, name, phone, total_amount, paid_status, remark, campus_id, created_by, created_at, updated_at

)

SELECT

  'selfcheck-student-a-c1', '自检学生-A-C1', NULL, 1000.00, TRUE, 'phase4-self-check', c.id, u.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.name = '示例校区'

WHERE u.id = 'selfcheck-sales-a'

  AND NOT EXISTS (

    SELECT 1 FROM students s

    WHERE s.name = '自检学生-A-C1'

      AND s.campus_id = c.id

      AND s.created_by = u.id

      AND s.deleted_at IS NULL

  );



INSERT INTO students (

  id, name, phone, total_amount, paid_status, remark, campus_id, created_by, created_at, updated_at

)

SELECT

  'selfcheck-student-b-c1', '自检学生-B-C1', NULL, 1000.00, TRUE, 'phase4-self-check', c.id, u.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.name = '示例校区'

WHERE u.id = 'selfcheck-sales-b'

  AND NOT EXISTS (

    SELECT 1 FROM students s

    WHERE s.name = '自检学生-B-C1'

      AND s.campus_id = c.id

      AND s.created_by = u.id

      AND s.deleted_at IS NULL

  );



INSERT INTO students (

  id, name, phone, total_amount, paid_status, remark, campus_id, created_by, created_at, updated_at

)

SELECT

  'selfcheck-student-a-c2-uuid', '自检学生-A-C2', NULL, 1000.00, TRUE, 'phase4-self-check', c.id, u.id, NOW(), NOW()

FROM users u

JOIN campuses c ON c.id = '22222222-2222-4222-8222-222222222222'

WHERE u.id = 'selfcheck-sales-a'

  AND NOT EXISTS (

    SELECT 1 FROM students s

    WHERE s.name = '自检学生-A-C2'

      AND s.campus_id = c.id

      AND s.created_by = u.id

      AND s.deleted_at IS NULL

  );

