# 📋 **PERMISSION MANAGEMENT API DOCUMENTATION**

## **🎯 BASE URL**
```
https://iomt.hoangphucthanh.vn:3030/actlog/permissions
```

---

## **🔑 PERMISSION CRUD OPERATIONS**

### **📚 GET /permissions**
**Lấy tất cả permissions với filtering**

**Query Parameters:**
```javascript
{
  resource?: string,           // Filter by resource (e.g., "user", "role")
  action?: string,             // Filter by action (e.g., "read", "create")
  group_id?: string,           // Filter by permission group
  search?: string,             // Search in name, description, resource, action
  is_active?: boolean,         // Default: true
  include_groups?: boolean     // Include permission groups info
}
```

**Response:**
```javascript
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "permission.read",
      "description": "Read permissions",
      "resource": "permission",
      "action": "read",
      "group_id": "uuid",
      "priority": 0,
      "is_active": true,
      "created_at": "2025-09-19T...",
      "permission_groups": { ... } // if include_groups=true
    }
  ],
  "total": 50
}
```

---

### **📖 GET /permissions/:id**
**Lấy permission chi tiết theo ID**

**Query Parameters:**
```javascript
{
  include_roles?: boolean,     // Include roles that have this permission
  include_users?: boolean      // Include users that have this permission
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "permission.read",
    "description": "Read permissions",
    "resource": "permission",
    "action": "read",
    "priority": 0,
    "role_permissions": [ ... ], // if include_roles=true
    "user_permissions": [ ... ]  // if include_users=true
  }
}
```

---

### **✏️ POST /permissions**
**Tạo permission mới**

**Request Body:**
```javascript
{
  "name": "user.export",              // Required: unique permission name
  "description": "Export user data",  // Optional
  "resource": "user",                 // Required: resource type
  "action": "export",                 // Required: action type
  "group_id": "uuid",                 // Optional: permission group
  "priority": 5,                      // Optional: default 0
  "conditions": {                     // Optional: additional conditions
    "time_restricted": true
  },
  "depends_on": ["user.read"]         // Optional: dependency permissions
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "user.export",
    // ... other fields
  }
}
```

---

### **🔄 PUT /permissions/:id**
**Cập nhật permission**

**Request Body:** (Same as POST, but all fields optional)
```javascript
{
  "description": "Updated description",
  "priority": 10
}
```

---

### **🗑️ DELETE /permissions/:id**
**Xóa permission (soft delete)**

**Request Body:**
```javascript
{
  "reason": "No longer needed"  // Optional deletion reason
}
```

---

## **🏷️ PERMISSION GROUPS**

### **📚 GET /permissions/groups**
**Lấy tất cả permission groups**

**Query Parameters:**
```javascript
{
  include_permissions?: boolean  // Include permissions in each group
}
```

---

### **✏️ POST /permissions/groups**
**Tạo permission group mới**

**Request Body:**
```javascript
{
  "name": "User Management",
  "description": "Permissions for user operations",
  "color": "#3B82F6",
  "icon": "users",
  "sort_order": 1
}
```

---

## **🔗 ROLE-PERMISSION ASSIGNMENT**

### **📚 GET /permissions/roles/:roleId**
**Lấy permissions của role**

**Query Parameters:**
```javascript
{
  include_inherited?: boolean  // Include inherited permissions from role hierarchy
}
```

**Response:**
```javascript
{
  "success": true,
  "data": [
    {
      "id": "permission-uuid",
      "name": "user.read",
      "resource": "user",
      "action": "read",
      "assignment_id": "assignment-uuid",
      "conditions": null,
      "expires_at": null,
      "granted_at": "2025-09-19T...",
      "granted_by": "user-uuid"
    }
  ],
  "total": 10
}
```

---

### **✏️ POST /permissions/roles/:roleId**
**Gán permission cho role**

**Request Body:**
```javascript
{
  "permission_id": "permission-uuid",    // Required
  "conditions": {                        // Optional
    "department_only": true
  },
  "expires_at": "2025-12-31T23:59:59Z"  // Optional
}
```

---

### **🗑️ DELETE /permissions/roles/:roleId/:permissionId**
**Xóa permission khỏi role**

**Request Body:**
```javascript
{
  "reason": "Role restructuring"  // Optional
}
```

---

### **🔄 PUT /permissions/roles/:roleId/bulk**
**Bulk update role permissions**

**Request Body:**
```javascript
{
  "permissions": [
    {
      "permission_id": "uuid1",
      "conditions": null,
      "expires_at": null
    },
    {
      "permission_id": "uuid2",
      "conditions": {"limited": true}
    }
  ]
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "removed": 3,    // Number of permissions removed
    "added": 2,      // Number of permissions added
    "total": 5       // Total permissions now
  }
}
```

---

## **👤 USER-PERMISSION ASSIGNMENT**

### **📚 GET /permissions/users/:userId**
**Lấy permissions của user (direct + role-based)**

**Query Parameters:**
```javascript
{
  include_roles?: boolean,        // Default: true, include role-based permissions
  organization_id?: string       // Filter by organization
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "roles": [
      {
        "role_id": "uuid",
        "role_name": "Admin",
        "organization_id": "uuid",
        "permissions": [
          {
            "name": "user.read",
            "resource": "user",
            "action": "read",
            "priority": 5
          }
        ]
      }
    ],
    "direct": [
      {
        "id": "uuid",
        "name": "special.access",
        "resource": "special",
        "action": "access",
        "conditions": null,
        "expires_at": null
      }
    ]
  }
}
```

---

### **🎯 GET /permissions/users/:userId/effective**
**Lấy tất cả permissions hiệu lực của user (combined)**

**Response:**
```javascript
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "organization_id": "uuid",
    "permissions": [
      {
        "name": "user.read",
        "resource": "user", 
        "action": "read",
        "priority": 5,
        "source": "role",           // "role" or "direct"
        "source_id": "role-uuid",
        "source_name": "Admin Role"
      }
    ],
    "total": 15,
    "computed_at": "2025-09-19T..."
  }
}
```

---

### **✏️ POST /permissions/users/:userId**
**Gán permission trực tiếp cho user**

**Request Body:**
```javascript
{
  "permission_id": "permission-uuid",    // Required
  "organization_id": "org-uuid",         // Optional
  "conditions": {                        // Optional
    "ip_restricted": ["192.168.1.0/24"]
  },
  "expires_at": "2025-12-31T23:59:59Z"  // Optional
}
```

---

### **🗑️ DELETE /permissions/users/:userId/:permissionId**
**Xóa permission trực tiếp khỏi user**

**Request Body:**
```javascript
{
  "reason": "User role changed"  // Optional
}
```

---

## **✅ PERMISSION VALIDATION & CHECK**

### **🔍 POST /permissions/check**
**Kiểm tra user có permission cụ thể không**

**Request Body:**
```javascript
{
  "user_id": "user-uuid",           // Required
  "permission_name": "user.read",   // Required
  "organization_id": "org-uuid",    // Optional
  "context": {                      // Optional additional context
    "resource_id": "specific-uuid",
    "department_id": "dept-uuid"
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "permission_name": "user.read",
    "organization_id": "org-uuid",
    "has_permission": true,
    "checked_at": "2025-09-19T..."
  }
}
```

---

### **📊 POST /permissions/check/bulk**
**Kiểm tra nhiều permissions cùng lúc**

**Request Body:**
```javascript
{
  "user_id": "user-uuid",                    // Required
  "permissions": [                           // Required
    "user.read",
    "user.create", 
    "role.assign"
  ],
  "organization_id": "org-uuid"              // Optional
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "organization_id": "org-uuid",
    "permissions": [
      {
        "permission_name": "user.read",
        "has_permission": true
      },
      {
        "permission_name": "user.create",
        "has_permission": false
      },
      {
        "permission_name": "role.assign", 
        "has_permission": true
      }
    ],
    "checked_at": "2025-09-19T..."
  }
}
```

---

## **🔍 DEBUG OPERATIONS**

### **🛠️ GET /permissions/users/:userId/debug**
**Debug user permissions (chi tiết breakdown)**

**Query Parameters:**
```javascript
{
  organization_id?: string  // Filter by organization
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "full_name": "Administrator",
      "is_active": true
    },
    "organization_id": "org-uuid",
    "roles": [
      {
        "role_id": "uuid",
        "role_name": "Super Admin",
        "permissions": [ ... ]
      }
    ],
    "direct_permissions": [ ... ],
    "effective_permissions": [ ... ],
    "permission_tests": [
      {
        "permission": "permission.read",
        "has_permission": true
      }
    ],
    "cache_status": {
      "cached": true,
      "cache_expires": "2025-09-19T..."
    },
    "debug_timestamp": "2025-09-19T..."
  }
}
```

---

## **🚀 FRONTEND INTEGRATION EXAMPLES**

### **Vue.js Permission Check Hook**
```javascript
// composables/usePermissions.js
import { ref, computed } from 'vue'
import { api } from '@/services/api'

export function usePermissions(userId) {
  const permissions = ref([])
  const loading = ref(false)

  const hasPermission = computed(() => {
    return (permissionName) => {
      return permissions.value.some(p => p.name === permissionName)
    }
  })

  const checkPermission = async (permissionName, context = {}) => {
    const response = await api.post('/actlog/permissions/check', {
      user_id: userId,
      permission_name: permissionName,
      ...context
    })
    return response.data.data.has_permission
  }

  const loadUserPermissions = async () => {
    loading.value = true
    try {
      const response = await api.get(`/actlog/permissions/users/${userId}/effective`)
      permissions.value = response.data.data.permissions
    } finally {
      loading.value = false
    }
  }

  return {
    permissions,
    loading,
    hasPermission,
    checkPermission,
    loadUserPermissions
  }
}
```

### **React Permission Component**
```javascript
// components/PermissionGate.jsx
import { useState, useEffect } from 'react'
import { api } from '../services/api'

export function PermissionGate({ 
  userId, 
  permission, 
  children, 
  fallback = null 
}) {
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await api.post('/actlog/permissions/check', {
          user_id: userId,
          permission_name: permission
        })
        setHasPermission(response.data.data.has_permission)
      } catch (error) {
        console.error('Permission check failed:', error)
        setHasPermission(false)
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [userId, permission])

  if (loading) return <div>Loading...</div>
  if (!hasPermission) return fallback

  return children
}

// Usage:
// <PermissionGate userId={currentUser.id} permission="user.create">
//   <CreateUserButton />
// </PermissionGate>
```

---

## **📋 COMMON PERMISSION PATTERNS**

### **Standard CRUD Permissions:**
```
resource.read    - View/list resources
resource.create  - Create new resources  
resource.update  - Modify existing resources
resource.delete  - Remove resources
resource.assign  - Assign resources to users/roles
```

### **Advanced Permissions:**
```
resource.export  - Export data
resource.import  - Import data
resource.approve - Approve changes
resource.audit   - View audit logs
resource.manage  - Full management access
```

### **System Permissions:**
```
system.admin     - Full system access
system.monitor   - View system status
system.backup    - Backup operations
system.config    - System configuration
```

---

## **⚡ PERFORMANCE TIPS**

1. **Use bulk permission checks** when checking multiple permissions
2. **Cache user permissions** on frontend after login
3. **Use effective permissions** endpoint for complete overview
4. **Implement permission gates** in your UI components
5. **Use debug endpoint** for troubleshooting permission issues

---

## **🔒 SECURITY NOTES**

1. All endpoints require **authentication** via JWT token
2. Users can only check **their own permissions** unless they have `permission.read`
3. **Permission assignment** requires `permission.assign` capability
4. **CRUD operations** require respective permissions (`permission.create`, etc.)
5. **Audit logging** is automatic for all permission changes

---

**✅ Hệ thống Permission API đã hoàn thiện và sẵn sàng cho Frontend integration!**