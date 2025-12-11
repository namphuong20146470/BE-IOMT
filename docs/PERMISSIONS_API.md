# 🔐 Permissions & Permission Groups API Documentation

## 📋 Table of Contents
- [Permissions API](#permissions-api)
- [Permission Groups API](#permission-groups-api)
- [Common Response Formats](#common-response-formats)

---

## 🎯 Permissions API

Base URL: `/api/v1/permissions`

### 1. Get All Permissions
```http
GET /api/v1/permissions
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `resource` (string) - Filter by resource
- `action` (string) - Filter by action
- `group_id` (uuid) - Filter by permission group
- `scope` (string) - Filter by scope (global, organization, department)
- `search` (string) - Search in name/description
- `include_roles` (boolean, default: false)
- `include_users` (boolean, default: false)

**Response:**
```json
{
  "success": true,
  "message": "Permissions retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "device.read",
      "description": "View device information",
      "resource": "device",
      "action": "read",
      "scope": "organization",
      "priority": 100,
      "group_id": "uuid",
      "created_at": "2025-12-10T10:00:00Z",
      "updated_at": "2025-12-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 78,
    "total_pages": 4
  }
}
```

**Required Permission:** `permission.read`

---

### 2. Get Permission by ID
```http
GET /api/v1/permissions/:permissionId
```

**Query Parameters:**
- `include_roles` (boolean, default: false) - Include roles that have this permission
- `include_users` (boolean, default: false) - Include users with direct permission

**Response:**
```json
{
  "success": true,
  "message": "Permission retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "device.update",
    "description": "Update device information",
    "resource": "device",
    "action": "update",
    "scope": "organization",
    "priority": 80,
    "group_id": "uuid",
    "group": {
      "id": "uuid",
      "name": "Quản lý thiết bị",
      "color": "#FF9800",
      "icon": "devices"
    },
    "created_at": "2025-12-10T10:00:00Z",
    "updated_at": "2025-12-10T10:00:00Z"
  }
}
```

**Required Permission:** `permission.read`

---

### 3. Create Permission
```http
POST /api/v1/permissions
```

**Request Body:**
```json
{
  "name": "maintenance.create",
  "description": "Create maintenance logs",
  "resource": "maintenance",
  "action": "create",
  "scope": "organization",
  "priority": 100,
  "group_id": "cccccccc-cccc-cccc-cccc-cccccccccccc"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission created successfully",
  "data": {
    "id": "uuid",
    "name": "maintenance.create",
    "description": "Create maintenance logs",
    "resource": "maintenance",
    "action": "create",
    "scope": "organization",
    "priority": 100,
    "group_id": "uuid",
    "created_at": "2025-12-10T10:00:00Z"
  }
}
```

**Required Permission:** `permission.create`

---

### 4. Update Permission
```http
PUT /api/v1/permissions/:permissionId
```

**Request Body:**
```json
{
  "description": "Updated description",
  "priority": 90,
  "group_id": "new-group-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission updated successfully",
  "data": {
    "id": "uuid",
    "name": "maintenance.create",
    "description": "Updated description",
    "priority": 90,
    "updated_at": "2025-12-10T11:00:00Z"
  }
}
```

**Required Permission:** `permission.update`

---

### 5. Delete Permission
```http
DELETE /api/v1/permissions/:permissionId
```

**Response:**
```json
{
  "success": true,
  "message": "Permission deleted successfully"
}
```

**Required Permission:** `permission.delete`

---

### 6. Get Permissions by Category (Resource)
```http
GET /api/v1/permissions/category/:category
```

**Example:**
```http
GET /api/v1/permissions/category/device
```

**Query Parameters:**
- `include_roles` (boolean, default: false)
- `include_users` (boolean, default: false)

**Response:**
```json
{
  "success": true,
  "message": "Permissions retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "device.read",
      "description": "View device information",
      "resource": "device",
      "action": "read"
    },
    {
      "id": "uuid",
      "name": "device.update",
      "description": "Update device information",
      "resource": "device",
      "action": "update"
    }
  ]
}
```

**Required Permission:** `permission.read`

---

### 7. Search Permissions
```http
GET /api/v1/permissions/search?q=device
```

**Query Parameters:**
- `q` (string, required) - Search query
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response:**
```json
{
  "success": true,
  "message": "Search results retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "device.read",
      "description": "View device information",
      "resource": "device",
      "action": "read",
      "highlight": {
        "field": "name",
        "match": "device"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 9
  }
}
```

**Required Permission:** `permission.read`

---

### 8. Get Permissions Hierarchy
```http
GET /api/v1/permissions/hierarchy
```

**Response:**
```json
{
  "success": true,
  "message": "Permissions hierarchy retrieved successfully",
  "data": {
    "system": {
      "resource": "system",
      "permissions": [
        {
          "id": "uuid",
          "name": "system.admin",
          "action": "admin",
          "priority": 100
        }
      ]
    },
    "device": {
      "resource": "device",
      "permissions": [
        {
          "id": "uuid",
          "name": "device.manage",
          "action": "manage",
          "priority": 100
        },
        {
          "id": "uuid",
          "name": "device.create",
          "action": "create",
          "priority": 90
        }
      ]
    }
  }
}
```

**Required Permission:** `permission.read`

---

### 9. Get Permission Statistics
```http
GET /api/v1/permissions/stats
```

**Response:**
```json
{
  "success": true,
  "message": "Permission statistics retrieved successfully",
  "data": {
    "total_permissions": 78,
    "by_resource": {
      "device": 9,
      "user": 9,
      "role": 8,
      "system": 8
    },
    "by_scope": {
      "global": 15,
      "organization": 50,
      "department": 13
    },
    "by_group": {
      "Quản lý thiết bị": 9,
      "Quản lý người dùng": 9
    }
  }
}
```

**Required Permission:** `permission.read`

---

### 10. Get Available Categories
```http
GET /api/v1/permissions/categories
```

**Response:**
```json
{
  "success": true,
  "message": "Permission categories retrieved successfully",
  "data": [
    "system",
    "user",
    "role",
    "permission",
    "device",
    "organization",
    "department",
    "audit",
    "maintenance"
  ]
}
```

**Required Permission:** `permission.read`

---

### 11. Get Available Actions
```http
GET /api/v1/permissions/actions
```

**Response:**
```json
{
  "success": true,
  "message": "Permission actions retrieved successfully",
  "data": [
    "create",
    "read",
    "update",
    "delete",
    "manage",
    "assign",
    "view",
    "monitor"
  ]
}
```

**Required Permission:** `permission.read`

---

### 12. Validate Permission Assignment
```http
POST /api/v1/permissions/:permissionId/validate
```

**Request Body:**
```json
{
  "role_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission assignment is valid",
  "data": {
    "valid": true,
    "conflicts": [],
    "warnings": []
  }
}
```

**Required Permission:** `permission.read`

---

## 🎨 Permission Groups API

Base URL: `/api/v1/permission-groups`

### 1. Get All Permission Groups
```http
GET /api/v1/permission-groups
```

**Query Parameters:**
- `include_permissions` (boolean, default: false) - Include full permission details
- `is_active` (boolean) - Filter by active status
- `page` (number, default: 1)
- `limit` (number, default: 50)

**Response:**
```json
{
  "success": true,
  "message": "Permission groups retrieved successfully",
  "data": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Quản trị hệ thống",
      "description": "Các quyền quản trị và cấu hình hệ thống cốt lõi",
      "color": "#FF5722",
      "icon": "shield-check",
      "sort_order": 1,
      "is_active": true,
      "permission_count": 8,
      "created_at": "2025-12-10T10:00:00Z",
      "updated_at": "2025-12-10T10:00:00Z"
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Quản lý tổ chức",
      "description": "Quản lý tổ chức, phòng ban và cấu trúc",
      "color": "#2196F3",
      "icon": "building",
      "sort_order": 2,
      "is_active": true,
      "permission_count": 13,
      "created_at": "2025-12-10T10:00:00Z",
      "updated_at": "2025-12-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "total_pages": 1
  }
}
```

**Required Permission:** `permission.read`

---

### 2. Get Permission Group by ID
```http
GET /api/v1/permission-groups/:id
```

**Query Parameters:**
- `include_permissions` (boolean, default: true)

**Response:**
```json
{
  "success": true,
  "message": "Permission group retrieved successfully",
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Quản lý thiết bị",
    "description": "Quản lý thiết bị, models và cấu hình thiết bị",
    "color": "#FF9800",
    "icon": "devices",
    "sort_order": 5,
    "is_active": true,
    "permission_count": 9,
    "created_at": "2025-12-10T10:00:00Z",
    "updated_at": "2025-12-10T10:00:00Z",
    "permissions": [
      {
        "id": "uuid",
        "name": "device.manage",
        "description": "Manage all device operations",
        "resource": "device",
        "action": "manage",
        "scope": "organization",
        "priority": 100,
        "created_at": "2025-12-10T10:00:00Z"
      },
      {
        "id": "uuid",
        "name": "device.create",
        "description": "Create new devices",
        "resource": "device",
        "action": "create",
        "scope": "organization",
        "priority": 90,
        "created_at": "2025-12-10T10:00:00Z"
      }
    ]
  }
}
```

**Required Permission:** `permission.read`

---

### 3. Create Permission Group
```http
POST /api/v1/permission-groups
```

**Request Body:**
```json
{
  "name": "Quản lý PDU",
  "description": "Quản lý Power Distribution Units và sockets",
  "color": "#E91E63",
  "icon": "power",
  "sort_order": 13,
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission group created successfully",
  "data": {
    "id": "new-uuid",
    "name": "Quản lý PDU",
    "description": "Quản lý Power Distribution Units và sockets",
    "color": "#E91E63",
    "icon": "power",
    "sort_order": 13,
    "is_active": true,
    "created_at": "2025-12-10T12:00:00Z",
    "updated_at": "2025-12-10T12:00:00Z"
  }
}
```

**Required Permission:** `permission.create`

---

### 4. Update Permission Group
```http
PUT /api/v1/permission-groups/:id
```

**Request Body:**
```json
{
  "description": "Updated description",
  "color": "#FF6B6B",
  "sort_order": 14,
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission group updated successfully",
  "data": {
    "id": "uuid",
    "name": "Quản lý PDU",
    "description": "Updated description",
    "color": "#FF6B6B",
    "icon": "power",
    "sort_order": 14,
    "is_active": false,
    "updated_at": "2025-12-10T13:00:00Z"
  }
}
```

**Required Permission:** `permission.update`

---

### 5. Delete Permission Group
```http
DELETE /api/v1/permission-groups/:id
```

**Note:** Cannot delete groups that have permissions assigned. Reassign permissions first.

**Response:**
```json
{
  "success": true,
  "message": "Permission group deleted successfully"
}
```

**Error Response (if has permissions):**
```json
{
  "success": false,
  "message": "Cannot delete group with 9 permissions. Please reassign or remove permissions first."
}
```

**Required Permission:** `permission.delete`

---

### 6. Get Group Statistics
```http
GET /api/v1/permission-groups/statistics
```

**Response:**
```json
{
  "success": true,
  "message": "Permission group statistics retrieved successfully",
  "data": {
    "total_groups": 12,
    "active_groups": 12,
    "inactive_groups": 0,
    "grouped_permissions": 78,
    "ungrouped_permissions": 0
  }
}
```

**Required Permission:** `permission.read`

---

## 📊 Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Pagination Format
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 78,
    "total_pages": 4
  }
}
```

---

## 🔑 Required Permissions Summary

| Endpoint | Permission Required |
|----------|-------------------|
| GET permissions | `permission.read` |
| GET permission/:id | `permission.read` |
| POST permissions | `permission.create` |
| PUT permissions/:id | `permission.update` |
| DELETE permissions/:id | `permission.delete` |
| GET permission-groups | `permission.read` |
| GET permission-groups/:id | `permission.read` |
| POST permission-groups | `permission.create` |
| PUT permission-groups/:id | `permission.update` |
| DELETE permission-groups/:id | `permission.delete` |

---

## 📝 Example Usage

### Get all groups with permissions
```bash
curl -X GET "http://localhost:3000/api/v1/permission-groups?include_permissions=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search permissions by device
```bash
curl -X GET "http://localhost:3000/api/v1/permissions/search?q=device&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create new permission in group
```bash
curl -X POST "http://localhost:3000/api/v1/permissions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pdu.create",
    "description": "Create PDU",
    "resource": "pdu",
    "action": "create",
    "scope": "organization",
    "priority": 90,
    "group_id": "55555555-5555-5555-5555-555555555555"
  }'
```

### Update permission group color
```bash
curl -X PUT "http://localhost:3000/api/v1/permission-groups/55555555-5555-5555-5555-555555555555" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "color": "#4CAF50"
  }'
```

---

## 🎯 Frontend Integration Tips

### 1. Display Permission Groups in UI
```javascript
// Fetch all groups for permission selection UI
const groups = await fetch('/api/v1/permission-groups?include_permissions=true');
// Group permissions by category for better UX
```

### 2. Permission Picker Component
```javascript
// Use hierarchy endpoint for tree view
const hierarchy = await fetch('/api/v1/permissions/hierarchy');
// Render as expandable tree with groups and permissions
```

### 3. Search Autocomplete
```javascript
// Use search endpoint for permission picker autocomplete
const results = await fetch('/api/v1/permissions/search?q=' + query);
```

---

## 🔄 Current Permission Groups

1. **Quản trị hệ thống** (#FF5722) - 8 permissions
2. **Quản lý tổ chức** (#2196F3) - 13 permissions
3. **Quản lý người dùng** (#4CAF50) - 9 permissions
4. **Quản lý vai trò & quyền** (#9C27B0) - 15 permissions
5. **Quản lý thiết bị** (#FF9800) - 9 permissions
6. **Quản lý dữ liệu** (#00BCD4) - 7 permissions
7. **Quản lý dự án** (#3F51B5) - 0 permissions
8. **Cảnh báo & Thông báo** (#F44336) - 5 permissions
9. **Báo cáo & Phân tích** (#607D8B) - 3 permissions
10. **Kiểm toán & Giám sát** (#795548) - 4 permissions
11. **Dashboard & Hiển thị** (#009688) - 1 permission
12. **Quản lý Bảo trì** (#673AB7) - 4 permissions

**Total:** 78 permissions across 12 groups
