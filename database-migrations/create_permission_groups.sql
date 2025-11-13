-- ============================================================================
-- PERMISSION GROUPS CREATION AND ASSIGNMENT
-- Tạo các nhóm phân quyền và gán permissions vào từng nhóm
-- ============================================================================

-- Step 1: Create Permission Groups
-- ============================================================================

INSERT INTO permission_groups (id, name, description, color, icon, sort_order, is_active)
VALUES
-- Core System Groups
('11111111-1111-1111-1111-111111111111', 'Quản trị hệ thống', 'Các quyền quản trị và cấu hình hệ thống cốt lõi', '#FF5722', 'shield-check', 1, TRUE),
('22222222-2222-2222-2222-222222222222', 'Quản lý tổ chức', 'Quản lý tổ chức, phòng ban và cấu trúc', '#2196F3', 'building', 2, TRUE),
('33333333-3333-3333-3333-333333333333', 'Quản lý người dùng', 'Quản lý tài khoản người dùng và thông tin', '#4CAF50', 'users', 3, TRUE),
('44444444-4444-4444-4444-444444444444', 'Quản lý vai trò & quyền', 'Quản lý roles, permissions và phân quyền', '#9C27B0', 'user-lock', 4, TRUE),

-- Business Logic Groups
('55555555-5555-5555-5555-555555555555', 'Quản lý thiết bị', 'Quản lý thiết bị, models và cấu hình thiết bị', '#FF9800', 'devices', 5, TRUE),
('66666666-6666-6666-6666-666666666666', 'Quản lý dữ liệu', 'Quản lý dữ liệu từ thiết bị và xử lý dữ liệu', '#00BCD4', 'database', 6, TRUE),
('77777777-7777-7777-7777-777777777777', 'Quản lý dự án', 'Quản lý dự án và thành viên dự án', '#3F51B5', 'folder-open', 7, TRUE),

-- Alert & Warning Groups
('88888888-8888-8888-8888-888888888888', 'Cảnh báo & Thông báo', 'Quản lý cảnh báo, thông báo và cấu hình', '#F44336', 'bell', 8, TRUE),

-- Reporting & Analytics
('99999999-9999-9999-9999-999999999999', 'Báo cáo & Phân tích', 'Tạo và quản lý báo cáo, phân tích dữ liệu', '#607D8B', 'chart-bar', 9, TRUE),

-- Audit & Monitoring
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kiểm toán & Giám sát', 'Xem logs, audit trails và giám sát hệ thống', '#795548', 'clipboard-list', 10, TRUE),

-- Dashboard & View
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dashboard & Hiển thị', 'Quản lý dashboard và giao diện hiển thị', '#009688', 'layout-dashboard', 11, TRUE),

-- File Management
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Quản lý Files', 'Upload, download và quản lý files', '#673AB7', 'folder', 12, TRUE);


-- Step 2: Update Permissions with Group Assignment
-- ============================================================================

-- GROUP 1: QUẢN TRỊ HỆ THỐNG (System Administration)
UPDATE permissions SET group_id = '11111111-1111-1111-1111-111111111111' WHERE id IN (
    'cf5becb2-7604-4316-80ab-75320a5c375f', -- system.admin
    'f0653f90-c92d-43d5-acbf-cae48eb3f396', -- system.configure
    '00afe556-7a13-46c1-8872-95d193f2f4f9', -- system.settings
    '332e6a2b-7358-47b8-ab38-e14603cc2577', -- system.maintenance
    '2db85fb3-8c69-4c5e-bc80-b6d79bd842b4', -- system.backup
    '91e5698d-fab5-47a6-8066-78a1c9dc6514', -- system.restore
    'e0dacc81-9baa-483f-a0a4-18b16312fc48', -- system.logs
    '5c91795c-07bc-4883-bfd6-f40a258f0b7f'  -- system.audit
);

-- GROUP 2: QUẢN LÝ TỔ CHỨC (Organization Management)
UPDATE permissions SET group_id = '22222222-2222-2222-2222-222222222222' WHERE id IN (
    '9a2883d0-ffe0-4297-9d3f-4a689b487420', -- organization.manage
    '681ecdce-08b7-4a1e-bd43-c8a638719320', -- organization.create
    'c84cb546-65db-4adf-9d3c-cf1d010f968e', -- organization.read
    '5f477bb1-0a75-4231-bdc8-b68d2f11248b', -- organization.update
    '6d5fb3cf-e045-4ada-8e51-552ee3984ba9', -- organization.delete
    'ffda659f-44a6-4689-a12e-a4d9ee0b9ec4', -- organization.list
    'db0d098f-5ff9-4d58-a71a-064bece30d7f', -- organization.settings
    
    '9214ec5f-645d-4edd-a4ed-73c5abe49e37', -- department.manage
    'be4a0d1f-355d-4a89-8c1e-6ccbc583d807', -- department.create
    '932bac8b-705d-4807-959b-c111e5029540', -- department.read
    '1ff1e6ff-6b25-4940-a25c-0a0b204d6c2f', -- department.update
    '345d1609-bfa5-41b9-b7bf-fc02c9b0a0b3', -- department.delete
    '587e8c04-7891-43ba-a523-998ef7cf2400'  -- department.list
);

-- GROUP 3: QUẢN LÝ NGƯỜI DÙNG (User Management)
UPDATE permissions SET group_id = '33333333-3333-3333-3333-333333333333' WHERE id IN (
    '30e24c42-cdbe-42d3-a6a7-943a95d19dbf', -- user.manage
    'ec70507c-b5b2-4cdf-a7cf-708ba5376550', -- user.create
    '7a5c4431-2709-4f6d-8a8f-7d85cfe28796', -- user.read
    'b60336c7-0a44-42ee-80bd-c989625ac94c', -- user.update
    '3b64314e-9cc3-4320-b536-cf917be48211', -- user.delete
    'ac122213-3494-4ac9-bc22-4ee9337949bf', -- user.list
    'd81e6bae-88bf-4907-9b77-8c8441f0d9f4', -- user.activate
    '41fb15d3-4a96-4e7d-8c0f-ba7cc33b50c7', -- user.deactivate
    '63b4a569-f156-4491-9e4b-a4209b564231'  -- user.reset_password
);

-- GROUP 4: QUẢN LÝ VAI TRÒ & QUYỀN (Role & Permission Management)
UPDATE permissions SET group_id = '44444444-4444-4444-4444-444444444444' WHERE id IN (
    '8773b7f8-5df1-4021-b174-421d62e0ade2', -- role.manage
    '41ef0110-1755-46b6-a3c0-3d97b08ac1eb', -- role.create
    'f49ad626-5550-4e45-92f0-d2b8e962935c', -- role.read
    'c34dd8b3-85f8-42ea-bde7-baaa1477ff2d', -- role.update
    '4aaa4139-4396-4b9e-a077-352643c92332', -- role.delete
    '31b833f4-e749-4e34-b964-df1f208878ac', -- role.list
    '56b86965-3a18-4969-b9da-edbf068bbac0', -- role.assign_permission
    'ef5d9a81-ddb0-43c6-aec4-8de304ee0b52', -- role.assign
    
    'b3c96ef0-69a3-4db7-8d28-6d667d3929ca', -- permission.manage
    'c3f57933-c01b-4334-948a-641aabbfa7b6', -- permission.create
    '6b82deee-2f88-49e0-b5c0-e52f3b4556fa', -- permission.read
    '8d3bf9d0-f2ea-4de0-9739-1c9c303f51b9', -- permission.update
    'b359aaca-a7c5-4580-8f0e-7ce2361a56da', -- permission.delete
    'de1529ca-a772-4837-b644-bc07698a648c', -- permission.list
    'f1971129-7eb6-4165-b936-632d3ad86452'  -- permission.assign
);

-- GROUP 5: QUẢN LÝ THIẾT BỊ (Device Management)
UPDATE permissions SET group_id = '55555555-5555-5555-5555-555555555555' WHERE id IN (
    '176e1c64-f927-44c6-ae32-9f60bd472396', -- device.manage
    'cc89f68c-f037-4206-a32c-9def2f7f8ae5', -- device.create
    '165cdf8c-d7fd-4d37-b55e-def97de15f0e', -- device.read
    '05c02cb9-20de-4f13-9d2a-7d8aae805464', -- device.update
    '8cb8c9de-5870-4679-8143-6f4909a4141a', -- device.delete
    '9882315b-8804-429b-b4bf-f2791f185806', -- device.list
    '4755ef18-d10c-49d4-8732-4478b7f1266f', -- device.monitor
    '7dd43a5c-d2ed-4a0f-b339-da92d5daf5fd', -- device.configure
    '028e0810-2ee9-4e14-8451-9811592f6e1d'  -- device.calibrate
);

-- GROUP 6: QUẢN LÝ DỮ LIỆU (Data Management)
UPDATE permissions SET group_id = '66666666-6666-6666-6666-666666666666' WHERE id IN (
    'e974333d-87af-4b94-9913-d6782b850b6c', -- data.manage
    '28644b1d-1561-498d-b20d-793219eb9219', -- data.create
    'eb5bd2b0-f25d-46f4-aedc-420b277921d7', -- data.read
    'ca77de1b-c341-426f-b748-f381e9db9a25', -- data.update
    '26977a28-2023-4787-be4d-257882cf672c', -- data.delete
    '154b0994-cc14-4160-a126-3b5a5852743b', -- data.export
    'df4ea182-971f-4a98-8ece-5771a4856121'  -- data.import
);

-- GROUP 7: QUẢN LÝ DỰ ÁN (Project Management)
UPDATE permissions SET group_id = '77777777-7777-7777-7777-777777777777' WHERE id IN (
    '20165c64-f0fb-4be9-8654-fb6665926f81', -- project.manage
    '7f6d4e77-5030-40dc-9dad-fb84c31bf165', -- project.create
    '54a4bb82-1938-47cd-9272-00730faca283', -- project.read
    '7cca19ff-da9d-4a71-8042-4a4ab71183d8', -- project.update
    '893d04a4-f6e9-4d10-9073-c0c04d18480e', -- project.delete
    '80026026-15bd-4308-9e6d-0ab8f76f38d5', -- project.list
    '47ef3475-fe64-4477-acc6-11efed50a5d2', -- project.settings
    'bba64583-c88b-4543-90f3-d3d9ed247702'  -- project.assign_member
);

-- GROUP 8: CẢNH BÁO & THÔNG BÁO (Alerts & Notifications)
UPDATE permissions SET group_id = '88888888-8888-8888-8888-888888888888' WHERE id IN (
    'af84258a-9a80-4b85-be6c-a3a9893e12ff', -- warning.manage
    '39ce758c-2bf4-4567-92aa-f4ef614ba31d', -- warning.read
    '21eae173-9002-4884-b74c-1d2b56bc315e', -- warning.acknowledge
    'd873f686-95b6-450f-a71b-c7e2debea6da', -- warning.resolve
    'efbc445f-3d78-487a-ba06-d4811630e672', -- warning.configure
    
    '67956d98-9d3b-4d94-8217-a2c0a25903f8', -- notification.read
    'd7622d74-721f-403c-9e5e-52676c7fbfd5', -- notification.send
    '2d50b762-9e3d-4a51-8ca9-2e325376ac6e', -- notification.broadcast
    '8ed6dbca-ddb1-4f54-8768-5fab1f31158d'  -- notification.configure
);

-- GROUP 9: BÁO CÁO & PHÂN TÍCH (Reports & Analytics)
UPDATE permissions SET group_id = '99999999-9999-9999-9999-999999999999' WHERE id IN (
    'cc0b43d7-1c2c-42c9-93d3-461c91713743', -- report.manage
    'f5109ca9-dccf-4962-8dfd-6649ec36a5cf', -- report.create
    '8b9c08b0-e3f6-45c4-b769-87b1fd4c752c', -- report.read
    '5b84e383-76be-4226-b8f7-4c1b675cb0b0', -- report.update
    '39659d65-637d-4694-b62a-65c0aeab56b5', -- report.delete
    'c5b43f73-cc79-45c4-a8bc-40c3f0666381', -- report.list
    '2cdc3172-d850-489c-8720-58ab832dd158', -- report.export
    '59d6e9c8-a263-4c8c-bf8d-b75517b94b83', -- report.view
    '387fdb22-7532-4e02-9af5-8c8be67704ee', -- report.schedule
    'c90243e6-d33c-4b6d-a786-479202389c36', -- report.approve
    
    '86e43ec1-8a2e-442d-9b29-cca50f60810c', -- analytics.read
    '331e4ac8-46ec-4567-95f3-c3ea147acbe2', -- analytics.export
    'cd526c0a-0b6f-4cfc-aaae-534c683c9527'  -- analytics.advanced
);

-- GROUP 10: KIỂM TOÁN & GIÁM SÁT (Audit & Monitoring)
UPDATE permissions SET group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id IN (
    'fb818896-dfc7-45d8-93b8-641f0ffb2c85', -- audit.list
    'f47a8184-4fab-478b-9520-bf3b09da4295', -- audit.read
    '36382675-9b9e-4094-8b41-bbb897b1aee9', -- audit.search
    '9e89775c-7582-4b96-829d-86dc71bc88ba'  -- audit.export
);

-- GROUP 11: DASHBOARD & HIỂN THỊ (Dashboard & Display)
UPDATE permissions SET group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' WHERE id IN (
    'c181fc4a-12a0-4d18-8c54-d8650cecfc3c'  -- dashboard.view
);

-- GROUP 12: QUẢN LÝ FILES (File Management)
UPDATE permissions SET group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' WHERE id IN (
    '71342b87-3c7f-4bdb-9f0c-ff27de2190c2', -- file.manage
    '92cb8d1e-936d-4bca-a5cd-1188a37ed303', -- file.upload
    'cfcbf854-0078-4caf-bd47-42136e1b250e', -- file.download
    '7ecffa55-fe68-4a99-b5b5-6e68e8d3ac6f'  -- file.delete
);


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count permissions by group
SELECT 
    pg.name AS group_name,
    pg.color,
    pg.icon,
    COUNT(p.id) AS permission_count
FROM permission_groups pg
LEFT JOIN permissions p ON p.group_id = pg.id
GROUP BY pg.id, pg.name, pg.color, pg.icon, pg.sort_order
ORDER BY pg.sort_order;

-- Show permissions without group (should be empty)
SELECT id, name, resource, action
FROM permissions
WHERE group_id IS NULL
ORDER BY resource, action;

-- Show all permissions grouped
SELECT 
    pg.name AS group_name,
    p.name AS permission_name,
    p.resource,
    p.action,
    p.scope
FROM permissions p
LEFT JOIN permission_groups pg ON p.group_id = pg.id
ORDER BY pg.sort_order, p.resource, p.priority DESC;
