# Dynamic MQTT Device Management - API Samples

## Overview
Hệ thống Dynamic MQTT cho phép quản lý thiết bị IoT linh hoạt với các tính năng:
- Kết nối MQTT động cho từng thiết bị
- Mapping dữ liệu tùy chỉnh
- Cảnh báo thông minh
- Lưu trữ dữ liệu linh hoạt (generic table hoặc custom table)

## Device Data Processor APIs

### 1. Get Device Data
**GET** `/actlog/device-processor/device-data/:deviceId`

Query Parameters:
- `limit`: Số lượng records (default: 50)
- `offset`: Vị trí bắt đầu (default: 0) 
- `startDate`: Thời gian bắt đầu (ISO string)
- `endDate`: Thời gian kết thúc (ISO string)
- `tableName`: Tên table (default: device_data_logs)

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "device_id": "456e7890-e89b-12d3-a456-426614174001",
      "data_json": {
        "temperature": 25.5,
        "humidity": 60.2,
        "battery": 85,
        "signal_strength": -45
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "serial_number": "IOT-TEMP-001",
      "model_name": "Smart Temperature Sensor",
      "manufacturer": "IoTech Solutions"
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### 2. Get Device Statistics
**GET** `/actlog/device-processor/device-data/:deviceId/stats`

Query Parameters:
- `period`: Khoảng thời gian (1h, 24h, 7d, 30d)
- `tableName`: Tên table (default: device_data_logs)

**Example Response:**
```json
{
  "success": true,
  "device": {
    "serial_number": "IOT-TEMP-001",
    "device_name": "Temperature Sensor Room 101",
    "status": "active",
    "model_name": "Smart Temperature Sensor",
    "manufacturer": "IoTech Solutions",
    "last_connected": "2024-01-15T10:29:45Z",
    "connectivity_active": true
  },
  "statistics": {
    "period": "24h",
    "timeRange": "24 hours",
    "total_records": 1440,
    "first_record": "2024-01-14T10:30:00Z",
    "latest_record": "2024-01-15T10:29:00Z",
    "active_hours": 24
  }
}
```

### 3. Get Real-time Data Stream
**GET** `/actlog/device-processor/device-data/:deviceId/stream`

Query Parameters:
- `tableName`: Tên table (default: device_data_logs)
- `limit`: Số lượng records mới nhất (default: 10)

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "789e0123-e89b-12d3-a456-426614174002",
      "data_json": {
        "temperature": 25.8,
        "humidity": 59.5,
        "battery": 84,
        "signal_strength": -43
      },
      "timestamp": "2024-01-15T10:31:00Z"
    },
    {
      "id": "890e1234-e89b-12d3-a456-426614174003",
      "data_json": {
        "temperature": 25.6,
        "humidity": 60.1,
        "battery": 84,
        "signal_strength": -44
      },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:31:15Z"
}
```

### 4. Simulate Device Data (Testing)
**POST** `/actlog/device-processor/device-data/:deviceId/simulate`

**Request Body:**
```json
{
  "data": {
    "temperature": 26.2,
    "humidity": 58.7,
    "battery": 83,
    "signal_strength": -42,
    "location": {
      "room": "101",
      "floor": 1,
      "building": "A"
    },
    "alerts": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device data simulated successfully",
  "device": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "serial_number": "IOT-TEMP-001",
    "model_name": "Smart Temperature Sensor"
  },
  "processedData": {
    "temperature": 26.2,
    "humidity": 58.7,
    "battery": 83,
    "signal_strength": -42,
    "location": {
      "room": "101",
      "floor": 1,
      "building": "A"
    },
    "alerts": []
  },
  "timestamp": "2024-01-15T10:32:00Z"
}
```

### 5. Get MQTT Connection Status
**GET** `/actlog/device-processor/mqtt/status`

**Response:**
```json
{
  "success": true,
  "mqttManager": {
    "initialized": true,
    "brokers": {
      "localhost:1883:false": {
        "connected": true,
        "reconnecting": false
      },
      "iot-broker.company.com:8883:true": {
        "connected": true,
        "reconnecting": false
      }
    },
    "devices": 15
  },
  "activeTopics": [
    "devices/IOT-TEMP-001/data",
    "devices/IOT-HUM-002/data",
    "sensors/pressure/IOT-PRES-003",
    "medical/monitor/IOT-ECG-004"
  ],
  "deviceStatistics": {
    "total_devices": 18,
    "active_connections": 15,
    "recently_connected": 14,
    "active_devices": 16
  }
}
```

### 6. Refresh MQTT Connections
**POST** `/actlog/device-processor/mqtt/refresh`

**Response:**
```json
{
  "success": true,
  "message": "MQTT connections refreshed successfully",
  "timestamp": "2024-01-15T10:33:00Z"
}
```

### 7. Get Available Data Tables
**GET** `/actlog/device-processor/tables`

**Response:**
```json
{
  "success": true,
  "tables": {
    "device_data_logs": [
      {"column": "id", "type": "uuid", "nullable": false},
      {"column": "device_id", "type": "uuid", "nullable": false},
      {"column": "data_json", "type": "jsonb", "nullable": false},
      {"column": "timestamp", "type": "timestamp with time zone", "nullable": true}
    ],
    "temperature_sensor_data": [
      {"column": "id", "type": "uuid", "nullable": false},
      {"column": "device_id", "type": "uuid", "nullable": false},
      {"column": "temperature", "type": "real", "nullable": true},
      {"column": "humidity", "type": "real", "nullable": true},
      {"column": "battery_level", "type": "integer", "nullable": true},
      {"column": "timestamp", "type": "timestamp with time zone", "nullable": true}
    ]
  }
}
```

## Device Connectivity Configuration Examples

### Temperature Sensor Configuration
```json
{
  "device_id": "456e7890-e89b-12d3-a456-426614174001",
  "mqtt_user": "iot_sensor_user",
  "mqtt_topic": "devices/IOT-TEMP-001/data",
  "broker_host": "localhost",
  "broker_port": 1883,
  "ssl_enabled": false,
  "heartbeat_interval": 60,
  "is_active": true,
  "data_mapping": {
    "temp": {
      "field": "temperature",
      "type": "real"
    },
    "hum": {
      "field": "humidity", 
      "type": "real"
    },
    "bat": {
      "field": "battery_level",
      "type": "integer"
    }
  },
  "table_name": "temperature_sensor_data",
  "warning_config": {
    "enabled": true,
    "rules": [
      {
        "field": "temperature",
        "condition": "> 35",
        "severity": "critical",
        "message": "Temperature too high"
      },
      {
        "field": "battery_level", 
        "condition": "< 20",
        "severity": "warning",
        "message": "Low battery"
      }
    ]
  }
}
```

### Medical Monitor Configuration (SSL/TLS)
```json
{
  "device_id": "678e9012-e89b-12d3-a456-426614174004",
  "mqtt_user": "medical_device_user",
  "mqtt_topic": "medical/monitor/IOT-ECG-004",
  "broker_host": "secure-iot-broker.hospital.com",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 30,
  "is_active": true,
  "data_mapping": {
    "heart_rate": {
      "field": "bpm",
      "type": "integer"
    },
    "blood_pressure_sys": {
      "field": "systolic_pressure",
      "type": "integer"
    },
    "blood_pressure_dia": {
      "field": "diastolic_pressure", 
      "type": "integer"
    },
    "oxygen_saturation": {
      "field": "spo2",
      "type": "real"
    }
  },
  "table_name": "medical_monitor_data",
  "warning_config": {
    "enabled": true,
    "rules": [
      {
        "field": "bpm",
        "condition": "> 120 OR < 60",
        "severity": "critical",
        "message": "Abnormal heart rate detected"
      },
      {
        "field": "spo2",
        "condition": "< 90",
        "severity": "critical", 
        "message": "Low oxygen saturation"
      }
    ]
  }
}
```

## MQTT Message Examples

### Temperature Sensor Message
```json
{
  "temp": 25.5,
  "hum": 60.2,
  "bat": 85,
  "signal": -45,
  "timestamp": "2024-01-15T10:30:00Z",
  "device_info": {
    "firmware": "1.2.3",
    "uptime": 86400
  }
}
```

### Medical Monitor Message  
```json
{
  "heart_rate": 72,
  "blood_pressure_sys": 120,
  "blood_pressure_dia": 80,
  "oxygen_saturation": 98.5,
  "temperature": 36.7,
  "timestamp": "2024-01-15T10:30:00Z",
  "patient_id": "P123456",
  "device_status": {
    "battery": 95,
    "signal_quality": "excellent",
    "calibration_due": false
  }
}
```

### Environmental Monitor Message
```json
{
  "temperature": 22.3,
  "humidity": 45.2,
  "air_pressure": 1013.25,
  "co2_level": 420,
  "air_quality_index": 85,
  "noise_level": 35.2,
  "light_intensity": 350,
  "timestamp": "2024-01-15T10:30:00Z",
  "location": {
    "room": "Conference Room A",
    "floor": 2,
    "building": "Main Office"
  }
}
```

## Testing Dynamic MQTT System

### 1. Test với Postman/Thunder Client:

**Temperature Sensor Test:**
```bash
POST /actlog/device-processor/device-data/456e7890-e89b-12d3-a456-426614174001/simulate
Content-Type: application/json

{
  "data": {
    "temp": 26.8,
    "hum": 55.3,
    "bat": 82,
    "signal": -40
  }
}
```

**Get Latest Data:**
```bash
GET /actlog/device-processor/device-data/456e7890-e89b-12d3-a456-426614174001/stream?limit=5
```

**Check MQTT Status:**
```bash
GET /actlog/device-processor/mqtt/status
```

### 2. Environment Variables for Dynamic MQTT:
```env
# Dynamic MQTT Configuration
DYNAMIC_MQTT_ENABLED=true
DYNAMIC_MQTT_REFRESH_INTERVAL=300000
DEBUG_MQTT=true

# Default MQTT Settings (fallback)
DEFAULT_MQTT_HOST=localhost
DEFAULT_MQTT_PORT=1883
DEFAULT_MQTT_SSL=false
```

## Features Comparison

### Legacy MQTT System:
- ✅ Hardcoded device types (5 types)
- ✅ Fixed table structures
- ✅ Static topic subscriptions
- ✅ Basic data processing

### Dynamic MQTT System:
- ✅ Unlimited device types
- ✅ Configurable data mapping
- ✅ Dynamic topic management
- ✅ Custom table support
- ✅ Flexible warning system
- ✅ Real-time status monitoring
- ✅ Multi-broker support
- ✅ SSL/TLS connections
- ✅ Generic fallback storage
- ✅ REST API for testing
- ✅ Live configuration refresh

## Migration Strategy

1. **Phase 1**: Deploy dynamic system parallel to legacy (✅ Done)
2. **Phase 2**: Configure existing devices in dynamic system
3. **Phase 3**: Test data flow from both systems
4. **Phase 4**: Gradually migrate devices from legacy to dynamic
5. **Phase 5**: Deprecate legacy system when all devices migrated
