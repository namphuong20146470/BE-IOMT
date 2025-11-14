# User Permissions API Documentation

## Overview
Hệ thống IoMT hỗ trợ 2 cách gán permissions cho users:
1. **Role-based Permissions**: Thông qua việc gán roles cho users
2. **Direct Permissions**: Gán permissions trực tiếp cho users

## API Endpoints

### 1. Get User's Direct Permissions
```http
GET /users/:userId/permissions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "full_name": "Nguyen Van A",
      "email": "user@example.com"
    },
    "direct_permissions": [
      {
        "permission": {
          "id": "perm-uuid",
          "name": "device.calibrate",
          "description": "Calibrate devices"
        },
        "granted_by": {
          "id": "admin-uuid",
          "full_name": "Admin User",
          "email": "admin@example.com"
        },
        "granted_at": "2025-10-21T10:00:00Z",
        "valid_from": "2025-10-21T10:00:00Z",
        "valid_until": "2025-11-21T10:00:00Z",
        "notes": "Temporary calibration access"
      }
    ]
  }
}
```

### 2. Get All User Permissions (Roles + Direct)
```http
GET /users/:userId/permissions/all
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "full_name": "Nguyen Van A",
      "email": "user@example.com"
    },
    "rolePermissions": [
      {
        "permission": {
          "id": "perm-uuid",
          "name": "device.read",
          "description": "View devices"
        },
        "source": "role",
        "role": {
          "id": "role-uuid",
          "name": "Device Operator"
        }
      }
    ],
    "directPermissions": [
      {
        "permission": {
          "id": "perm-uuid",
          "name": "device.calibrate",
          "description": "Calibrate devices"
        },
        "source": "direct",
        "granted_by": {
          "full_name": "Admin User",
          "email": "admin@example.com"
        },
        "granted_at": "2025-10-21T10:00:00Z",
        "valid_until": "2025-11-21T10:00:00Z",
        "notes": "Temporary access"
      }
    ],
    "allPermissions": [
      "device.read",
      "device.calibrate",
      "system.audit"
    ]
  }
}
```

### 3. Assign Direct Permissions to User
```http
POST /users/:userId/permissions
```

**Request Body:**
```json
{
  "permission_ids": [
    "176e1c64-f927-44c6-ae32-9f60bd472396",
    "30e24c42-cdbe-42d3-a6a7-943a95d19dbf"
  ],
  "notes": "Emergency access for system maintenance",
  "valid_from": "2025-10-21T00:00:00Z",
  "valid_until": "2025-10-28T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "permissions": {
      "rolePermissions": [...],
      "directPermissions": [...],
      "allPermissions": [...]
    }
  },
  "message": "Direct permissions assigned successfully"
}
```

### 4. Bulk Assign Multiple Direct Permissions
```http
POST /users/:userId/permissions/bulk
```

**Request Body:**
```json
{
  "assignments": [
    {
      "permission_id": "perm-uuid-1",
      "notes": "Maintenance access",
      "valid_from": "2025-10-21T00:00:00Z",
      "valid_until": "2025-10-28T23:59:59Z"
    },
    {
      "permission_id": "perm-uuid-2",
      "notes": "Emergency calibration",
      "valid_from": "2025-10-21T00:00:00Z",
      "valid_until": null
    }
  ]
}
```

### 5. Update Direct Permission
```http
PUT /users/:userId/permissions/:permissionId
```

**Request Body:**
```json
{
  "valid_until": "2025-12-31T23:59:59Z",
  "notes": "Extended access period",
  "is_active": true
}
```

### 6. Remove Direct Permission
```http
DELETE /users/:userId/permissions/:permissionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "removed_permission": "device.calibrate"
  },
  "message": "Direct permission removed successfully"
}
```

## Usage Examples

### Example 1: Emergency System Access
```bash
# Grant temporary system admin access
curl -X POST http://localhost:3005/users/user-123/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": ["system-admin-permission-id"],
    "notes": "Emergency system maintenance",
    "valid_from": "2025-10-21T00:00:00Z",
    "valid_until": "2025-10-21T23:59:59Z"
  }'
```

### Example 2: Device Calibration Access
```bash
# Grant device calibration permission
curl -X POST http://localhost:3005/users/technician-123/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": ["device-calibrate-permission-id"],
    "notes": "Monthly calibration duty",
    "valid_from": "2025-10-21T00:00:00Z",
    "valid_until": "2025-10-28T23:59:59Z"
  }'
```

### Example 3: Bulk Permission Assignment
```bash
# Assign multiple permissions with different validity periods
curl -X POST http://localhost:3005/users/supervisor-123/permissions/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignments": [
      {
        "permission_id": "device-manage-id",
        "notes": "Supervisor access",
        "valid_until": null
      },
      {
        "permission_id": "user-manage-id", 
        "notes": "Temporary HR duties",
        "valid_until": "2025-11-30T23:59:59Z"
      }
    ]
  }'
```

## Permission Validation

### Helper Functions Available:
```javascript
import { 
  hasPermission,
  isSystemAdmin,
  getUserAllPermissions,
  hasPermissionEnhanced
} from '../utils/permissionHelpers.js';

// Check permission from JWT user object
if (hasPermission(req.user, 'device.manage')) {
  // User has permission
}

// Check if user is system admin
if (isSystemAdmin(req.user)) {
  // User is system admin
}

// Enhanced permission check with database lookup
const canManage = await hasPermissionEnhanced(userId, 'device.manage');
```

## Database Schema

### user_permissions Table:
```sql
user_permissions (
  user_id UUID REFERENCES users(id),
  permission_id UUID REFERENCES permissions(id),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN,
  notes TEXT,
  PRIMARY KEY (user_id, permission_id)
)
```

## Best Practices

1. **Use time-bound permissions** for temporary access
2. **Always include notes** explaining why permission was granted
3. **Regular audit** of direct permissions
4. **Prefer role-based permissions** for permanent access
5. **Use direct permissions** for exceptions and emergency access

## Security Considerations

- Only users with `user.manage` permission can assign/remove direct permissions
- Users can view their own permissions without special permissions
- All permission changes are logged with audit trail
- Expired permissions are automatically filtered out
- Permission inheritance: Direct permissions + Role permissions