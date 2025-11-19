# 🔍 Enhanced Audit System Implementation Guide

## 📋 Tổng quan

Hệ thống Audit đã được nâng cấp với những tính năng mạnh mẽ:

1. **AuditLogger Service** - Standardized audit logging
2. **Audit Middleware** - Automatic API call logging  
3. **Data Quality Improvements** - Consistent và clean data
4. **Enhanced Security** - Better anomaly detection

---

## 🚀 Cách sử dụng Enhanced Audit System

### 1. AuditLogger Service

#### Basic Usage:
```javascript
import AuditLogger from '../shared/services/AuditLogger.js';

// Manual audit logging
await AuditLogger.log({
    req,
    action: 'create',
    resource_type: 'device',
    resource_id: deviceId,
    old_values: null,
    new_values: deviceData,
    success: true
});
```

#### Authentication Logging:
```javascript
// Login success
await AuditLogger.logAuth({
    req,
    user_id: user.id,
    username: user.username,
    action: 'login',
    success: true,
    additional_data: {
        login_method: 'password',
        two_factor: false
    }
});

// Failed login
await AuditLogger.logAuth({
    req,
    username: attemptedUsername,
    action: 'failed_login',
    success: false,
    error_message: 'Invalid credentials',
    additional_data: {
        attempts_count: 3,
        blocked: false
    }
});
```

#### CRUD Operations:
```javascript
// Create operation
await AuditLogger.logCRUD({
    req,
    action: 'create',
    resource_type: 'device',
    resource_id: newDevice.id,
    new_values: {
        name: newDevice.name,
        type: newDevice.type,
        department_id: newDevice.department_id
    },
    success: true
});

// Update operation  
await AuditLogger.logCRUD({
    req,
    action: 'update',
    resource_type: 'device',
    resource_id: device.id,
    old_values: { status: 'inactive' },
    new_values: { status: 'active' },
    success: true
});

// Delete operation
await AuditLogger.logCRUD({
    req,
    action: 'delete',
    resource_type: 'device',
    resource_id: deviceId,
    old_values: deviceSnapshot,
    success: true
});
```

#### Security Events:
```javascript
// Permission granted
await AuditLogger.logSecurity({
    req,
    event_type: 'permission_granted',
    target_user_id: targetUser.id,
    details: {
        permission: 'device.create',
        granted_by: req.user.id,
        scope: 'organization'
    },
    success: true
});

// Role assignment
await AuditLogger.logSecurity({
    req,
    event_type: 'role_assigned',
    target_user_id: user.id,
    details: {
        role: 'manager',
        previous_role: 'user',
        assigned_by: req.user.id
    },
    success: true
});
```

### 2. Audit Middleware

#### Setup in Express App:
```javascript
import { auditMiddleware, auditAuth } from './shared/middleware/auditMiddleware.js';

// Global audit middleware (logs all API calls)
app.use(auditMiddleware({
    skipPaths: ['/health', '/metrics', '/favicon.ico'],
    skipMethods: ['OPTIONS'],
    logOnlyAuthenticatedUsers: true,
    includeRequestBody: false, // Set to true for detailed logging
    includeResponseData: false // Set to true for response tracking
}));

// Auth-specific audit middleware
app.use('/api', auditAuth);
```

#### Using in Controllers:
```javascript
export const createDevice = async (req, res) => {
    try {
        const deviceData = req.body;
        
        // Create device
        const device = await prisma.device.create({
            data: deviceData
        });

        // Audit the creation (automatic via middleware, but manual for detailed info)
        await req.audit.logCRUD({
            action: 'create',
            resource_type: 'device',
            resource_id: device.id,
            new_values: {
                name: device.name,
                serial_number: device.serial_number,
                department: device.department_id
            },
            success: true
        });

        res.status(201).json({
            success: true,
            data: device
        });
        
    } catch (error) {
        // Audit the failure
        await req.audit.logCRUD({
            action: 'create',
            resource_type: 'device',
            new_values: req.body,
            success: false,
            error_message: error.message
        });

        res.status(500).json({
            success: false,
            message: 'Failed to create device',
            error: error.message
        });
    }
};
```

---

## 🔧 Data Quality Improvements

### Before (có nhiều null values):
```json
{
    "id": "uuid",
    "user_id": null,
    "organization_id": null,
    "action": "create", 
    "resource_type": null,
    "resource_id": null,
    "old_values": null,
    "new_values": null,
    "ip_address": null,
    "user_agent": null,
    "success": true
}
```

### After (standardized và complete):
```json
{
    "id": "uuid",
    "user_id": "85c8da1a-b05f-4bd3-8a9c-90f362ab7edc",
    "organization_id": "53735762-67f0-435d-9744-31d4674b8347",
    "action": "create",
    "resource_type": "device", 
    "resource_id": "new-device-uuid",
    "old_values": null,
    "new_values": {
        "name": "MRI Scanner",
        "serial_number": "MRI-001",
        "department_id": "radiology-uuid",
        "department_name": "Radiology"
    },
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "success": true,
    "error_message": null,
    "created_at": "2025-11-19T10:30:00.000Z"
}
```

---

## 📊 Enhanced Features

### 1. Action Normalization
```javascript
// Input variations -> Normalized output
'insert' -> 'create'
'add' -> 'create'
'view' -> 'read'
'modify' -> 'update'
'remove' -> 'delete'
'signin' -> 'login'
'signout' -> 'logout'
```

### 2. Data Sanitization
```javascript
// Sensitive data redaction
{
    "username": "admin",
    "password": "[REDACTED]",  // Auto-redacted
    "token": "[REDACTED]",     // Auto-redacted
    "email": "admin@hospital.com",
    "long_text": "Very long text... [TRUNCATED]"  // Auto-truncated
}
```

### 3. IP Address Enhancement
```javascript
// Multiple fallback methods for IP detection
const ip_address = req.ip || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress ||
                  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                  req.headers['x-real-ip'] ||
                  '127.0.0.1';
```

---

## 🔍 Monitoring & Analytics

### Get Audit Statistics:
```javascript
import AuditLogger from './shared/services/AuditLogger.js';

// Get recent audit stats
const stats = await AuditLogger.getStats(7); // Last 7 days

console.log(stats);
/*
{
    period_days: 7,
    total_logs: 1250,
    success_logs: 1180,
    failure_logs: 70,
    success_rate: "94.40",
    top_actions: [
        { action: "read", count: 650 },
        { action: "update", count: 280 },
        { action: "login", count: 180 },
        { action: "create", count: 90 },
        { action: "delete", count: 50 }
    ]
}
*/
```

### Batch Operations:
```javascript
// Log multiple events at once
const events = [
    {
        action: 'create',
        resource_type: 'device',
        resource_id: 'device1',
        new_values: { name: 'Device 1' }
    },
    {
        action: 'create', 
        resource_type: 'device',
        resource_id: 'device2',
        new_values: { name: 'Device 2' }
    }
];

const results = await AuditLogger.logBatch(events);
console.log(`Logged ${results.filter(r => r.success).length}/${events.length} events`);
```

---

## 🚨 Error Handling

### Automatic Error Logging:
```javascript
// System automatically logs its own errors
try {
    await AuditLogger.log({ /* invalid data */ });
} catch (error) {
    // AuditLogger automatically creates audit_error log entry
    // Application continues without breaking
}
```

### Application Error Auditing:
```javascript
try {
    // Some operation that might fail
    await riskyOperation();
} catch (error) {
    // Log the failure for audit trail
    await AuditLogger.log({
        req,
        action: 'operation_failed',
        resource_type: 'system',
        success: false,
        error_message: error.message,
        new_values: {
            operation: 'riskyOperation',
            stack_trace: error.stack,
            timestamp: new Date().toISOString()
        }
    });
    
    throw error; // Re-throw for normal error handling
}
```

---

## 🎯 Best Practices

### 1. **Consistent Resource Naming:**
```javascript
// Good - Singular form
resource_type: 'device'
resource_type: 'user' 
resource_type: 'organization'

// Bad - Mixed forms
resource_type: 'devices'  // Plural
resource_type: 'Device'   // Capitalized
```

### 2. **Meaningful New Values:**
```javascript
// Good - Descriptive data
new_values: {
    device_name: "MRI Scanner",
    serial_number: "MRI-001",
    department: "Radiology",
    assigned_by: "Dr. Smith",
    assignment_date: "2025-11-19"
}

// Bad - Just IDs
new_values: {
    device_id: "uuid",
    department_id: "uuid"
}
```

### 3. **Security Event Details:**
```javascript
// Good - Complete security context
await AuditLogger.logSecurity({
    req,
    event_type: 'permission_granted',
    target_user_id: user.id,
    details: {
        permission: 'device.delete',
        scope: 'department:radiology',
        granted_by: admin.username,
        granted_by_id: admin.id,
        justification: 'Temporary access for maintenance',
        expires_at: '2025-11-20T10:00:00Z'
    }
});
```

### 4. **Performance Considerations:**
```javascript
// Use batch logging for bulk operations
const auditEvents = devices.map(device => ({
    action: 'update',
    resource_type: 'device',
    resource_id: device.id,
    old_values: { status: device.oldStatus },
    new_values: { status: 'active' }
}));

await AuditLogger.logBatch(auditEvents);
```

---

## 🔗 Integration with Existing Controllers

### Device Controller Example:
```javascript
// In assignDeviceToDepartment function
export const assignDeviceToDepartment = async (req, res) => {
    try {
        // ... existing logic ...

        // Enhanced audit logging
        await AuditLogger.logCRUD({
            req,
            action: 'update',
            resource_type: 'device',
            resource_id: id,
            old_values: {
                department_id: device.department_id,
                department_name: device.department?.name || null,
                visibility: device.visibility
            },
            new_values: {
                department_id: department_id,
                department_name: department.name,
                visibility: newVisibility,
                assigned_by: req.user.username,
                assignment_reason: req.body.reason || 'Manual assignment'
            },
            success: true
        });

        // ... rest of logic ...
    } catch (error) {
        // Log the failure
        await AuditLogger.logCRUD({
            req,
            action: 'update',
            resource_type: 'device', 
            resource_id: id,
            success: false,
            error_message: error.message
        });

        // ... error handling ...
    }
};
```

---

## 📈 Kết quả

### Trước khi nâng cấp:
- ❌ Nhiều null values
- ❌ Inconsistent data format  
- ❌ Thiếu context information
- ❌ No automatic logging
- ❌ Poor error tracking

### Sau khi nâng cấp:
- ✅ **Complete data** với proper fallbacks
- ✅ **Standardized format** across all logs
- ✅ **Rich context** với meaningful details
- ✅ **Automatic API logging** via middleware
- ✅ **Comprehensive error tracking**
- ✅ **Security-focused** với data redaction
- ✅ **Performance optimized** với batch operations

Hệ thống audit bây giờ **enterprise-ready** và đáp ứng đầy đủ yêu cầu compliance cho healthcare environment! 🏥✅