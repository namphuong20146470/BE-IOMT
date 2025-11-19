# 🏢 Organization & Department Management API Guide

## 📋 Overview

This document provides comprehensive documentation for managing Organizations and Departments in the IoMT Healthcare System. These APIs handle the hierarchical structure of healthcare organizations and their departments.

---

## 🔐 Authentication & Permissions

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Permission Requirements:
- **organization.read** - View organizations
- **organization.create** - Create organizations (super-admin only)
- **organization.update** - Update organizations
- **organization.delete** - Delete organizations (super-admin only)
- **department.read** - View departments
- **department.create** - Create departments
- **department.update** - Update departments
- **department.delete** - Delete departments

---

# 🏥 ORGANIZATIONS API

## 1. Get All Organizations

```http
GET /api/organizations
```

**Description:** Retrieve all organizations with pagination and filtering (admin/super-admin only)

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |
| `type` | string | No | Organization type filter |
| `search` | string | No | Search in name, address, email |

### Response:
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "name": "IoMT Hospital System",
            "type": "hospital",
            "address": "123 Healthcare St",
            "phone": "+1-555-0123",
            "email": "info@iomt-hospital.com",
            "website": "https://iomt-hospital.com",
            "created_at": "2025-01-01T00:00:00.000Z",
            "updated_at": "2025-01-01T00:00:00.000Z",
            "_count": {
                "users": 150,
                "departments": 12,
                "devices": 340
            }
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 5,
        "pages": 1
    },
    "message": "Organizations retrieved successfully"
}
```

---

## 2. Get Organization by ID

```http
GET /api/organizations/{id}
```

**Description:** Get specific organization details

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Organization ID |

### Response:
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "IoMT Hospital System",
        "type": "hospital",
        "address": "123 Healthcare St",
        "phone": "+1-555-0123",
        "email": "info@iomt-hospital.com",
        "website": "https://iomt-hospital.com",
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z",
        "departments": [
            {
                "id": "dept-uuid",
                "name": "Emergency Department",
                "code": "ED"
            }
        ],
        "_count": {
            "users": 150,
            "departments": 12,
            "devices": 340
        }
    },
    "message": "Organization retrieved successfully"
}
```

---

## 3. Get Current User's Organization

```http
GET /api/organizations/me
```

**Description:** Get the organization of the currently authenticated user

### Response:
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "IoMT Hospital System",
        "type": "hospital",
        "address": "123 Healthcare St",
        "phone": "+1-555-0123",
        "email": "info@iomt-hospital.com",
        "website": "https://iomt-hospital.com",
        "departments": [
            {
                "id": "dept-uuid",
                "name": "Emergency Department",
                "code": "ED"
            }
        ]
    },
    "message": "User organization retrieved successfully"
}
```

---

## 4. Create Organization

```http
POST /api/organizations
```

**Description:** Create a new organization (super-admin only)

### Request Body:
```json
{
    "name": "New Hospital",
    "type": "hospital",
    "address": "456 Medical Ave",
    "phone": "+1-555-0456",
    "email": "contact@new-hospital.com",
    "website": "https://new-hospital.com"
}
```

### Validation Rules:
- `name`: Required, string, 2-100 characters
- `type`: Required, enum: ["hospital", "clinic", "research", "other"]
- `address`: Optional, string, max 500 characters
- `phone`: Optional, string, phone format
- `email`: Required, valid email format
- `website`: Optional, valid URL format

### Response:
```json
{
    "success": true,
    "data": {
        "id": "new-uuid",
        "name": "New Hospital",
        "type": "hospital",
        "address": "456 Medical Ave",
        "phone": "+1-555-0456",
        "email": "contact@new-hospital.com",
        "website": "https://new-hospital.com",
        "created_at": "2025-01-15T10:30:00.000Z",
        "updated_at": "2025-01-15T10:30:00.000Z"
    },
    "message": "Organization created successfully"
}
```

---

## 5. Update Organization

```http
PUT /api/organizations/{id}
```

**Description:** Update organization details (admin only for own org)

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Organization ID |

### Request Body:
```json
{
    "name": "Updated Hospital Name",
    "address": "New Address",
    "phone": "+1-555-9999",
    "website": "https://updated-website.com"
}
```

### Response:
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "Updated Hospital Name",
        "type": "hospital",
        "address": "New Address",
        "phone": "+1-555-9999",
        "email": "contact@hospital.com",
        "website": "https://updated-website.com",
        "updated_at": "2025-01-15T11:00:00.000Z"
    },
    "message": "Organization updated successfully"
}
```

---

## 6. Delete Organization

```http
DELETE /api/organizations/{id}
```

**Description:** Delete organization (super-admin only, cascades to departments and devices)

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Organization ID |

### Response:
```json
{
    "success": true,
    "message": "Organization deleted successfully"
}
```

---

## 7. Get Organization Statistics

```http
GET /api/organizations/{id}/statistics
```

**Description:** Get comprehensive statistics for an organization

### Response:
```json
{
    "success": true,
    "data": {
        "organization": {
            "id": "uuid",
            "name": "IoMT Hospital System"
        },
        "statistics": {
            "total_users": 150,
            "total_departments": 12,
            "total_devices": 340,
            "active_devices": 320,
            "inactive_devices": 20,
            "devices_by_department": [
                {
                    "department_name": "Emergency Department",
                    "device_count": 45
                }
            ],
            "devices_by_visibility": {
                "public": 200,
                "department": 120,
                "private": 20
            },
            "recent_activity": {
                "devices_added_last_30_days": 15,
                "users_added_last_30_days": 8
            }
        }
    },
    "message": "Organization statistics retrieved successfully"
}
```

---

# 🏬 DEPARTMENTS API

## 1. Get All Departments

```http
GET /api/departments
```

**Description:** Get departments (filtered by user's organization or query parameters)

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |
| `organization_id` | UUID | No | Filter by organization |
| `search` | string | No | Search in name, code, description |

### Response:
```json
{
    "success": true,
    "data": [
        {
            "id": "dept-uuid",
            "name": "Emergency Department",
            "code": "ED",
            "description": "24/7 Emergency medical services",
            "organization_id": "org-uuid",
            "created_at": "2025-01-01T00:00:00.000Z",
            "updated_at": "2025-01-01T00:00:00.000Z",
            "organization": {
                "id": "org-uuid",
                "name": "IoMT Hospital System",
                "type": "hospital"
            },
            "_count": {
                "users": 25,
                "devices": 45
            }
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 12,
        "pages": 1
    },
    "message": "Departments retrieved successfully"
}
```

---

## 2. Get Department by ID

```http
GET /api/departments/{id}
```

**Description:** Get specific department details

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Department ID |

### Response:
```json
{
    "success": true,
    "data": {
        "id": "dept-uuid",
        "name": "Emergency Department",
        "code": "ED",
        "description": "24/7 Emergency medical services",
        "organization_id": "org-uuid",
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z",
        "organization": {
            "id": "org-uuid",
            "name": "IoMT Hospital System",
            "type": "hospital"
        },
        "users": [
            {
                "id": "user-uuid",
                "username": "dr.smith",
                "email": "dr.smith@hospital.com",
                "role": "doctor"
            }
        ],
        "_count": {
            "users": 25,
            "devices": 45
        }
    },
    "message": "Department retrieved successfully"
}
```

---

## 3. Get Departments by Organization

```http
GET /api/departments/organization/{organizationId}
```

**Description:** Get all departments for a specific organization

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationId` | UUID | Yes | Organization ID |

### Response:
```json
{
    "success": true,
    "data": [
        {
            "id": "dept-uuid-1",
            "name": "Emergency Department",
            "code": "ED",
            "description": "24/7 Emergency medical services"
        },
        {
            "id": "dept-uuid-2",
            "name": "Cardiology",
            "code": "CARD",
            "description": "Heart and cardiovascular care"
        }
    ],
    "message": "Organization departments retrieved successfully"
}
```

---

## 4. Create Department

```http
POST /api/departments
```

**Description:** Create a new department

### Request Body:
```json
{
    "name": "Neurology Department",
    "code": "NEURO",
    "description": "Neurological disorders and brain health",
    "organization_id": "org-uuid"
}
```

### Validation Rules:
- `name`: Required, string, 2-100 characters, unique within organization
- `code`: Required, string, 2-10 characters, uppercase, unique within organization
- `description`: Optional, string, max 500 characters
- `organization_id`: Required, valid UUID, must exist

### Response:
```json
{
    "success": true,
    "data": {
        "id": "new-dept-uuid",
        "name": "Neurology Department",
        "code": "NEURO",
        "description": "Neurological disorders and brain health",
        "organization_id": "org-uuid",
        "created_at": "2025-01-15T10:30:00.000Z",
        "updated_at": "2025-01-15T10:30:00.000Z",
        "organization": {
            "id": "org-uuid",
            "name": "IoMT Hospital System"
        }
    },
    "message": "Department created successfully"
}
```

---

## 5. Update Department

```http
PUT /api/departments/{id}
```

**Description:** Update department details

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Department ID |

### Request Body:
```json
{
    "name": "Updated Department Name",
    "description": "Updated department description"
}
```

### Response:
```json
{
    "success": true,
    "data": {
        "id": "dept-uuid",
        "name": "Updated Department Name",
        "code": "ED",
        "description": "Updated department description",
        "organization_id": "org-uuid",
        "updated_at": "2025-01-15T11:00:00.000Z"
    },
    "message": "Department updated successfully"
}
```

---

## 6. Delete Department

```http
DELETE /api/departments/{id}
```

**Description:** Delete department (moves users and devices to null department)

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Department ID |

### Response:
```json
{
    "success": true,
    "message": "Department deleted successfully",
    "affected": {
        "users_moved": 25,
        "devices_moved": 45
    }
}
```

---

## 7. Get Department Statistics

```http
GET /api/departments/{id}/statistics
```

**Description:** Get comprehensive statistics for a department

### Response:
```json
{
    "success": true,
    "data": {
        "department": {
            "id": "dept-uuid",
            "name": "Emergency Department",
            "code": "ED"
        },
        "statistics": {
            "total_users": 25,
            "total_devices": 45,
            "active_devices": 42,
            "inactive_devices": 3,
            "devices_by_status": {
                "active": 42,
                "maintenance": 2,
                "inactive": 1
            },
            "devices_by_visibility": {
                "public": 10,
                "department": 30,
                "private": 5
            },
            "recent_activity": {
                "devices_added_last_30_days": 3,
                "users_added_last_30_days": 2
            }
        }
    },
    "message": "Department statistics retrieved successfully"
}
```

---

## 8. Get Organization Department Statistics

```http
GET /api/departments/organization/{organizationId}/statistics
```

**Description:** Get statistics for all departments in an organization

### Response:
```json
{
    "success": true,
    "data": {
        "organization": {
            "id": "org-uuid",
            "name": "IoMT Hospital System"
        },
        "department_statistics": [
            {
                "department": {
                    "id": "dept-uuid-1",
                    "name": "Emergency Department",
                    "code": "ED"
                },
                "users": 25,
                "devices": 45,
                "active_devices": 42
            },
            {
                "department": {
                    "id": "dept-uuid-2",
                    "name": "Cardiology",
                    "code": "CARD"
                },
                "users": 18,
                "devices": 32,
                "active_devices": 30
            }
        ],
        "totals": {
            "total_departments": 12,
            "total_users": 150,
            "total_devices": 340,
            "total_active_devices": 320
        }
    },
    "message": "Organization department statistics retrieved successfully"
}
```

---

## 🔒 Security & Access Control

### User Access Levels:

1. **Super Admin**
   - Full access to all organizations and departments
   - Can create/delete organizations
   - Can manage any department

2. **Organization Admin**
   - Full access within their organization
   - Can manage departments in their org
   - Cannot access other organizations

3. **Department Manager**
   - Full access within their department
   - Can view organization data
   - Limited department management

4. **Regular User**
   - Read access to their organization/department
   - Cannot create/update/delete

### Data Isolation:
- Non-super-admin users are automatically filtered to their organization
- Department access is controlled by user permissions
- Cross-organization access is blocked

---

## 🚨 Error Responses

### Common Error Codes:

```json
{
    "success": false,
    "message": "Error description",
    "error": "Detailed error information"
}
```

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request data or validation errors |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate data (e.g., department code exists) |
| 500 | Server Error | Internal server error |

### Example Error Response:
```json
{
    "success": false,
    "message": "Validation failed",
    "error": {
        "name": "Department name is required",
        "code": "Department code must be unique within organization"
    }
}
```

---

## 📝 Usage Examples

### Frontend Integration Examples:

#### Get User's Organization Departments:
```typescript
const response = await fetch('/api/organizations/me');
const orgData = await response.json();
const departments = orgData.data.departments;
```

#### Create New Department:
```typescript
const newDepartment = {
    name: "Radiology",
    code: "RAD", 
    description: "Medical imaging services",
    organization_id: "org-uuid"
};

const response = await fetch('/api/departments', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(newDepartment)
});
```

#### Filter Departments by Organization:
```typescript
const response = await fetch(`/api/departments?organization_id=${orgId}&search=emergency`);
const departments = await response.json();
```

---

## 🎯 Best Practices

1. **Always validate organization access** before operations
2. **Use pagination** for large datasets
3. **Implement proper error handling** for all API calls
4. **Cache organization/department data** in frontend for performance
5. **Use search functionality** for better UX in dropdowns
6. **Handle permission-based UI visibility** appropriately

---

## 🔄 Related APIs

- **[Users API](./USER_API.md)** - User management within organizations/departments
- **[Devices API](./DEVICE_API.md)** - Device assignment to departments
- **[RBAC API](./RBAC_API.md)** - Role and permission management

---

*Last updated: November 19, 2025*