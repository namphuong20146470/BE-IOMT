# 🔐 Role Permission Management API Documentation

## 📚 Tổng quan

Tài liệu này mô tả các API endpoints để quản lý permissions của roles trong hệ thống IoMT.

## 🎯 Các Endpoints Chính

### 1️⃣ **Xem Permissions của Role**

#### **GET** `/api/v1/roles/:roleId/permissions`

Lấy danh sách tất cả permissions được gán cho role.

**Parameters:**
- `roleId` (path, required) - UUID hoặc ID của role
- `grouped` (query, optional) - `true` để nhóm permissions theo group

**Headers:**
```http
Authorization: Bearer <token>
```

**Permission Required:**
```
role.read
```

**Response (không grouped):**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "role-uuid",
      "name": "Technician",
      "description": "Technical staff role"
    },
    "permissions": [
      {
        "id": "perm-uuid-1",
        "name": "device.read",
        "description": "View devices",
        "category": "device"
      },
      {
        "id": "perm-uuid-2",
        "name": "device.update",
        "description": "Update devices",
        "category": "device"
      }
    ],
    "total": 2
  }
}
```

**Response (grouped=true):**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "role-uuid",
      "name": "Technician"
    },
    "grouped_permissions": [
      {
        "group_id": "group-uuid-1",
        "group_name": "Quản lý thiết bị",
        "total_permissions": 9,
        "assigned_permissions": 5,
        "permissions": [
          {
            "id": "perm-1",
            "name": "device.read",
            "assigned": true
          },
          {
            "id": "perm-2",
            "name": "device.create",
            "assigned": false
          }
        ]
      }
    ]
  }
}
```

**Example cURL:**
```bash
# Xem permissions thường
curl -X GET http://localhost:3000/api/v1/roles/role-uuid/permissions \
  -H "Authorization: Bearer <token>"

# Xem permissions grouped theo nhóm
curl -X GET "http://localhost:3000/api/v1/roles/role-uuid/permissions?grouped=true" \
  -H "Authorization: Bearer <token>"
```

---

### 2️⃣ **Gán Permissions cho Role**

#### **Method 1: Gán từng permission đơn lẻ**

**POST** `/api/v1/roles/:roleId/permissions`

Gán một permission cho role.

**Request Body:**
```json
{
  "permission_id": "perm-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permission assigned to role successfully",
  "data": {
    "role_id": "role-uuid",
    "permission_id": "perm-uuid",
    "permission_name": "device.read"
  }
}
```

---

#### **Method 2: Gán nhiều permissions cùng lúc (Bulk Assign)**

**POST** `/api/v1/roles/:roleId/permissions/bulk`

Gán nhiều permissions cho role cùng một lúc.

**Permission Required:**
```
role.update
```

**Request Body - Option 1 (By Permission IDs):**
```json
{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2",
    "perm-uuid-3"
  ]
}
```

**Request Body - Option 2 (By Group ID - Gán cả nhóm):**
```json
{
  "group_id": "group-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned 3 permissions to role",
  "data": {
    "role_id": "role-uuid",
    "assigned_count": 3,
    "permissions": [
      {
        "id": "perm-uuid-1",
        "name": "device.create"
      },
      {
        "id": "perm-uuid-2",
        "name": "device.read"
      },
      {
        "id": "perm-uuid-3",
        "name": "device.update"
      }
    ]
  }
}
```

**Example cURL:**
```bash
# Gán nhiều permissions theo IDs
curl -X POST http://localhost:3000/api/v1/roles/role-uuid/permissions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": ["perm-1", "perm-2", "perm-3"]
  }'

# Gán toàn bộ nhóm permissions
curl -X POST http://localhost:3000/api/v1/roles/role-uuid/permissions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "group-uuid"
  }'
```

---

### 3️⃣ **Cập Nhật Permissions của Role**

#### **PUT** `/api/v1/roles/:roleId/permissions`

Thay thế toàn bộ permissions của role bằng danh sách mới.

**⚠️ Warning:** Endpoint này sẽ XÓA tất cả permissions hiện tại và thay thế bằng danh sách mới.

**Request Body:**
```json
{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2",
    "perm-uuid-3"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role permissions updated successfully",
  "data": {
    "role_id": "role-uuid",
    "total_permissions": 3,
    "permissions": [...]
  }
}
```

---

### 4️⃣ **Gỡ Permissions khỏi Role**

#### **Method 1: Gỡ một permission đơn lẻ**

**DELETE** `/api/v1/roles/:roleId/permissions/:permissionId`

**Parameters:**
- `roleId` (path, required) - UUID của role
- `permissionId` (path, required) - UUID của permission cần gỡ

**Response:**
```json
{
  "success": true,
  "message": "Permission removed from role successfully",
  "data": {
    "role_id": "role-uuid",
    "permission_id": "perm-uuid",
    "permission_name": "device.delete"
  }
}
```

**Example cURL:**
```bash
curl -X DELETE http://localhost:3000/api/v1/roles/role-uuid/permissions/perm-uuid \
  -H "Authorization: Bearer <token>"
```

---

#### **Method 2: Gỡ nhiều permissions cùng lúc (Bulk Remove)**

**DELETE** `/api/v1/roles/:roleId/permissions/bulk`

Gỡ nhiều permissions khỏi role cùng một lúc.

**Request Body - Option 1 (By Permission IDs):**
```json
{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2"
  ]
}
```

**Request Body - Option 2 (By Group ID - Gỡ cả nhóm):**
```json
{
  "group_id": "group-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 2 permissions from role",
  "data": {
    "role_id": "role-uuid",
    "removed_count": 2,
    "permissions": [
      {
        "id": "perm-uuid-1",
        "name": "device.delete"
      },
      {
        "id": "perm-uuid-2",
        "name": "device.configure"
      }
    ]
  }
}
```

**Example cURL:**
```bash
# Gỡ nhiều permissions theo IDs
curl -X DELETE http://localhost:3000/api/v1/roles/role-uuid/permissions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": ["perm-1", "perm-2"]
  }'

# Gỡ toàn bộ nhóm permissions
curl -X DELETE http://localhost:3000/api/v1/roles/role-uuid/permissions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "group-uuid"
  }'
```

---

## 🔄 Workflow UI/UX - Quản lý Permissions cho Role

### **Scenario: Gán quyền "Quản lý thiết bị" cho role "Technician"**

#### **Bước 1: Load danh sách Permission Groups**

```javascript
GET /api/v1/permission-groups
```

Response hiển thị các nhóm permission dạng grid/cards.

---

#### **Bước 2: Load permissions hiện tại của role (grouped)**

```javascript
GET /api/v1/roles/{roleId}/permissions?grouped=true
```

Hiển thị badge "5/9" trên card "Quản lý thiết bị" (5 permissions đã gán / 9 tổng số).

---

#### **Bước 3: User click vào card "Quản lý thiết bị"**

```javascript
GET /api/v1/permission-groups/{groupId}?include_permissions=true
```

Hiển thị modal với 9 checkboxes:
- ✅ device.read
- ✅ device.update
- ✅ device.list
- ✅ device.monitor
- ✅ device.create
- ❌ device.delete
- ❌ device.configure
- ❌ device.calibrate
- ❌ device.manage

---

#### **Bước 4a: User uncheck "device.delete" và "device.configure"**

```javascript
DELETE /api/v1/roles/{roleId}/permissions/bulk
{
  "permission_ids": ["perm-delete-uuid", "perm-configure-uuid"]
}
```

Badge cập nhật thành "3/9".

---

#### **Bước 4b: User check thêm "device.monitor"**

```javascript
POST /api/v1/roles/{roleId}/permissions/bulk
{
  "permission_ids": ["perm-monitor-uuid"]
}
```

Badge cập nhật thành "4/9".

---

#### **Bước 5: User click "Chọn tất cả nhóm"**

```javascript
POST /api/v1/roles/{roleId}/permissions/bulk
{
  "group_id": "device-group-uuid"
}
```

Gán tất cả 9 permissions trong nhóm. Badge thành "9/9".

---

#### **Bước 6: User click "Bỏ chọn tất cả nhóm"**

```javascript
DELETE /api/v1/roles/{roleId}/permissions/bulk
{
  "group_id": "device-group-uuid"
}
```

Gỡ tất cả 9 permissions. Badge thành "0/9".

---

## 📊 Permission Groups Endpoints

### **Lấy danh sách Permission Groups**

```http
GET /api/v1/permission-groups
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "group-uuid-1",
      "name": "Quản lý thiết bị",
      "description": "Các quyền liên quan đến quản lý thiết bị",
      "icon": "device",
      "color": "#3b82f6",
      "display_order": 1,
      "permission_count": 9
    },
    {
      "id": "group-uuid-2",
      "name": "Quản lý người dùng",
      "description": "Các quyền liên quan đến quản lý người dùng",
      "icon": "user",
      "color": "#10b981",
      "display_order": 2,
      "permission_count": 7
    }
  ]
}
```

---

### **Lấy chi tiết Permission Group**

```http
GET /api/v1/permission-groups/{groupId}?include_permissions=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "group-uuid",
    "name": "Quản lý thiết bị",
    "description": "Các quyền liên quan đến quản lý thiết bị",
    "permissions": [
      {
        "id": "perm-1",
        "name": "device.read",
        "description": "Xem thông tin thiết bị",
        "category": "device"
      },
      {
        "id": "perm-2",
        "name": "device.create",
        "description": "Tạo thiết bị mới",
        "category": "device"
      }
    ],
    "total_permissions": 9
  }
}
```

---

## 🔒 Permissions Required

| Endpoint | Permission Required |
|----------|-------------------|
| `GET /roles/:roleId/permissions` | `role.read` |
| `POST /roles/:roleId/permissions` | `role.update` |
| `POST /roles/:roleId/permissions/bulk` | `role.update` |
| `PUT /roles/:roleId/permissions` | `role.update` |
| `DELETE /roles/:roleId/permissions/:permissionId` | `role.update` |
| `DELETE /roles/:roleId/permissions/bulk` | `role.update` |

---

## ⚠️ Error Handling

### **401 Unauthorized**
```json
{
  "success": false,
  "message": "No token provided"
}
```

### **403 Forbidden**
```json
{
  "success": false,
  "message": "Insufficient permissions. Required: role.update"
}
```

### **404 Not Found**
```json
{
  "success": false,
  "message": "Role not found"
}
```

### **400 Bad Request**
```json
{
  "success": false,
  "message": "Invalid permission IDs provided",
  "errors": [
    "Permission perm-123 not found"
  ]
}
```

---

## 📝 Best Practices

### 1. **Sử dụng Bulk Operations**
Khi cần gán/gỡ nhiều permissions, luôn dùng bulk endpoints thay vì gọi nhiều lần endpoint đơn lẻ:

✅ **Good:**
```javascript
POST /api/v1/roles/role-id/permissions/bulk
{ "permission_ids": ["p1", "p2", "p3"] }
```

❌ **Bad:**
```javascript
POST /api/v1/roles/role-id/permissions { "permission_id": "p1" }
POST /api/v1/roles/role-id/permissions { "permission_id": "p2" }
POST /api/v1/roles/role-id/permissions { "permission_id": "p3" }
```

### 2. **Sử dụng Grouped Query cho UI**
Khi hiển thị permissions trong UI dạng groups, sử dụng `?grouped=true`:

```javascript
GET /api/v1/roles/role-id/permissions?grouped=true
```

### 3. **Gán cả nhóm thay vì từng permission**
Khi user click "Chọn tất cả", gán theo `group_id`:

```javascript
POST /api/v1/roles/role-id/permissions/bulk
{ "group_id": "group-uuid" }
```

### 4. **Cache Invalidation**
Sau khi thay đổi permissions của role, cache của users thuộc role đó sẽ tự động được invalidate.

---

## 🧪 Testing Examples

### **Postman Collection**

```javascript
// 1. Xem permissions của role
GET http://localhost:3000/api/v1/roles/{{roleId}}/permissions
Authorization: Bearer {{token}}

// 2. Gán nhiều permissions
POST http://localhost:3000/api/v1/roles/{{roleId}}/permissions/bulk
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "permission_ids": [
    "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
    "165cdf8c-d7fd-4d37-b55e-def97de15f0e"
  ]
}

// 3. Gán toàn bộ nhóm
POST http://localhost:3000/api/v1/roles/{{roleId}}/permissions/bulk
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "group_id": "55555555-5555-5555-5555-555555555555"
}

// 4. Gỡ permissions
DELETE http://localhost:3000/api/v1/roles/{{roleId}}/permissions/bulk
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2"
  ]
}
```

---

## 📚 Related Documentation

- [Permission System Fix Complete](./PERMISSION_SYSTEM_FIX_COMPLETE.md)
- [Permission UI Workflow](./PERMISSION_UI_WORKFLOW.md)
- [Permission API Quick Reference](./PERMISSION_API_QUICK_REFERENCE.md)
- [Permissions API](./PERMISSIONS_API.md)

---

## 🔗 Quick Links

- **Base URL:** `http://localhost:3000/api/v1`
- **Swagger UI:** `http://localhost:3000/api-docs`
- **Permission Groups UI:** `/admin/permission-groups`
- **Role Management UI:** `/admin/roles`

---

**Last Updated:** December 15, 2025  
**Version:** 1.0.0
