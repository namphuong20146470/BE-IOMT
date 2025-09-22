# 📊 AUDIT LOGS API DOCUMENTATION

## 🔗 Base URL
```
https://iomt.hoangphucthanh.vn:3030/actlog
```

## 🛡️ Authentication
Hầu hết endpoints yêu cầu Bearer Token trong header:
```
Authorization: Bearer <access_token>
```

---

## 📋 **AUDIT LOGS ENDPOINTS**

### **1. 📖 GET /logs - Lấy tất cả Audit Logs**

**Endpoint:**
```http
GET /actlog/logs
```

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Response Success (200):**
```json
[
  {
    "id": "550841b5-7e4e-4a0b-abc1-23456789abcd",
    "user_id": "231ee806-b142-44b3-9e51-69d73771ce7e",
    "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
    "action": "auth",
    "resource_type": "login",
    "resource_id": null,
    "old_values": null,
    "new_values": {
      "username": "BSNHhai",
      "ip_address": "192.168.0.254"
    },
    "ip_address": "192.168.0.254",
    "user_agent": "PostmanRuntime/7.46.1",
    "success": true,
    "error_message": null,
    "created_at": "2025-09-22T13:07:40.289Z",
    "users": {
      "id": "231ee806-b142-44b3-9e51-69d73771ce7e",
      "username": "BSNHhai",
      "full_name": "Bác sĩ Nguyễn Hoàng Hải",
      "email": "hai@example.com",
      "user_roles": [
        {
          "role": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Doctor",
            "description": "Bác sĩ"
          }
        }
      ]
    },
    "organizations": {
      "id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
      "name": "Bệnh viện Đa khoa Trung ương"
    }
  }
]
```

---

### **2. ✍️ POST /logs - Tạo Audit Log**

**Endpoint:**
```http
POST /actlog/logs
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "user.create",
  "resource_type": "user",
  "resource_id": "user-uuid-123",
  "details": "Created new user account",
  "user_id": "231ee806-b142-44b3-9e51-69d73771ce7e",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "target": "users"
}
```

**Response Success (201):**
```json
{
  "id": "new-log-uuid",
  "user_id": "231ee806-b142-44b3-9e51-69d73771ce7e",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "action": "user.create",
  "resource_type": "user",
  "resource_id": "user-uuid-123",
  "new_values": {
    "details": "Created new user account"
  },
  "ip_address": "192.168.0.254",
  "user_agent": "Mozilla/5.0...",
  "success": true,
  "created_at": "2025-09-22T13:30:00Z"
}
```

---

### **3. 🗑️ DELETE /logs/:id - Xóa Audit Log**

**Endpoint:**
```http
DELETE /actlog/logs/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Parameters:**
- `id` (path): UUID của audit log cần xóa

**Response Success (200):**
```json
{
  "message": "Xóa audit log thành công"
}
```

**Response Error (500):**
```json
{
  "error": "Audit log not found"
}
```

---

### **4. 🧹 POST /logs/all - Xóa tất cả Audit Logs**

**Endpoint:**
```http
POST /actlog/logs/all
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "confirmReset": "CONFIRM_DELETE_ALL_DATA"
}
```

**Response Success (200):**
```json
{
  "message": "Đã xóa toàn bộ audit logs thành công!",
  "deleted_count": 1247
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Xác nhận xóa không hợp lệ. Vui lòng gửi confirmReset: 'CONFIRM_DELETE_ALL_DATA'"
}
```

---

### **5. ⚠️ POST /logs/test-warning - Tạo Test Warning**

**Endpoint:**
```http
POST /actlog/logs/test-warning
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "device_type": "temperature_sensor",
  "data": {
    "temperature": 45.5,
    "humidity": 80,
    "device_id": "temp_001"
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "warnings_created": 2,
  "warnings": [
    {
      "id": "warning-uuid-1",
      "device_type": "temperature_sensor",
      "warning_type": "high_temperature",
      "message": "Temperature above safe threshold",
      "created_at": "2025-09-22T13:45:00Z"
    },
    {
      "id": "warning-uuid-2", 
      "device_type": "temperature_sensor",
      "warning_type": "high_humidity",
      "message": "Humidity level too high",
      "created_at": "2025-09-22T13:45:00Z"
    }
  ]
}
```

---

## 📊 **AUDIT LOG DATA STRUCTURE**

### **Database Schema (audit_logs table):**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Common Action Types:**
- `auth` - Authentication actions (login, logout, refresh)
- `user.create` - User creation
- `user.update` - User modification  
- `user.delete` - User deletion
- `permission.assign` - Permission assignment
- `permission.revoke` - Permission removal
- `role.assign` - Role assignment
- `session.create` - Session creation
- `session.terminate` - Session termination
- `device.connect` - Device connection
- `device.disconnect` - Device disconnection
- `data.read` - Data access
- `data.write` - Data modification

### **Common Resource Types:**
- `user` - User accounts
- `role` - User roles
- `permission` - Permissions
- `session` - User sessions
- `device` - IoT devices
- `organization` - Organizations
- `department` - Departments
- `auth` - Authentication

---

## 🛡️ **SECURITY & PERMISSIONS**

### **Access Control:**
- **GET /logs**: Public access (no auth required)
- **POST /logs**: Requires authentication
- **DELETE /logs/:id**: Requires authentication + admin role
- **POST /logs/all**: Requires Super Admin role
- **POST /logs/test-warning**: Requires authentication

### **IP Address & User Agent Tracking:**
- Tự động capture IP address và User-Agent
- Stored in `ip_address` và `user_agent` fields
- Dùng để detect suspicious activities

### **Data Retention:**
- Audit logs được lưu vĩnh viễn
- Chỉ Super Admin mới có thể xóa
- Backup tự động mỗi ngày

---

## 🔧 **USAGE EXAMPLES**

### **JavaScript/Fetch:**
```javascript
// Get all audit logs
const response = await fetch('https://iomt.hoangphucthanh.vn:3030/actlog/logs');
const logs = await response.json();

// Create audit log
const newLog = await fetch('https://iomt.hoangphucthanh.vn:3030/actlog/logs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'user.login',
    resource_type: 'auth',
    details: 'User logged in successfully'
  })
});
```

### **cURL:**
```bash
# Get audit logs
curl -X GET "https://iomt.hoangphucthanh.vn:3030/actlog/logs"

# Create audit log
curl -X POST "https://iomt.hoangphucthanh.vn:3030/actlog/logs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"user.create","resource_type":"user","details":"New user created"}'

# Delete all logs (DANGEROUS!)
curl -X POST "https://iomt.hoangphucthanh.vn:3030/actlog/logs/all" \
  -H "Content-Type: application/json" \
  -d '{"confirmReset":"CONFIRM_DELETE_ALL_DATA"}'
```

---

## ⚡ **PERFORMANCE NOTES**

- **Indexing**: Indexes on `user_id`, `organization_id`, `action`, `created_at`
- **Pagination**: Hiện tại chưa implement, sẽ add trong tương lai
- **Filtering**: Chưa có query filters, sẽ add search & filter options
- **Rate Limiting**: 1000 requests/minute per IP

---

## 🚨 **ERROR CODES**

| Status | Description |
|--------|-------------|
| 200    | Success |
| 201    | Created successfully |
| 400    | Bad request (missing required fields) |
| 401    | Unauthorized (invalid token) |
| 403    | Forbidden (insufficient permissions) |
| 404    | Resource not found |
| 500    | Internal server error |

---

**🎯 Audit Logs API đã ready for production! 🚀**