# 🔐 User Permissions System - Complete Guide

## 📋 Overview

Hệ thống quyền hạn IoMT được thiết kế với 2 lớp:

1. **Role-based Permissions** (Quyền từ vai trò)
2. **User-specific Permissions** (Quyền cá nhân - grant/revoke)

## 🏗️ Database Architecture

### Base Tables
- `permissions` - Danh sách tất cả quyền trong hệ thống
- `roles` - Các vai trò (Admin, Manager, Staff, etc.)
- `role_permissions` - Quyền mặc định của từng role
- `user_roles` - Gán role cho user

### Override Table 
- `user_permissions` - **TÂM ĐIỂM** - Override quyền cá nhân

## 🔑 user_permissions Table Logic

```sql
CREATE TABLE "user_permissions" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,              -- User được cấp/thu hồi quyền
    "permission_id" UUID NOT NULL,        -- Quyền nào
    "granted_by" UUID,                    -- Admin nào cấp quyền này
    "granted_at" TIMESTAMPTZ,             -- Thời điểm cấp quyền
    "valid_from" TIMESTAMPTZ,             -- Quyền có hiệu lực từ khi nào
    "valid_until" TIMESTAMPTZ,            -- Quyền hết hiệu lực khi nào (NULL = vĩnh viễn)
    "is_active" BOOLEAN DEFAULT true,     -- 🔥 QUAN TRỌNG: true = GRANT, false = REVOKE
    "notes" TEXT                          -- Ghi chú lý do cấp/thu hồi
);
```

### Key Logic:
- **`is_active = true`**: THÊM quyền cho user (không có trong role)
- **`is_active = false`**: THU HỒI quyền từ user (có trong role nhưng muốn bỏ)

## 🎯 Use Cases

### 1. Grant Additional Permission
**Scenario:** User có role "Staff" nhưng cần quyền "approve_purchase" đặc biệt

```sql
INSERT INTO user_permissions (
    user_id, permission_id, granted_by, granted_at, valid_until, is_active, notes
) VALUES (
    'user-123', 'approve-purchase-perm-id', 'admin-456', NOW(), '2025-12-31', true,
    'Quyền tạm thời khi Manager nghỉ phép'
);
```

**API Call:**
```bash
POST /user-permissions/user-123/grant
{
  "permission_code": "purchase.approve",
  "valid_until": "2025-12-31T23:59:59Z",
  "notes": "Temporary permission while manager is on leave"
}
```

### 2. Revoke Existing Permission
**Scenario:** User có role "Manager" với quyền "device.delete" nhưng muốn thu hồi

```sql
INSERT INTO user_permissions (
    user_id, permission_id, granted_by, granted_at, is_active, notes
) VALUES (
    'user-123', 'delete-device-perm-id', 'admin-456', NOW(), false,
    'Thu hồi do vi phạm quy định'
);
```

**API Call:**
```bash
POST /user-permissions/user-123/revoke
{
  "permission_code": "device.delete",
  "notes": "Security violation - removed delete access"
}
```

### 3. Temporary Admin Access
**Scenario:** Cấp quyền admin trong 7 ngày

**API Call:**
```bash
POST /user-permissions/user-123/grant
{
  "permission_code": "admin.full_access", 
  "valid_until": "2025-11-17T23:59:59Z",
  "notes": "Temporary admin access while CTO is on vacation"
}
```

### 4. Bulk Permission Update
**Scenario:** User chuyển từ Staff lên Project Manager

**API Call:**
```bash
POST /user-permissions/user-123/bulk
{
  "grants": ["project.manage", "budget.approve", "team.lead"],
  "revokes": ["data.entry"],
  "notes": "Promoted to Project Manager - updated permissions"
}
```

## 🔍 Permission Resolution Logic

### SQL Query Logic:
```sql
WITH 
-- 1. Quyền từ roles
role_perms AS (
    SELECT DISTINCT p.code
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = $user_id 
      AND ur.is_active = true
      AND p.is_active = true
      AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
      AND (ur.valid_until IS NULL OR ur.valid_until >= NOW())
),
-- 2. Override từ user_permissions
user_overrides AS (
    SELECT p.code, up.is_active
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = $user_id
      AND (up.valid_from IS NULL OR up.valid_from <= NOW())
      AND (up.valid_until IS NULL OR up.valid_until >= NOW())
)
-- 🔥 FINAL RESULT: Role permissions - Revoked + Granted
SELECT code FROM role_perms
WHERE code NOT IN (
  SELECT code FROM user_overrides WHERE is_active = false  -- Loại bỏ quyền bị revoke
)
UNION
SELECT code FROM user_overrides WHERE is_active = true;    -- Thêm quyền được grant
```

## 📡 API Endpoints

### Query Permissions
```bash
# Get user's effective permissions
GET /user-permissions/{userId}?detailed=true&include_overrides=true

# Check specific permission
GET /user-permissions/{userId}/check/{permissionCode}

# Get permission override history
GET /user-permissions/{userId}/overrides?active_only=true
```

### Manage Permissions
```bash
# Grant permission
POST /user-permissions/{userId}/grant
{
  "permission_code": "device.delete",
  "valid_until": "2025-12-31T23:59:59Z",
  "notes": "Temporary access for project"
}

# Revoke permission
POST /user-permissions/{userId}/revoke
{
  "permission_code": "device.delete",
  "notes": "Security violation"
}

# Bulk update
POST /user-permissions/{userId}/bulk
{
  "grants": ["perm1", "perm2"],
  "revokes": ["perm3"],
  "notes": "Role change"
}
```

## 🛡️ Security Features

### 1. Time-based Permissions
- `valid_from`: Quyền có hiệu lực từ khi nào
- `valid_until`: Tự động hết hạn
- Hỗ trợ scheduled permissions (future grants)

### 2. Audit Trail
- `granted_by`: Tracking admin cấp quyền
- `granted_at`: Timestamp
- `notes`: Lý do cấp/thu hồi
- Full audit log integration

### 3. Permission Validation
```javascript
// Backend middleware
const hasPermission = await UserPermissionService.hasPermission(userId, 'device.delete');
if (!hasPermission) {
    return res.status(403).json({ error: 'Access denied' });
}
```

### 4. Self-service Restrictions
- User chỉ có thể xem permission của chính mình
- Admin cần quyền `user.permissions.manage` để grant/revoke
- System admin có thể override tất cả

## 🎨 Frontend Integration

### Permission Check Hook (React)
```javascript
const usePermission = (permissionCode) => {
    const [hasPermission, setHasPermission] = useState(false);
    
    useEffect(() => {
        checkPermission(permissionCode).then(setHasPermission);
    }, [permissionCode]);
    
    return hasPermission;
};

// Usage in component
const DeleteButton = () => {
    const canDelete = usePermission('device.delete');
    
    return canDelete ? <button>Delete</button> : null;
};
```

### Permission Guard Component
```javascript
const PermissionGuard = ({ permission, children, fallback }) => {
    const hasPermission = usePermission(permission);
    
    return hasPermission ? children : (fallback || null);
};

// Usage
<PermissionGuard permission="device.create">
    <CreateDeviceButton />
</PermissionGuard>
```

## 📊 Real-world Examples

### Example 1: Vacation Coverage
```bash
# Manager đi nghỉ, cấp quyền approve cho Staff
POST /user-permissions/staff-123/grant
{
  "permission_code": "purchase.approve",
  "valid_from": "2025-11-15T00:00:00Z",
  "valid_until": "2025-11-25T23:59:59Z", 
  "notes": "Covering manager approval duties during vacation"
}
```

### Example 2: Security Incident Response
```bash
# Thu hồi ngay quyền delete sau sự cố bảo mật
POST /user-permissions/user-456/revoke
{
  "permission_code": "device.delete",
  "notes": "Security incident #2025-001 - immediate access revocation"
}
```

### Example 3: Project Team Setup
```bash
# Setup quyền cho team dự án mới
POST /user-permissions/dev-123/bulk
{
  "grants": ["project.alpha.access", "test.environment.deploy"],
  "notes": "Added to Project Alpha development team"
}
```

## 🔧 Service Class Usage

```javascript
const UserPermissionService = require('./services/UserPermissionService');

// Check permission
const canDelete = await UserPermissionService.hasPermission(userId, 'device.delete');

// Get all permissions
const permissions = await UserPermissionService.getUserPermissions(userId);

// Grant permission
await UserPermissionService.grantPermission({
    userId: 'user-123',
    permissionCode: 'device.create',
    grantedBy: adminId,
    validUntil: new Date('2025-12-31'),
    notes: 'Project requirement'
});

// Revoke permission
await UserPermissionService.revokePermission({
    userId: 'user-123',
    permissionCode: 'device.delete',
    revokedBy: adminId,
    notes: 'Security policy'
});
```

## 🎯 Key Benefits

1. **Flexible**: Grant/revoke quyền cá nhân không ảnh hưởng role
2. **Time-based**: Quyền tự động hết hạn
3. **Auditable**: Full tracking ai cấp gì khi nào
4. **Scalable**: Handle được enterprise-level permission management
5. **Secure**: Multiple validation layers và audit trail

## 🚨 Important Notes

- **is_active = true** = GRANT permission
- **is_active = false** = REVOKE permission  
- Time validation quan trọng (valid_from/valid_until)
- Always include notes for audit trail
- Test permission changes thoroughly
- Monitor for privilege escalation

---

## 📚 Related Documentation
- [Role Management API](./ROLE_MANAGEMENT_API.md)
- [Permission System Architecture](./PERMISSION_ARCHITECTURE.md)
- [Security Best Practices](./SECURITY_GUIDELINES.md)