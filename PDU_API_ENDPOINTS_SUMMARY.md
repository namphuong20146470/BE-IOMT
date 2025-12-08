# 📚 PDU Management System - Complete API Documentation

> **Version**: 1.0.0  
> **Last Updated**: December 2025  
> **Environment**: Development

## 🚀 Quick Start

### Base URL
```
Development: http://localhost:3000
Production: https://your-production-url.com
```

### Authentication
All API endpoints require authentication using Bearer token:

```bash
Authorization: Bearer <your_jwt_token>
```

**Getting Started:**
1. Login to obtain JWT token: `POST /api/auth/login`
2. Include token in all subsequent requests
3. Token expires after 24 hours (configurable)

### API Versioning
All endpoints use `/api/v1` prefix for version 1:
```
/api/v1/pdus
/api/v1/sockets  
/api/v1/device-assignment
```

---

## 📋 PDU ENDPOINTS

### 1. GET /api/v1/pdus
**Retrieve all PDUs**

**Description**: Get a list of Power Distribution Units (PDUs) with basic information including associated sockets.

**Query Parameters:**
- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 20, max: 100) - Items per page  
- `organization_id` (uuid, optional) - Filter by organization ID
- `department_id` (uuid, optional) - Filter by department ID
- `type` (enum, optional) - PDU type: `cart`, `wall_mount`, `floor_stand`, `ceiling`, `rack`, `extension`
- `status` (enum, optional) - PDU status: `active`, `inactive`, `maintenance`
- `location` (string, optional) - Filter by location/room
- `search` (string, optional) - Search by name, code, or serial number
- `sort_by` (enum, default: name) - Sort field: `name`, `code`, `type`, `created_at`, `updated_at`
- `sort_order` (enum, default: asc) - Sort direction: `asc`, `desc`
- `include_stats` (boolean, optional) - Include outlet usage statistics

**Permissions:** `pdu_view`, `system.admin`



### 2. GET /api/v1/pdus/{id}
**Get detailed PDU information by ID**

**Description**: Retrieve complete PDU details including specifications, socket configuration, current status, and associated devices.

**Path Parameters:**
- `id` (uuid, required) - PDU unique identifier

**Query Parameters:**
- `include_sockets` (boolean, default: false) - Include all socket details
- `include_devices` (boolean, default: false) - Include connected device information

**Permissions:** `device.read`, `device.manage`, `system.admin`

### 3. POST /api/v1/pdus
**Create a new PDU**

**Description**: Register a new Power Distribution Unit in the system. Automatically creates associated sockets based on `total_sockets` parameter.

**Request Body:**
```json
{
  "name": "PDU-ServerRoom-A1",
  "code": "PDU-001", 
  "type": "rack",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_id": "550e8400-e29b-41d4-a716-446655440001",
  "total_sockets": 8,
  "voltage_rating": 220,
  "max_power_watts": 3520,
  "location": "Server Room A - Rack 1",
  "floor": "1",
  "building": "Data Center Building A",
  "description": "Primary PDU for server rack infrastructure",
  "mqtt_base_topic": "/datacenter/floor1/rack1",
  "manufacturer": "APC",
  "model_number": "AP7900",
  "serial_number": "SN-PDU-001-2024",
  "is_mobile": false,
  "specifications": {
    "input_voltage_range": "200-240V",
    "frequency": "50/60Hz",
    "form_factor": "1U",
    "mounting": "rack"
  }
}
```

**Validation Rules:**
- `name`: Required, 3-100 characters
- `code`: Required, unique within organization
- `total_sockets`: Required, 1-48 sockets
- `voltage_rating`: Required, common values: 110, 220, 380
- `type`: Must be valid enum value

**Permissions:** `device.create`, `device.manage`, `system.admin`

### 4. PUT /api/v1/pdus/{id}
**Update existing PDU**

**Description**: Update PDU configuration and properties. Cannot modify `total_sockets` after creation - use socket management endpoints instead.

**Path Parameters:**
- `id` (uuid, required) - PDU unique identifier

**Request Body:** Same as POST but all fields optional (partial update supported)

**Note**: Updating critical fields like `voltage_rating` will trigger safety checks and may require confirmation.

**Permissions:** `device.update`, `device.manage`, `system.admin`

### 5. DELETE /api/v1/pdus/{id}
**Delete PDU and associated sockets**

**Description**: Permanently remove PDU from system. All connected devices must be unassigned first. This action cannot be undone.

**Path Parameters:**
- `id` (uuid, required) - PDU unique identifier

**Pre-conditions:**
- No devices assigned to any sockets
- PDU status must be `inactive`
- User must have deletion permissions

**Safety**: Returns 409 Conflict if PDU has active assignments

**Permissions:** `device.delete`, `device.manage`, `system.admin`

### 6. GET /api/v1/pdus/{id}/sockets
**Get all sockets for specific PDU**

**Description**: Retrieve complete socket configuration for a PDU including assignment status and device information.

**Path Parameters:**
- `id` (uuid, required) - PDU unique identifier

**Query Parameters:**
- `include_device` (boolean, default: false) - Include connected device details

**Permissions:** `device.read`, `device.manage`, `system.admin`

---

## 🔌 SOCKET ENDPOINTS

### 1. GET /api/v1/sockets
**Get all sockets**

**Description**: Retrieve all sockets with basic information.

**Query Parameters:**
- `pdu_id` (uuid, optional) - Filter by PDU
- `include_device` (boolean, default: false) - Include device details

**Permissions:** `device.read`, `device.manage`, `system.admin`

### 2. GET /api/v1/sockets/{id}
**Get socket details**

**Path Parameters:**
- `id` (uuid, required)

**Query Parameters:**
- `include_device` (boolean, default: false) - Include device details

**Permissions:** `device.read`, `device.manage`, `system.admin`



### 3. PUT /api/v1/sockets/{id}
**Update socket configuration**

**Path Parameters:**
- `id` (uuid, required)

**Request Body:**
```json
{
  "name": "Server Socket 1", // optional
  "mqtt_topic_suffix": "socket1" // optional
}
```

**Permissions:** `device.update`, `device.configure`, `system.admin`

### 4. POST /api/v1/sockets/{id}/assign
**Assign device to socket**

**Path Parameters:**
- `id` (uuid, required) - Socket ID

**Request Body:**
```json
{
  "device_id": "uuid"
}
```

**Permissions:** `device.manage`, `system.admin`

### 5. POST /api/v1/sockets/{id}/unassign
**Unassign device from socket**

**Path Parameters:**
- `id` (uuid, required) - Socket ID

**Permissions:** `device.manage`, `system.admin`



---

## 🔧 DEVICE MANAGEMENT ENDPOINTS

### 1. PUT /api/v1/devices/{id}
**Update device information including status**

**Description**: Update device properties including status, location, and other metadata.

**Path Parameters:**
- `id` (uuid, required) - Device unique identifier

**Request Body:**
```json
{
  "status": "maintenance", // optional: active, inactive, maintenance, decommissioned
  "serial_number": "DEV-001", // optional
  "asset_tag": "ASSET-001", // optional  
  "purchase_date": "2024-01-15", // optional
  "installation_date": "2024-01-20", // optional
  "model_id": "uuid", // optional
  "organization_id": "uuid", // optional
  "department_id": "uuid" // optional
}
```

**Status Values:**
- `active` - Device is operational and in use
- `inactive` - Device is not currently in use
- `maintenance` - Device is under maintenance
- `decommissioned` - Device is retired/disposed

**Permissions:** `device.update`, `device.manage`, `system.admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "maintenance",
    "updated_at": "2024-12-04T10:30:00Z"
  },
  "message": "Device updated successfully"
}
```

---

## 🔄 DEVICE ASSIGNMENT

### Assign Device to Socket
Use the socket assignment endpoint: `POST /api/v1/sockets/{socket_id}/assign`

### Unassign Device from Socket  
Use the socket unassignment endpoint: `POST /api/v1/sockets/{socket_id}/unassign`

---



---

## 📊 RESPONSE FORMATS & ERROR HANDLING

### Success Response Structure
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PDU-ServerRoom-A1",
    "code": "PDU-001",
    "status": "active",
    "created_at": "2024-12-01T10:30:00Z"
  },
  "message": "PDU retrieved successfully",
  "timestamp": "2024-12-01T10:30:00Z",
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100,
    "per_page": 20,
    "has_next": true,
    "has_prev": false
  }
}
```

### HTTP Status Codes
| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful GET, PUT requests |
| 201 | Created | Successful POST requests |
| 204 | No Content | Successful DELETE requests |
| 400 | Bad Request | Invalid request data, validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for operation |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource conflict (e.g., duplicate code) |
| 422 | Unprocessable Entity | Business logic validation failed |
| 500 | Internal Server Error | Unexpected server error |

### Error Response Examples

**Validation Error (400)**
```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "total_outlets",
      "message": "Outlet count must be between 1 and 48",
      "received": 0,
      "expected": "integer between 1 and 48"
    },
    {
      "field": "voltage_rating",
      "message": "Invalid voltage rating",
      "received": "abc",
      "expected": "number (110, 220, 380)"
    }
  ],
  "timestamp": "2024-12-01T10:30:00Z"
}
```

**Authentication Error (401)**
```json
{
  "success": false,
  "message": "Authentication required",
  "error_code": "UNAUTHORIZED",
  "details": "Bearer token is missing or invalid",
  "timestamp": "2024-12-01T10:30:00Z"
}
```

**Permission Error (403)**
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "error_code": "FORBIDDEN",
  "required_permissions": ["device.manage", "system.admin"],
  "user_permissions": ["device.read"],
  "timestamp": "2024-12-01T10:30:00Z"
}
```

**Resource Not Found (404)**
```json
{
  "success": false,
  "message": "PDU not found",
  "error_code": "RESOURCE_NOT_FOUND",
  "resource_type": "PDU",
  "resource_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-12-01T10:30:00Z"
}
```

**Business Logic Error (422)**
```json
{
  "success": false,
  "message": "Cannot delete PDU with active assignments",
  "error_code": "BUSINESS_RULE_VIOLATION",
  "details": {
    "active_sockets": 3,
    "assigned_devices": [
      {"socket_id": "uuid1", "device_serial": "DEV001"},
      {"socket_id": "uuid2", "device_serial": "DEV002"}
    ]
  },
  "suggested_action": "Unassign all devices before deletion",
  "timestamp": "2024-12-01T10:30:00Z"
}
```

---

## 🔐 REQUIRED PERMISSIONS

| Endpoint Group | Required Permissions |
|---------------|---------------------|
| PDU Management | `device.create`, `device.read`, `device.update`, `device.delete`, `device.list`, `device.manage`, `system.admin` |
| Socket Management | `device.read`, `device.update`, `device.configure`, `device.manage`, `system.admin` |  
| Device Assignment | `device.manage`, `device.read`, `system.admin` |

---

## 🚀 INTEGRATION GUIDE & EXAMPLES

### SDK & Client Libraries
- **JavaScript/Node.js**: Use `axios` or `fetch` for HTTP requests
- **Python**: Use `requests` library
- **C#/.NET**: Use `HttpClient`
- **Java**: Use `OkHttp` or Spring WebClient
- **Postman Collection**: Available for testing and development

### Authentication Setup
```javascript
// JavaScript/Node.js Example
const API_BASE_URL = 'http://localhost:3000/api/v1';
const authToken = 'your-jwt-token';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Common Integration Patterns

#### 1. Creating PDU with Auto-Generated Sockets
```bash
curl -X POST http://localhost:3000/api/v1/pdus \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DataCenter-Rack-A1-PDU",
    "code": "PDU-DC-A1-001",
    "type": "rack", 
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "total_sockets": 12,
    "location": "Data Center - Building A - Rack 1",
    "mqtt_base_topic": "/datacenter/buildingA/rack1"
  }'
```

#### 2. Update Device Status
```bash
# Change device status to maintenance
curl -X PUT http://localhost:3000/api/v1/devices/550e8400-e29b-41d4-a716-446655440020 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "maintenance"
  }'
```

#### 3. Device Assignment
```bash
# Assign device to socket
curl -X POST http://localhost:3000/api/v1/sockets/550e8400-e29b-41d4-a716-446655440010/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "550e8400-e29b-41d4-a716-446655440020"
  }'
```



### Error Handling Best Practices

```javascript
async function assignDeviceToSocket(socketId, deviceId) {
  try {
    const result = await apiClient.post(`/api/v1/sockets/${socketId}/assign`, {
      device_id: deviceId
    });
    
    return result.data;
    
  } catch (error) {
    if (error.response) {
      switch (error.response.status) {
        case 400:
          console.error('Validation error:', error.response.data.errors);
          break;
        case 401:
          console.error('Authentication required');
          break;
        case 403:
          console.error('Insufficient permissions');
          break;
        case 409:
          console.error('Conflict - socket may be already assigned');
          break;
        default:
          console.error('Unexpected error:', error.response.data.message);
      }
    }
    throw error;
  }
}
```



### Testing & Development
```bash
# Test authentication and get PDUs
curl -X GET http://localhost:3000/api/v1/pdus \
  -H "Authorization: Bearer <your-test-token>"

# Get all sockets
curl -X GET http://localhost:3000/api/v1/sockets \
  -H "Authorization: Bearer <your-test-token>"
```