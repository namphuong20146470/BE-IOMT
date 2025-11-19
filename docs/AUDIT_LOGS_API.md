# 📊 Audit Logs Management API Guide

## 📋 Overview

This document provides comprehensive documentation for the Audit Logs system in the IoMT Healthcare Platform. The audit logs track all user activities, system changes, and security events for compliance and monitoring purposes.

---

## 🔐 Authentication & Permissions

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Permission Requirements:
- **audit.read** - View audit logs and statistics
- **audit.export** - Export audit logs (CSV/JSON)
- **audit.create** - Create audit logs (system internal)
- **audit.delete** - Delete audit logs (admin only)

### Enhanced Security Features:
- **Organization-level filtering** - Non-super admins only see their organization's logs
- **RBAC protection** - All endpoints require appropriate permissions
- **Anomaly detection** - Automated security monitoring
- **Data retention** - Automated cleanup with archival support

---

## 📈 Audit Log Schema

### Audit Log Object Structure:
```json
{
    "id": "uuid",
    "user_id": "uuid or null",
    "organization_id": "uuid or null",
    "action": "enum: create|read|update|delete|login|logout|failed_login|permission_granted|permission_revoked|role_assigned",
    "resource_type": "string (e.g., 'device', 'user', 'organization')",
    "resource_id": "uuid or null",
    "old_values": "json object",
    "new_values": "json object", 
    "ip_address": "inet",
    "user_agent": "string",
    "success": "boolean",
    "error_message": "string or null",
    "created_at": "timestamp",
    "users": {
        "id": "uuid",
        "username": "string",
        "full_name": "string",
        "email": "string"
    },
    "organizations": {
        "id": "uuid", 
        "name": "string",
        "type": "string"
    }
}
```

---

# 📋 AUDIT LOGS API ENDPOINTS

## 1. Get All Audit Logs

```http
GET /api/logs
```

**Description:** Retrieve audit logs with advanced filtering and pagination

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50, max: 1000) |
| `user_id` | UUID | No | Filter by specific user |
| `action` | string | No | Filter by action type |
| `resource_type` | string | No | Filter by resource type |
| `success` | boolean | No | Filter by success status (true/false) |
| `from_date` | date | No | Start date (YYYY-MM-DD) |
| `to_date` | date | No | End date (YYYY-MM-DD) |
| `search` | string | No | Search across action, resource_type, ip_address |

### Example Request:
```http
GET /api/logs?page=1&limit=20&action=update&success=true&from_date=2025-01-01&to_date=2025-01-31
```

### Response:
```json
{
    "success": true,
    "message": "Audit logs retrieved successfully",
    "data": {
        "logs": [
            {
                "id": "log-uuid-1",
                "user_id": "user-uuid",
                "organization_id": "org-uuid",
                "action": "update",
                "resource_type": "device",
                "resource_id": "device-uuid",
                "old_values": {
                    "status": "active",
                    "department_id": null
                },
                "new_values": {
                    "status": "active", 
                    "department_id": "dept-uuid"
                },
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0...",
                "success": true,
                "error_message": null,
                "created_at": "2025-01-15T10:30:00.000Z",
                "users": {
                    "id": "user-uuid",
                    "username": "dr.smith",
                    "full_name": "Dr. John Smith",
                    "email": "dr.smith@hospital.com"
                },
                "organizations": {
                    "id": "org-uuid",
                    "name": "IoMT Hospital System",
                    "type": "hospital"
                }
            }
        ],
        "pagination": {
            "current_page": 1,
            "total_pages": 5,
            "total_count": 95,
            "per_page": 20,
            "has_next_page": true,
            "has_prev_page": false
        }
    }
}
```

---

## 2. Get Audit Log by ID

```http
GET /api/logs/{id}
```

**Description:** Get detailed information about a specific audit log

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Audit log ID |

### Response:
```json
{
    "success": true,
    "message": "Audit log retrieved successfully",
    "data": {
        "id": "log-uuid",
        "user_id": "user-uuid",
        "organization_id": "org-uuid",
        "action": "create",
        "resource_type": "user",
        "resource_id": "new-user-uuid",
        "old_values": null,
        "new_values": {
            "username": "new.user",
            "email": "new.user@hospital.com",
            "role": "doctor"
        },
        "ip_address": "192.168.1.50",
        "user_agent": "Mozilla/5.0...",
        "success": true,
        "error_message": null,
        "created_at": "2025-01-15T14:22:00.000Z",
        "users": {
            "id": "user-uuid",
            "username": "admin",
            "full_name": "System Administrator",
            "email": "admin@hospital.com"
        },
        "organizations": {
            "id": "org-uuid",
            "name": "IoMT Hospital System", 
            "type": "hospital"
        }
    }
}
```

---

## 3. Create Audit Log

```http
POST /api/logs
```

**Description:** Create a new audit log entry (usually done by system automatically)

### Request Body:
```json
{
    "user_id": "user-uuid",
    "organization_id": "org-uuid", 
    "action": "update",
    "resource_type": "device",
    "resource_id": "device-uuid",
    "old_values": {
        "status": "inactive"
    },
    "new_values": {
        "status": "active"
    },
    "success": true,
    "error_message": null
}
```

### Validation Rules:
- `action`: Required, must be one of the audit_action enum values
- `user_id`: Optional, UUID format if provided
- `organization_id`: Optional, UUID format if provided
- `resource_type`: Optional, string (e.g., 'device', 'user', 'organization')
- `resource_id`: Optional, UUID format if provided
- `old_values`: Optional, JSON object
- `new_values`: Optional, JSON object
- `success`: Optional, boolean (default: true)
- `error_message`: Optional, string

### Response:
```json
{
    "success": true,
    "message": "Audit log created successfully",
    "data": {
        "id": "new-log-uuid",
        "user_id": "user-uuid",
        "organization_id": "org-uuid",
        "action": "update",
        "resource_type": "device",
        "resource_id": "device-uuid",
        "old_values": {"status": "inactive"},
        "new_values": {"status": "active"},
        "ip_address": "192.168.1.100",
        "user_agent": "PostmanRuntime/7.29.2",
        "success": true,
        "error_message": null,
        "created_at": "2025-01-15T15:45:00.000Z"
    }
}
```

---

## 4. Get Audit Log Statistics

```http
GET /api/logs/stats
```

**Description:** Get comprehensive statistics about audit logs

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Number of days to analyze (default: 7) |

### Example Request:
```http
GET /api/logs/stats?days=30
```

### Response:
```json
{
    "success": true,
    "message": "Audit log statistics retrieved successfully",
    "data": {
        "period_days": 30,
        "total_logs": 15420,
        "recent_logs": 2840,
        "success_logs": 2755,
        "failure_logs": 85,
        "success_rate": "97.01",
        "top_actions": [
            {"action": "read", "count": 1205},
            {"action": "update", "count": 850},
            {"action": "create", "count": 425},
            {"action": "login", "count": 285},
            {"action": "delete", "count": 75}
        ],
        "top_resource_types": [
            {"resource_type": "device", "count": 985},
            {"resource_type": "user", "count": 650},
            {"resource_type": "organization", "count": 125},
            {"resource_type": "department", "count": 80}
        ],
        "top_users": [
            {
                "id": "user-1",
                "username": "dr.smith",
                "full_name": "Dr. John Smith",
                "log_count": 245
            },
            {
                "id": "user-2",
                "username": "nurse.jane",
                "full_name": "Jane Wilson",
                "log_count": 190
            }
        ]
    }
}
```

---

## 5. Export Audit Logs

```http
GET /api/logs/export
```

**Description:** Export audit logs in JSON or CSV format

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Export format: 'json' or 'csv' (default: 'json') |
| `user_id` | UUID | No | Filter by specific user |
| `action` | string | No | Filter by action type |
| `resource_type` | string | No | Filter by resource type |
| `from_date` | date | No | Start date (YYYY-MM-DD) |
| `to_date` | date | No | End date (YYYY-MM-DD) |
| `limit` | integer | No | Maximum records to export (default: 1000) |

### Example Requests:

#### JSON Export:
```http
GET /api/logs/export?format=json&from_date=2025-01-01&to_date=2025-01-31&limit=500
```

#### CSV Export:
```http
GET /api/logs/export?format=csv&user_id=user-uuid&action=update
```

### JSON Response:
```json
{
    "success": true,
    "message": "Audit logs exported successfully", 
    "count": 150,
    "data": [
        {
            "id": "log-uuid",
            "action": "update",
            "resource_type": "device",
            "users": {"username": "dr.smith"},
            "organizations": {"name": "IoMT Hospital"},
            "created_at": "2025-01-15T10:30:00.000Z"
        }
    ]
}
```

### CSV Response:
```csv
ID,User,Organization,Action,Resource Type,Resource ID,Success,IP Address,Created At
"log-uuid-1","dr.smith","IoMT Hospital System","update","device","device-uuid","true","192.168.1.100","2025-01-15T10:30:00.000Z"
"log-uuid-2","nurse.jane","IoMT Hospital System","create","user","user-uuid","true","192.168.1.50","2025-01-15T11:15:00.000Z"
```

---

## 6. Delete Audit Log

```http
DELETE /api/logs/{id}
```

**Description:** Delete a specific audit log (admin only)

### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Audit log ID to delete |

### Response:
```json
{
    "success": true,
    "message": "Audit log deleted successfully"
}
```

---

## 7. Bulk Delete Audit Logs

```http
DELETE /api/logs/bulk
```

**Description:** Delete multiple audit logs at once (admin only)

### Request Body:
```json
{
    "ids": [
        "log-uuid-1",
        "log-uuid-2", 
        "log-uuid-3"
    ],
    "confirm_delete": "CONFIRM_DELETE"
}
```

### Validation:
- `ids`: Required, array of UUIDs
- `confirm_delete`: Required, must be exactly "CONFIRM_DELETE"

### Response:
```json
{
    "success": true,
    "message": "Successfully deleted 3 audit logs",
    "deleted_count": 3
}
```

---

## 8. Delete All Audit Logs

```http
DELETE /api/logs/all
```

**Description:** Delete all audit logs (super admin only, use with extreme caution)

### Request Body:
```json
{
    "confirmReset": "CONFIRM_DELETE_ALL_DATA"
}
```

### Validation:
- `confirmReset`: Required, must be exactly "CONFIRM_DELETE_ALL_DATA"

### Response:
```json
{
    "success": true,
    "message": "All audit logs deleted successfully",
    "deleted_count": 15420,
    "count_before": 15420
}
```

---

## 🔍 Audit Action Types

The system tracks the following action types:

| Action | Description | Example Use Case |
|--------|-------------|------------------|
| `create` | Resource creation | User creates new device |
| `read` | Resource access | User views device list |
| `update` | Resource modification | User updates device status |
| `delete` | Resource deletion | User deletes device |
| `login` | User authentication | User logs into system |
| `logout` | User session end | User logs out |
| `failed_login` | Failed authentication | Invalid credentials |
| `permission_granted` | Permission assignment | Admin grants permission |
| `permission_revoked` | Permission removal | Admin removes permission |
| `role_assigned` | Role assignment | Admin assigns role to user |

---

## 🎯 Common Use Cases

### 1. Security Monitoring
```http
# Monitor failed login attempts
GET /api/logs?action=failed_login&from_date=2025-01-01

# Track admin actions
GET /api/logs?resource_type=user&action=create&success=true
```

### 2. Compliance Auditing
```http
# Export monthly compliance report
GET /api/logs/export?format=csv&from_date=2025-01-01&to_date=2025-01-31

# Track device modifications
GET /api/logs?resource_type=device&action=update&limit=100
```

### 3. User Activity Analysis
```http
# Get user activity statistics
GET /api/logs/stats?days=30

# Track specific user actions
GET /api/logs?user_id=user-uuid&from_date=2025-01-01
```

### 4. Error Investigation
```http
# Find system errors
GET /api/logs?success=false&from_date=2025-01-15

# Get detailed error log
GET /api/logs/error-log-uuid
```

---

## 🔒 Security & Access Control

### Permission Levels:

1. **Super Admin**
   - Full access to all audit logs
   - Can delete audit logs
   - Can export unlimited records

2. **Organization Admin** 
   - View audit logs within their organization
   - Can export organization data
   - Cannot delete audit logs

3. **Department Manager**
   - View audit logs related to their department
   - Limited export capabilities
   - Read-only access

4. **Regular User**
   - No access to audit logs
   - May view their own activity (future feature)

### Data Privacy:
- Sensitive data in `old_values` and `new_values` is automatically masked
- IP addresses are logged but can be anonymized for GDPR compliance
- User agents are truncated to prevent fingerprinting

---

## 📊 Performance Considerations

### Indexing:
- Optimized indexes on `user_id`, `organization_id`, `action`, `created_at`
- Composite indexes for common query patterns
- Resource-based indexes for efficient filtering

### Pagination:
- Default limit: 50 records per page
- Maximum limit: 1000 records per page
- Cursor-based pagination for large datasets

### Archiving:
- Automatic archiving of logs older than 1 year
- Compressed storage for historical data
- Configurable retention policies

---

## 🚨 Error Responses

### Common Error Codes:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid query parameters or request body |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions for operation |
| 404 | Not Found | Audit log not found |
| 429 | Rate Limited | Too many export requests |
| 500 | Server Error | Internal server error |

### Example Error Response:
```json
{
    "success": false,
    "message": "Invalid date format",
    "error": {
        "from_date": "Date must be in YYYY-MM-DD format",
        "to_date": "End date must be after start date"
    }
}
```

---

## 📝 Frontend Integration Examples

### React/TypeScript Integration:

#### Fetch Audit Logs:
```typescript
interface AuditLog {
    id: string;
    action: string;
    resource_type: string;
    success: boolean;
    created_at: string;
    users?: {
        username: string;
        full_name: string;
    };
}

const fetchAuditLogs = async (filters: {
    page?: number;
    limit?: number;
    action?: string;
    success?: boolean;
}): Promise<AuditLog[]> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
    });
    
    const response = await fetch(`/api/logs?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const data = await response.json();
    return data.data.logs;
};
```

#### Export Audit Logs:
```typescript
const exportAuditLogs = async (format: 'json' | 'csv' = 'csv') => {
    const response = await fetch(`/api/logs/export?format=${format}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    } else {
        const data = await response.json();
        console.log('Exported logs:', data.data);
    }
};
```

#### Get Audit Statistics:
```typescript
const fetchAuditStats = async (days: number = 7) => {
    const response = await fetch(`/api/logs/stats?days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const data = await response.json();
    return data.data;
};
```

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor:
- Failed login attempt spikes
- Unusual deletion activities
- Permission changes
- After-hours access patterns
- Error rate trends

### Recommended Alerts:
- More than 5 failed logins from same IP in 5 minutes
- Any deletion of audit logs
- Bulk user/device modifications
- System admin activities outside business hours

---

## 🔄 Related APIs

- **[Users API](./USER_API.md)** - User activities are logged here
- **[Devices API](./DEVICE_API.md)** - Device operations are audited
- **[Organizations API](./ORGANIZATION_DEPARTMENT_API.md)** - Org changes are tracked
- **[RBAC API](./RBAC_API.md)** - Permission changes are logged

---

## 📋 Best Practices

1. **Regular Monitoring**: Review audit logs daily for security incidents
2. **Retention Policy**: Archive logs older than 1 year to manage storage
3. **Export Backups**: Regular exports for compliance and disaster recovery
4. **Access Control**: Limit audit log access to authorized personnel only
5. **Performance**: Use appropriate filters and pagination for large datasets
6. **Alerting**: Set up automated alerts for critical security events

---

## 9. Get Audit Log Timeline

```http
GET /api/logs/timeline
```

**Description:** Get timeline analytics with trend analysis

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Number of days to analyze (default: 7) |
| `interval` | string | No | Time interval: 'hour', 'day', 'week' (default: 'hour') |

### Response:
```json
{
    "success": true,
    "message": "Audit log timeline retrieved successfully",
    "data": {
        "period_days": 7,
        "interval": "hour",
        "timeline": [
            {
                "time_period": "2025-01-15T10:00:00.000Z",
                "total_count": 45,
                "success_count": 42,
                "failure_count": 3,
                "actions": {
                    "read": {"count": 25, "success_count": 25, "failure_count": 0},
                    "update": {"count": 15, "success_count": 14, "failure_count": 1},
                    "login": {"count": 5, "success_count": 3, "failure_count": 2}
                }
            }
        ],
        "summary": {
            "total_periods": 168,
            "total_logs": 2840,
            "avg_logs_per_period": "16.90"
        }
    }
}
```

---

## 10. Detect Anomalies

```http
GET /api/logs/anomalies
```

**Description:** Detect security anomalies in audit logs

### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Analysis period (default: 7) |
| `threshold_multiplier` | number | No | Sensitivity threshold (default: 2) |

### Response:
```json
{
    "success": true,
    "message": "Audit log anomalies detected successfully",
    "data": {
        "period_days": 7,
        "total_anomalies": 5,
        "anomalies_by_severity": {
            "high": 2,
            "medium": 3,
            "low": 0
        },
        "anomalies": [
            {
                "type": "excessive_failed_logins",
                "severity": "high", 
                "user_id": "user-uuid",
                "count": 8,
                "description": "User has 8 failed login attempts in 7 days",
                "user": {
                    "id": "user-uuid",
                    "username": "suspicious.user",
                    "full_name": "Suspicious User",
                    "email": "user@example.com"
                }
            },
            {
                "type": "after_hours_activity",
                "severity": "medium",
                "user_id": "user-uuid-2",
                "count": 15,
                "description": "User has 15 activities outside business hours"
            }
        ]
    }
}
```

### Anomaly Types:
- **excessive_failed_logins** - Too many failed login attempts
- **after_hours_activity** - Activities outside 6 AM - 10 PM
- **bulk_deletion** - Unusual number of delete operations
- **multiple_ip_addresses** - User accessing from too many IPs

---

## 11. Cleanup Old Logs

```http
POST /api/logs/cleanup
```

**Description:** Cleanup old logs based on retention policy (super admin only)

### Request Body:
```json
{
    "retention_days": 365,
    "confirm_cleanup": true,
    "archive_before_delete": true
}
```

### Validation Rules:
- `retention_days`: Optional, integer, days to retain (default: 365)
- `confirm_cleanup`: Required, must be true to confirm
- `archive_before_delete`: Optional, boolean, archive before deletion (default: true)

### Response:
```json
{
    "success": true,
    "message": "Audit logs cleanup completed successfully",
    "data": {
        "retention_days": 365,
        "cutoff_date": "2024-01-15T10:30:00.000Z",
        "logs_cleaned": 5420,
        "logs_archived": 5420,
        "archive_enabled": true
    }
}
```

---

## 🚀 **Enhanced Features Summary**

### 🔒 **Security Enhancements:**
1. **Organization-level Access Control** - Users only see their org's logs
2. **RBAC Protection** - All endpoints require appropriate permissions  
3. **Anomaly Detection** - Automated security monitoring
4. **IP Tracking** - Geographic and unusual access pattern detection

### 📊 **Advanced Analytics:**
1. **Timeline Analysis** - Trend visualization with configurable intervals
2. **Behavioral Analysis** - User activity pattern recognition
3. **Statistical Insights** - Success rates, peak activity times
4. **Comparative Analysis** - Period-over-period comparisons

### 🗄️ **Data Management:**
1. **Retention Policies** - Automated cleanup with configurable retention
2. **Archival Support** - Safe archiving before deletion
3. **Performance Optimization** - Efficient queries with proper indexing
4. **Scalability** - Partitioned data access and pagination

### 🎯 **Compliance Features:**
1. **Audit Trail Completeness** - All actions tracked with full context
2. **Data Integrity** - Immutable log records with validation
3. **Privacy Controls** - GDPR-compliant data handling
4. **Regulatory Reporting** - Export capabilities for compliance

---

*Last updated: November 19, 2025*