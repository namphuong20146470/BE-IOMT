# PDU Management System - API Endpoints Summary

## Base URL
```
http://localhost:3000/api
```

## Authentication
Tất cả endpoints yêu cầu Bearer token trong header:
```
Authorization: Bearer <token>
```

---

## 📋 PDU ENDPOINTS

### 1. GET /pdus
**Lấy danh sách tất cả PDUs với filter và pagination**

**Query Parameters:**
- `page` (number, default: 1) - Số trang
- `limit` (number, default: 20, max: 100) - Số item mỗi trang  
- `organization_id` (uuid, optional) - Filter theo organization
- `department_id` (uuid, optional) - Filter theo department
- `type` (enum, optional) - Filter theo loại PDU: `standard`, `smart`, `switched`, `metered`
- `status` (enum, optional) - Filter theo trạng thái: `active`, `inactive`, `maintenance`
- `location` (string, optional) - Filter theo địa điểm
- `search` (string, optional) - Tìm kiếm theo tên hoặc mã
- `sort_by` (enum, default: name) - Sắp xếp: `name`, `code`, `type`, `created_at`, `updated_at`
- `sort_order` (enum, default: asc) - Thứ tự: `asc`, `desc`
- `include_stats` (boolean, optional) - Bao gồm thống kê

**Permissions:** `pdu_view`, `admin`

### 2. GET /pdus/statistics
**Lấy thống kê PDU**

**Query Parameters:**
- `organization_id` (uuid, optional)
- `department_id` (uuid, optional) 
- `date_from` (datetime, optional)
- `date_to` (datetime, optional)

**Permissions:** `pdu_view`, `admin`

### 3. GET /pdus/{id}
**Lấy thông tin chi tiết PDU theo ID**

**Path Parameters:**
- `id` (uuid, required) - PDU ID

**Permissions:** `pdu_view`, `admin`

### 4. POST /pdus
**Tạo PDU mới**

**Request Body:**
```json
{
  "name": "PDU-Floor-1",
  "code": "PDU001", 
  "type": "smart",
  "organization_id": "uuid",
  "department_id": "uuid", // optional
  "outlet_count": 8,
  "voltage_rating": 220,
  "max_current": 16,
  "max_power_watts": 3520, // optional
  "location": "Server Room A", // optional
  "description": "Main PDU for server rack", // optional
  "mqtt_base_topic": "/pdu/floor1", // optional
  "manufacturer": "APC", // optional
  "model": "AP7900", // optional
  "serial_number": "SN123456", // optional
  "ip_address": "192.168.1.100", // optional
  "installation_date": "2024-01-15T00:00:00Z", // optional
  "outlets_config": [ // optional
    {
      "outlet_number": 1,
      "name": "Server 1",
      "is_enabled": true,
      "max_power_watts": 500
    }
  ]
}
```

**Permissions:** `pdu_create`, `admin`

### 5. PUT /pdus/{id}
**Cập nhật PDU**

**Path Parameters:**
- `id` (uuid, required)

**Request Body:** Tương tự POST nhưng tất cả field đều optional

**Permissions:** `pdu_update`, `admin`

### 6. DELETE /pdus/{id}  
**Xóa PDU**

**Path Parameters:**
- `id` (uuid, required)

**Permissions:** `pdu_delete`, `admin`

### 7. GET /pdus/{id}/outlets
**Lấy danh sách outlets của PDU**

**Path Parameters:**
- `id` (uuid, required) - PDU ID

**Query Parameters:**
- `include_device` (boolean, default: false) - Bao gồm thông tin device
- `include_data` (boolean, default: false) - Bao gồm dữ liệu power
- `status` (enum, optional) - Filter: `active`, `idle`, `error`, `inactive`

**Permissions:** `pdu_view`, `outlet_view`, `admin`

---

## 🔌 OUTLET ENDPOINTS

### 1. GET /outlets
**Lấy danh sách outlets với filter và pagination**

**Query Parameters:**
- `page`, `limit`, `sort_by`, `sort_order` - Giống PDU
- `pdu_id` (uuid, optional) - Filter theo PDU
- `organization_id` (uuid, optional)
- `department_id` (uuid, optional)
- `status` (enum, optional) - `active`, `idle`, `error`, `inactive`
- `assigned` (boolean, optional) - Filter theo trạng thái gán device
- `search` (string, optional)
- `include_device` (boolean, default: false)
- `include_data` (boolean, default: false)

**Permissions:** `outlet_view`, `admin`

### 2. GET /outlets/available  
**Lấy danh sách outlets có thể gán device**

**Query Parameters:**
- `organization_id` (uuid, optional)
- `department_id` (uuid, optional)

**Permissions:** `outlet_view`, `device_manage`, `admin`

### 3. GET /outlets/{id}
**Lấy thông tin chi tiết outlet**

**Path Parameters:**
- `id` (uuid, required)

**Query Parameters:**
- `include_device` (boolean, default: false)
- `include_data` (boolean, default: false) 
- `include_history` (boolean, default: false)

**Permissions:** `outlet_view`, `admin`

### 4. GET /outlets/{id}/data
**Lấy dữ liệu power và metrics của outlet**

**Path Parameters:**
- `id` (uuid, required)

**Query Parameters:**
- `date_from` (datetime, optional)
- `date_to` (datetime, optional)
- `interval` (enum, default: hour) - `minute`, `hour`, `day`
- `metrics` (string, optional) - Comma-separated: `power,voltage,current`
- `limit` (number, default: 100, max: 1000)

**Permissions:** `outlet_view`, `admin`

### 5. PUT /outlets/{id}
**Cập nhật cấu hình outlet**

**Path Parameters:**
- `id` (uuid, required)

**Request Body:**
```json
{
  "name": "Server Outlet 1", // optional
  "is_enabled": true, // optional
  "max_power_watts": 500, // optional
  "voltage_rating": 220, // optional
  "connector_type": "IEC C13", // optional
  "notes": "Updated configuration", // optional
  "mqtt_topic_suffix": "outlet_1" // optional
}
```

**Permissions:** `outlet_update`, `admin`

### 6. POST /outlets/{id}/assign
**Gán device vào outlet**

**Path Parameters:**
- `id` (uuid, required) - Outlet ID

**Request Body:**
```json
{
  "device_id": "uuid",
  "notes": "Assignment notes" // optional
}
```

**Permissions:** `device_manage`, `admin`

### 7. POST /outlets/{id}/unassign
**Bỏ gán device khỏi outlet**

**Path Parameters:**
- `id` (uuid, required) - Outlet ID

**Request Body:**
```json
{
  "notes": "Unassignment reason" // optional
}
```

**Permissions:** `device_manage`, `admin`

### 8. POST /outlets/transfer
**Chuyển device giữa các outlets**

**Request Body:**
```json
{
  "from_outlet_id": "uuid",
  "to_outlet_id": "uuid", 
  "notes": "Transfer reason" // optional
}
```

**Permissions:** `device_manage`, `admin`

### 9. POST /outlets/bulk-assign
**Gán nhiều devices cùng lúc**

**Request Body:**
```json
{
  "assignments": [
    {
      "outlet_id": "uuid",
      "device_id": "uuid",
      "notes": "Assignment 1" // optional
    },
    {
      "outlet_id": "uuid", 
      "device_id": "uuid",
      "notes": "Assignment 2" // optional
    }
  ]
}
```

**Permissions:** `device_manage`, `admin`

### 10. GET /outlets/{id}/history
**Lấy lịch sử gán device của outlet**

**Path Parameters:**
- `id` (uuid, required)

**Permissions:** `outlet_view`, `admin`

### 11. POST /outlets/{id}/control
**Điều khiển outlet (bật/tắt/reset)**

**Path Parameters:**
- `id` (uuid, required)

**Request Body:**
```json
{
  "action": "turn_on", // turn_on, turn_off, reset, toggle
  "force": false // optional, default: false
}
```

**Permissions:** `outlet_control`, `admin`

---

## 🔄 DEVICE ASSIGNMENT ENDPOINTS

### 1. POST /device-assignment/validate
**Kiểm tra tính hợp lệ của việc gán device-outlet**

**Request Body:**
```json
{
  "outlet_id": "uuid",
  "device_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "errors": [],
  "warnings": ["Device warranty has expired"],
  "outlet_info": {
    "id": "uuid",
    "outlet_number": 1,
    "pdu_name": "PDU-001",
    "location": "Server Room A"
  },
  "device_info": {
    "id": "uuid", 
    "serial_number": "DEV001",
    "model": "Server Model X",
    "status": "active"
  }
}
```

**Permissions:** `device_manage`, `outlet_view`, `admin`

### 2. POST /device-assignment/validate-bulk
**Kiểm tra tính hợp lệ của nhiều assignments**

**Request Body:**
```json
{
  "assignments": [
    {
      "outlet_id": "uuid",
      "device_id": "uuid"
    }
  ]
}
```

**Permissions:** `device_manage`, `outlet_view`, `admin`

### 3. POST /device-assignment/validate-transfer
**Kiểm tra tính hợp lệ của việc chuyển device**

**Request Body:**
```json
{
  "from_outlet_id": "uuid",
  "to_outlet_id": "uuid"
}
```

**Permissions:** `device_manage`, `admin`

### 4. GET /device-assignment/available
**Lấy danh sách devices hoặc outlets có thể gán**

**Query Parameters:**
- `organization_id` (uuid, optional)
- `department_id` (uuid, optional)
- `resource_type` (enum, default: devices) - `devices`, `outlets`

**Permissions:** `device_manage`, `outlet_view`, `admin`

### 5. GET /device-assignment/history/{id}
**Lấy lịch sử gán device hoặc outlet**

**Path Parameters:**
- `id` (uuid, required) - Device ID hoặc Outlet ID

**Query Parameters:**
- `resource_type` (enum, default: device) - `device`, `outlet`
- `limit` (number, default: 50, max: 100)

**Permissions:** `device_view`, `outlet_view`, `admin`

### 6. POST /device-assignment/check-conflicts
**Kiểm tra xung đột assignment real-time**

**Request Body:**
```json
{
  "outlet_id": "uuid",
  "device_id": "uuid"
}
```

**Permissions:** `device_manage`, `outlet_view`, `admin`

### 7. GET /device-assignment/summary
**Lấy tóm tắt thống kê assignment**

**Query Parameters:**
- `organization_id` (uuid, optional)
- `department_id` (uuid, optional)

**Permissions:** `device_view`, `outlet_view`, `admin`

---

## 🔧 WEBSOCKET REAL-TIME

### WebSocket Connection
```
ws://localhost:8080
```

### Subscription Messages
**Đăng ký nhận updates của outlet:**
```json
{
  "type": "subscribe_outlet",
  "outlet_id": "uuid"
}
```

**Đăng ký nhận updates của PDU:**
```json
{
  "type": "subscribe_pdu", 
  "pdu_id": "uuid"
}
```

### Real-time Data Messages
**Outlet power update:**
```json
{
  "type": "outlet_data",
  "outlet_id": "uuid",
  "data": {
    "power": 450.5,
    "voltage": 220.1,
    "current": 2.05,
    "status": "active",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Device assignment update:**
```json
{
  "type": "device_assigned",
  "outlet_id": "uuid", 
  "device_id": "uuid",
  "device_serial": "DEV001",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 📊 RESPONSE FORMATS

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "pagination": { // if applicable
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100,
    "per_page": 20
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "device_id",
      "message": "Invalid device ID format",
      "received": "invalid-uuid"
    }
  ]
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "outlet_count",
      "message": "Outlet count must be between 1 and 48",
      "received": 0
    }
  ]
}
```

---

## 🔐 REQUIRED PERMISSIONS

| Endpoint Group | Required Permissions |
|---------------|---------------------|
| PDU Management | `pdu_view`, `pdu_create`, `pdu_update`, `pdu_delete`, `admin` |
| Outlet Management | `outlet_view`, `outlet_update`, `outlet_control`, `admin` |  
| Device Assignment | `device_manage`, `device_view`, `admin` |
| Real-time Data | `outlet_view`, `device_view`, `admin` |

---

## 📈 USAGE EXAMPLES

### Tạo PDU với outlets
```bash
curl -X POST http://localhost:3000/api/pdus \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Server Rack PDU",
    "code": "PDU-SR-01",
    "type": "smart", 
    "organization_id": "org-uuid",
    "outlet_count": 8,
    "voltage_rating": 220,
    "max_current": 16,
    "location": "Data Center Rack 1"
  }'
```

### Gán device vào outlet
```bash
curl -X POST http://localhost:3000/api/outlets/{outlet-id}/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-uuid",
    "notes": "Assigning server to outlet"
  }'
```

### Lấy dữ liệu real-time outlet
```bash
curl -X GET "http://localhost:3000/api/outlets/{outlet-id}/data?interval=hour&limit=24" \
  -H "Authorization: Bearer <token>"
```

### Kiểm tra assignment hợp lệ
```bash
curl -X POST http://localhost:3000/api/device-assignment/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "outlet_id": "outlet-uuid",
    "device_id": "device-uuid"
  }'
```