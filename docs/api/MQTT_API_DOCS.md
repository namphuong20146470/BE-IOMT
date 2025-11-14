# 🚀 **MQTT DEVICE MANAGEMENT API DOCUMENTATION**

## **📋 Overview**
Complete API for managing MQTT-enabled IoT devices with integration to Dynamic MQTT Manager.

**Base URL:** `https://iomt.hoangphucthanh.vn:3030/actlog/mqtt`

---

## 🔐 **Authentication**
All endpoints require Bearer token authentication:
```http
Authorization: Bearer your_access_token_here
```

---

## 📡 **MQTT DEVICE ENDPOINTS**

### **1. 📊 GET /devices - Get All MQTT Devices**

Get paginated list of all MQTT-enabled devices with filtering options.

#### **Query Parameters:**
```javascript
{
  organization_id?: string,      // Filter by organization
  is_active?: boolean,           // Filter by active status
  connection_status?: string,    // 'online', 'offline', 'idle', 'never_connected'
  broker_host?: string,          // Filter by broker host
  search?: string,               // Search in serial, asset tag, model, topic
  page?: number,                 // Page number (default: 1)
  limit?: number                 // Items per page (default: 50)
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT devices retrieved successfully",
  "data": {
    "devices": [
      {
        "device_id": "uuid",
        "serial_number": "AUO-001",
        "asset_tag": "HVN-AUO-001",
        "device_status": "active",
        "location": "ICU Room 101",
        "connectivity_id": "uuid",
        "mqtt_user": "device_user",
        "mqtt_topic": "iot/auo-display/001",
        "broker_host": "mqtt.hospital.com",
        "broker_port": 8883,
        "ssl_enabled": true,
        "heartbeat_interval": 300,
        "last_connected": "2025-01-19T10:30:00Z",
        "is_active": true,
        "model_name": "AUO Display Pro",
        "manufacturer": "AUO Corporation",
        "category_name": "Medical Display",
        "organization_name": "Bach Mai Hospital",
        "connection_status": "online"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total_items": 125,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

### **2. 🔍 GET /devices/:deviceId - Get Specific MQTT Device**

Get detailed information about a specific MQTT device including recent data.

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device retrieved successfully",
  "data": {
    "device_id": "uuid",
    "serial_number": "AUO-001",
    "asset_tag": "HVN-AUO-001",
    "device_status": "active",
    "installation_date": "2024-01-15T00:00:00Z",
    "warranty_end_date": "2027-01-15T00:00:00Z",
    "location": "ICU Room 101",
    "notes": "Primary display for patient monitoring",
    "connectivity_id": "uuid",
    "mqtt_user": "device_user",
    "mqtt_topic": "iot/auo-display/001",
    "broker_host": "mqtt.hospital.com",
    "broker_port": 8883,
    "ssl_enabled": true,
    "heartbeat_interval": 300,
    "last_connected": "2025-01-19T10:30:00Z",
    "is_active": true,
    "data_mapping": {
      "voltage": {"field": "voltage_v", "type": "real"},
      "current": {"field": "current_ma", "type": "real"},
      "temperature": {"field": "temp_c", "type": "real"}
    },
    "model_name": "AUO Display Pro",
    "manufacturer": "AUO Corporation",
    "category_name": "Medical Display",
    "organization_name": "Bach Mai Hospital",
    "organization_type": "hospital",
    "connection_status": "online",
    "messages_24h": 1440,
    "recent_data": [
      {
        "data_json": {
          "voltage": 220.5,
          "current": 1.2,
          "temperature": 45.3,
          "status": "normal"
        },
        "timestamp": "2025-01-19T10:30:00Z"
      }
    ]
  }
}
```

---

### **3. ➕ POST /devices - Create MQTT Configuration**

Configure MQTT for an existing device.

#### **Request Body:**
```json
{
  "device_id": "uuid",                    // Required: Existing device ID
  "mqtt_topic": "iot/new-device/001",     // Required: Unique MQTT topic
  "mqtt_user": "device_user",             // Optional: MQTT username
  "mqtt_pass": "secure_password",         // Optional: MQTT password (encrypted)
  "broker_host": "mqtt.hospital.com",     // Optional: Default 'localhost'
  "broker_port": 8883,                    // Optional: Default 1883
  "ssl_enabled": true,                    // Optional: Default false
  "heartbeat_interval": 300,              // Optional: Default 300 seconds
  "data_mapping": {                       // Optional: Data field mapping
    "voltage": {"field": "voltage_v", "type": "real"},
    "current": {"field": "current_ma", "type": "real"}
  },
  "is_active": true                       // Optional: Default true
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device configuration created successfully",
  "data": {
    "id": "uuid",
    "device_id": "uuid",
    "mqtt_user": "device_user",
    "mqtt_topic": "iot/new-device/001",
    "broker_host": "mqtt.hospital.com",
    "broker_port": 8883,
    "ssl_enabled": true,
    "heartbeat_interval": 300,
    "is_active": true,
    "created_at": "2025-01-19T10:30:00Z",
    "updated_at": "2025-01-19T10:30:00Z"
  }
}
```

---

### **4. ✏️ PUT /devices/:deviceId - Update MQTT Configuration**

Update MQTT configuration for existing device.

#### **Request Body:** (All fields optional)
```json
{
  "mqtt_user": "new_user",
  "mqtt_pass": "new_password",
  "mqtt_topic": "iot/updated-topic/001",
  "broker_host": "new-mqtt.hospital.com",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 600,
  "data_mapping": {
    "temperature": {"field": "temp_celsius", "type": "real"}
  },
  "is_active": false
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device configuration updated successfully",
  "data": {
    "id": "uuid",
    "device_id": "uuid",
    "mqtt_topic": "iot/updated-topic/001",
    "is_active": false,
    "updated_at": "2025-01-19T10:45:00Z"
  }
}
```

---

### **5. 🗑️ DELETE /devices/:deviceId - Remove MQTT Configuration**

Remove MQTT configuration from device (device remains, only MQTT config deleted).

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device configuration deleted successfully"
}
```

---

## 🔄 **DEVICE STATE MANAGEMENT**

### **6. ✅ POST /devices/:deviceId/activate - Activate Device**

Activate MQTT device (adds to Dynamic MQTT Manager).

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device activated successfully",
  "data": {
    "device_id": "uuid",
    "is_active": true
  }
}
```

---

### **7. ❌ POST /devices/:deviceId/deactivate - Deactivate Device**

Deactivate MQTT device (removes from Dynamic MQTT Manager).

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT device deactivated successfully",
  "data": {
    "device_id": "uuid",
    "is_active": false
  }
}
```

---

### **8. 💓 PUT /devices/:deviceId/heartbeat - Update Heartbeat**

Update last connected timestamp for device.

#### **Response:**
```json
{
  "success": true,
  "message": "Last connected timestamp updated successfully",
  "data": {
    "id": "uuid",
    "device_id": "uuid",
    "last_connected": "2025-01-19T10:30:00Z"
  }
}
```

---

## 📊 **DATA & ANALYTICS**

### **9. 📈 GET /devices/:deviceId/data - Get Device Data History**

Get historical data from device with pagination.

#### **Query Parameters:**
```javascript
{
  hours?: number,    // Data from last N hours (default: 24)
  limit?: number,    // Records per page (default: 100)
  page?: number      // Page number (default: 1)
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "Device data retrieved successfully",
  "data": {
    "records": [
      {
        "data_json": {
          "voltage": 220.5,
          "current": 1.2,
          "temperature": 45.3,
          "status": "normal"
        },
        "timestamp": "2025-01-19T10:30:00Z",
        "local_time": "2025-01-19T17:30:00+07:00"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 100,
      "total_items": 1440,
      "total_pages": 15
    },
    "period": "24 hours"
  }
}
```

---

## 🔍 **MONITORING & STATUS**

### **10. 📊 GET /status - Get MQTT System Status**

Get comprehensive MQTT system status.

#### **Response:**
```json
{
  "success": true,
  "message": "MQTT status retrieved successfully",
  "data": {
    "manager_status": {
      "initialized": true,
      "brokers": {
        "mqtt.hospital.com:8883:true": {
          "connected": true,
          "reconnecting": false
        }
      },
      "devices": 25
    },
    "active_topics": [
      "iot/auo-display/001",
      "iot/camera-control/002",
      "iot/led-nova/003"
    ],
    "database_stats": {
      "total_devices": 150,
      "active_devices": 125,
      "online_devices": 98,
      "never_connected": 15,
      "unique_brokers": 3
    },
    "system_info": {
      "uptime": 86400,
      "node_version": "v18.20.7",
      "memory_usage": {
        "rss": 67108864,
        "heapTotal": 33554432,
        "heapUsed": 25165824
      }
    }
  }
}
```

---

### **11. 📈 GET /statistics - Get Connectivity Statistics**

Get detailed connectivity statistics by organization.

#### **Query Parameters:**
```javascript
{
  organization_id?: string    // Filter by organization
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "Connectivity statistics retrieved successfully",
  "data": {
    "total_devices": 150,
    "active_configs": 125,
    "online_now": 98,
    "online_24h": 118,
    "never_connected": 15,
    "ssl_enabled_count": 85
  }
}
```

---

## 🧪 **TESTING & DEBUGGING**

### **12. 🚀 POST /test-publish - Test Publish Message**

Test publish message to device topic for debugging.

#### **Request Body:**
```json
{
  "device_id": "uuid",                    // Device to test OR
  "topic_override": "iot/test/topic",     // Direct topic override
  "message": {                            // Optional: Custom message
    "test": true,
    "voltage": 220.5,
    "timestamp": "2025-01-19T10:30:00Z"
  }
}
```

#### **Response:**
```json
{
  "success": true,
  "message": "Test message processed successfully",
  "data": {
    "topic": "iot/auo-display/001",
    "message": {
      "test": true,
      "voltage": 220.5,
      "timestamp": "2025-01-19T10:30:00Z"
    },
    "processed_at": "2025-01-19T10:30:00Z"
  }
}
```

---

## 🔒 **LEGACY COMPATIBILITY ENDPOINTS**

### **Device Connectivity (Backward Compatibility)**

- `GET /connectivity` - Get all connectivities
- `GET /connectivity/:deviceId` - Get device connectivity
- `POST /connectivity` - Create connectivity
- `PUT /connectivity/:id` - Update connectivity  
- `DELETE /connectivity/:id` - Delete connectivity

---

## ⚠️ **Error Responses**

### **Common Error Codes:**
```json
// 400 Bad Request
{
  "success": false,
  "message": "MQTT topic is already in use by another device"
}

// 404 Not Found
{
  "success": false,
  "message": "MQTT device configuration not found"
}

// 500 Internal Server Error
{
  "success": false,
  "message": "Failed to create MQTT device configuration",
  "error": "Database connection failed"
}
```

---

## 📋 **Data Mapping Configuration**

### **Example Data Mapping:**
```json
{
  "data_mapping": {
    "voltage": {
      "field": "voltage_v",           // Database column name
      "type": "real",                 // PostgreSQL data type
      "default": 0.0                  // Default value if missing
    },
    "current": {
      "field": "current_ma", 
      "type": "real"
    },
    "temperature": {
      "field": "temp_celsius",
      "type": "real"
    },
    "status": {
      "field": "device_status",
      "type": "text",
      "default": "unknown"
    },
    "online": {
      "field": "is_online",
      "type": "boolean",
      "default": false
    }
  }
}
```

### **Supported Data Types:**
- `integer` - Whole numbers
- `real` - Floating point numbers  
- `boolean` - True/false values
- `text` - String values
- `jsonb` - JSON objects

---

## 🚀 **Usage Examples**

### **Complete Device Setup Flow:**
```bash
# 1. Create MQTT configuration
curl -X POST "https://iomt.hoangphucthanh.vn:3030/actlog/mqtt/devices" \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-uuid",
    "mqtt_topic": "iot/new-device/001",
    "broker_host": "mqtt.hospital.com",
    "broker_port": 8883,
    "ssl_enabled": true,
    "data_mapping": {
      "voltage": {"field": "voltage_v", "type": "real"}
    }
  }'

# 2. Activate device
curl -X POST "https://iomt.hoangphucthanh.vn:3030/actlog/mqtt/devices/device-uuid/activate" \
  -H "Authorization: Bearer token"

# 3. Check status
curl -X GET "https://iomt.hoangphucthanh.vn:3030/actlog/mqtt/status" \
  -H "Authorization: Bearer token"

# 4. View device data
curl -X GET "https://iomt.hoangphucthanh.vn:3030/actlog/mqtt/devices/device-uuid/data?hours=1" \
  -H "Authorization: Bearer token"
```

---

## 🎯 **Best Practices**

### **🔒 Security:**
- Always use SSL/TLS for production brokers
- Encrypt MQTT passwords (handled automatically)
- Use unique MQTT usernames per device
- Rotate credentials regularly

### **📊 Performance:**
- Use appropriate heartbeat intervals (300-600 seconds)
- Implement data mapping for efficient storage
- Monitor connection status regularly
- Use pagination for large datasets

### **🛠️ Maintenance:**
- Monitor device connection status
- Set up alerts for offline devices
- Regular cleanup of old data
- Keep broker configurations updated

---

**🎉 The MQTT Device Management API provides enterprise-grade IoT device management with real-time monitoring, flexible configuration, and seamless integration with the Dynamic MQTT Manager!**