# Frontend Permissions API Documentation

## Tổng quan
Hệ thống permissions được tích hợp vào authentication flow và có thể được lấy qua nhiều cách khác nhau tùy thuộc vào nhu cầu của Frontend.

## 1. Lấy Permissions qua Login Response

### Endpoint: `POST /auth/login`

Khi user đăng nhập thành công, permissions sẽ được trả về cùng với thông tin user trong response.

**Request:**
```json
{
    "username": "admin",
    "password": "password123"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Đăng nhập thành công",
    "data": {
        "user": {
            "id": "uuid-string",
            "username": "admin",
            "full_name": "Administrator",
            "email": "admin@example.com",
            "phone": "+84123456789",
            "organization_id": "org-uuid",
            "department_id": "dept-uuid",
            "organization_name": "My Organization",
            "department_name": "IT Department",
            "roles": [
                {
                    "id": "role-uuid",
                    "name": "Super Admin",
                    "description": "Full system access",
                    "color": "#ff0000",
                    "icon": "admin-icon",
                    "permissions": [
                        "user.create",
                        "user.read",
                        "user.update",
                        "user.delete",
                        "device.manage",
                        "system.admin"
                    ]
                }
            ]
        },
        "tokens": {
            "accessToken": "jwt-access-token",
            "refreshToken": "jwt-refresh-token"
        }
    }
}
```

### Cách sử dụng trong Frontend:
```javascript
// Login và lưu permissions
async function login(credentials) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const { user, tokens } = result.data;
            
            // Lưu tokens
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('refreshToken', tokens.refreshToken);
            
            // Extract all permissions từ tất cả roles
            const allPermissions = user.roles.flatMap(role => role.permissions);
            const uniquePermissions = [...new Set(allPermissions)];
            
            // Lưu permissions để sử dụng
            localStorage.setItem('userPermissions', JSON.stringify(uniquePermissions));
            localStorage.setItem('userRoles', JSON.stringify(user.roles));
            
            return { user, permissions: uniquePermissions };
        }
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}
```

## 2. Lấy Permissions qua Profile API

### Endpoint: `GET /auth/profile`

Dùng để lấy thông tin profile đầy đủ bao gồm permissions (cần authentication header).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": "user-uuid",
        "username": "admin",
        "full_name": "Administrator",
        "email": "admin@example.com",
        "phone": "+84123456789",
        "organization_id": "org-uuid",
        "department_id": "dept-uuid",
        "organization_name": "My Organization", 
        "department_name": "IT Department",
        "is_active": true,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z",
        "roles": [
            {
                "id": "role-uuid",
                "name": "Super Admin",
                "description": "Full system access",
                "color": "#ff0000",
                "icon": "admin-icon",
                "permissions": [
                    "user.create",
                    "user.read", 
                    "user.update",
                    "user.delete",
                    "device.manage",
                    "system.admin"
                ]
            }
        ]
    }
}
```

### Cách sử dụng:
```javascript
async function getUserProfile() {
    try {
        const token = localStorage.getItem('accessToken');
        
        const response = await fetch('/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const user = result.data;
            const allPermissions = user.roles.flatMap(role => role.permissions);
            const uniquePermissions = [...new Set(allPermissions)];
            
            return { user, permissions: uniquePermissions };
        }
    } catch (error) {
        console.error('Get profile failed:', error);
        throw error;
    }
}
```

## 3. Lấy Chi tiết User với Sessions

### Endpoint: `GET /auth/me`

Trả về thông tin user cùng với số lượng active sessions.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": "user-uuid",
        "username": "admin",
        "full_name": "Administrator",
        "email": "admin@example.com",
        "phone": "+84123456789",
        "organization_name": "My Organization",
        "department_name": "IT Department",
        "active_sessions": 2,
        "roles": [
            {
                "id": "role-uuid",
                "name": "Super Admin", 
                "permissions": ["user.create", "user.read", "user.update"]
            }
        ]
    }
}
```

## 4. Permission Helper Functions cho Frontend

### JavaScript Helper Class:
```javascript
class PermissionManager {
    constructor() {
        this.permissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
        this.roles = JSON.parse(localStorage.getItem('userRoles') || '[]');
    }
    
    // Kiểm tra có permission cụ thể
    hasPermission(permission) {
        return this.permissions.includes(permission);
    }
    
    // Kiểm tra có bất kỳ permission nào trong danh sách
    hasAnyPermission(permissions) {
        return permissions.some(permission => this.hasPermission(permission));
    }
    
    // Kiểm tra có tất cả permissions
    hasAllPermissions(permissions) {
        return permissions.every(permission => this.hasPermission(permission));
    }
    
    // Kiểm tra có role cụ thể
    hasRole(roleName) {
        return this.roles.some(role => role.name === roleName);
    }
    
    // Lấy tất cả permissions
    getAllPermissions() {
        return [...this.permissions];
    }
    
    // Lấy permissions theo module
    getPermissionsByModule(module) {
        return this.permissions.filter(permission => 
            permission.startsWith(`${module}.`)
        );
    }
    
    // Refresh permissions từ server
    async refreshPermissions() {
        try {
            const profileData = await getUserProfile();
            this.permissions = profileData.permissions;
            this.roles = profileData.user.roles;
            
            localStorage.setItem('userPermissions', JSON.stringify(this.permissions));
            localStorage.setItem('userRoles', JSON.stringify(this.roles));
            
            return true;
        } catch (error) {
            console.error('Failed to refresh permissions:', error);
            return false;
        }
    }
    
    // Clear permissions (logout)
    clearPermissions() {
        this.permissions = [];
        this.roles = [];
        localStorage.removeItem('userPermissions');
        localStorage.removeItem('userRoles');
    }
}

// Sử dụng
const permissionManager = new PermissionManager();
```

## 5. React Hook cho Permissions

### usePermissions Hook:
```javascript
import { useState, useEffect, useContext } from 'react';

const usePermissions = () => {
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const loadPermissions = () => {
            const storedPermissions = JSON.parse(
                localStorage.getItem('userPermissions') || '[]'
            );
            const storedRoles = JSON.parse(
                localStorage.getItem('userRoles') || '[]'
            );
            
            setPermissions(storedPermissions);
            setRoles(storedRoles);
            setLoading(false);
        };
        
        loadPermissions();
    }, []);
    
    const hasPermission = (permission) => {
        return permissions.includes(permission);
    };
    
    const hasAnyPermission = (permissionList) => {
        return permissionList.some(permission => hasPermission(permission));
    };
    
    const hasRole = (roleName) => {
        return roles.some(role => role.name === roleName);
    };
    
    return {
        permissions,
        roles,
        loading,
        hasPermission,
        hasAnyPermission,
        hasRole
    };
};

export default usePermissions;
```

### Sử dụng trong Component:
```jsx
import React from 'react';
import usePermissions from './hooks/usePermissions';

const UserManagement = () => {
    const { hasPermission, hasAnyPermission, loading } = usePermissions();
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            <h1>User Management</h1>
            
            {hasPermission('user.create') && (
                <button>Create User</button>
            )}
            
            {hasPermission('user.update') && (
                <button>Edit User</button>
            )}
            
            {hasPermission('user.delete') && (
                <button>Delete User</button>
            )}
            
            {hasAnyPermission(['user.read', 'user.list']) && (
                <UserList />
            )}
        </div>
    );
};
```

## 6. Protected Route Component

### ProtectedRoute cho React Router:
```jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import usePermissions from './hooks/usePermissions';

const ProtectedRoute = ({ 
    children, 
    requiredPermissions = [], 
    requiredRoles = [],
    requireAll = false 
}) => {
    const { hasPermission, hasRole, hasAnyPermission, loading } = usePermissions();
    
    if (loading) {
        return <div>Checking permissions...</div>;
    }
    
    // Kiểm tra authentication
    const token = localStorage.getItem('accessToken');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    
    // Kiểm tra permissions
    if (requiredPermissions.length > 0) {
        const hasRequiredPermissions = requireAll 
            ? requiredPermissions.every(permission => hasPermission(permission))
            : hasAnyPermission(requiredPermissions);
            
        if (!hasRequiredPermissions) {
            return <Navigate to="/unauthorized" replace />;
        }
    }
    
    // Kiểm tra roles
    if (requiredRoles.length > 0) {
        const hasRequiredRoles = requireAll
            ? requiredRoles.every(role => hasRole(role))
            : requiredRoles.some(role => hasRole(role));
            
        if (!hasRequiredRoles) {
            return <Navigate to="/unauthorized" replace />;
        }
    }
    
    return children;
};

// Sử dụng trong Routes
<Route 
    path="/admin" 
    element={
        <ProtectedRoute requiredPermissions={['system.admin']}>
            <AdminPanel />
        </ProtectedRoute>
    } 
/>

<Route 
    path="/users" 
    element={
        <ProtectedRoute requiredPermissions={['user.read', 'user.list']} requireAll={false}>
            <UserManagement />
        </ProtectedRoute>
    } 
/>
```

## 7. Các Permission Patterns Phổ biến

### CRUD Permissions:
```
user.create    - Tạo user mới
user.read      - Xem thông tin user
user.update    - Cập nhật user
user.delete    - Xóa user
user.list      - Danh sách users
```

### Module Permissions:
```
device.manage     - Quản lý devices
system.admin      - Quản trị hệ thống
report.view       - Xem báo cáo
audit.access      - Truy cập audit logs
permission.manage - Quản lý permissions
```

## 8. Error Handling

### Xử lý lỗi permissions:
```javascript
// Interceptor cho API calls
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 403) {
            // Không đủ quyền
            console.error('Access denied:', error.response.data.message);
            // Redirect hoặc show error message
        }
        
        if (error.response?.status === 401) {
            // Token expired hoặc invalid
            localStorage.clear();
            window.location.href = '/login';
        }
        
        return Promise.reject(error);
    }
);
```

## 9. Best Practices

### Frontend Security:
1. **Luôn validate permissions ở Backend** - Frontend chỉ để UX/UI
2. **Cache permissions nhưng có refresh mechanism**
3. **Clear permissions khi logout**
4. **Validate token expiry**
5. **Handle permission changes real-time nếu cần**

### Performance:
1. **Cache permissions trong localStorage/sessionStorage**
2. **Lazy load permissions theo module**
3. **Debounce permission checks**
4. **Use React.memo cho permission-based components**

### UX:
1. **Show loading states**
2. **Graceful degradation khi thiếu permissions**
3. **Clear error messages**
4. **Disable vs Hide elements based on permissions**

## 10. Testing

### Unit Testing Permissions:
```javascript
// Jest test example
import { PermissionManager } from './PermissionManager';

describe('PermissionManager', () => {
    let permissionManager;
    
    beforeEach(() => {
        localStorage.setItem('userPermissions', JSON.stringify([
            'user.read', 'user.create', 'device.manage'
        ]));
        permissionManager = new PermissionManager();
    });
    
    test('should check single permission correctly', () => {
        expect(permissionManager.hasPermission('user.read')).toBe(true);
        expect(permissionManager.hasPermission('user.delete')).toBe(false);
    });
    
    test('should check multiple permissions', () => {
        expect(permissionManager.hasAnyPermission(['user.read', 'user.write'])).toBe(true);
        expect(permissionManager.hasAllPermissions(['user.read', 'user.create'])).toBe(true);
    });
});
```

Hy vọng documentation này giúp Frontend team hiểu rõ cách integrate permissions vào ứng dụng!