# Real-time Data Endpoints Documentation

## Overview
Các endpoint dùng để lấy dữ liệu real-time từ thiết bị IoT. Hệ thống sử dụng 3 bảng dữ liệu khác nhau với mục đích riêng.

---

## Data Tables Architecture

### 1. `device_data_latest` (⭐ Real-time Monitoring)
**Mục đích:** Lưu trạng thái real-time hiện tại của thiết bị
- **Cấu trúc:** Bảng chính (1 hàng/device)
- **Dữ liệu:** Giá trị mới nhất: voltage, current, power, frequency, power_factor, states
- **Cập nhật:** Mỗi message MQTT từ Socket MQTT Client
- **Retention:** Vĩnh viễn (overwrite dữ liệu cũ)

**Sử dụng cho:**
- Dashboard real-time
- Alert & Notification
- Live monitoring

---

### 2. `device_data` (📊 Time-series Analytics)
**Mục đích:** Lưu lịch sử dữ liệu được xử lý (processed)
- **Cấu trúc:** Bảng thời gian (nhiều hàng/device/ngày)
- **Dữ liệu:** Cùng fields như `device_data_latest` nhưng có timestamp riêng
- **Cập nhật:** Periodic incremental updates từ Socket MQTT Client
- **Retention:** Long-term storage (analytics & reporting)

**Sử dụng cho:**
- Analytics & Reporting
- Time-series analysis
- Historical data queries
- Data aggregation

---

### 3. `device_data_logs` (📝 Raw MQTT Audit)
**Mục đích:** Lưu raw JSON từ MQTT messages (không xử lý)
- **Cấu trúc:** Log table (tất cả messages)
- **Dữ liệu:** `data_json` chứa payload gốc từ MQTT
- **Cập nhật:** Mỗi MQTT message được lưu
- **Retention:** Audit trail (có thể rotate)

**Sử dụng cho:**
- Debugging MQTT
- Audit trail
- Raw data analysis
- Troubleshooting

---

## Endpoints Real-time

### 1. **GET `/devices/:deviceId/data/current`** ⭐ REAL-TIME
Lấy trạng thái real-time hiện tại của device

```http
GET /api/v1/devices/b3f41e73-1234-5678-abcd-ef1234567890/data/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_id": "b3f41e73-1234-5678-abcd-ef1234567890",
    "socket_id": "xyz123",
    "voltage": 232.7,
    "current": 0,
    "power": 0,
    "frequency": 50,
    "power_factor": 0,
    "machine_state": false,
    "socket_state": false,
    "sensor_state": false,
    "over_voltage": false,
    "under_voltage": false,
    "timestamp": "2025-12-06T10:30:00.000Z",
    "is_connected": true,
    "last_seen_at": "2025-12-06T10:30:00.000Z",
    "updated_at": "2025-12-06T10:30:01.000Z",
    "device": {
      "serial_number": "MD2024002",
      "status": "active"
    },
    "socket": {
      "socket_number": 2,
      "pdu": {
        "name": "PDU-Main",
        "code": "PDU-001"
      }
    }
  },
  "timestamp": "2025-12-06T10:30:01.000Z"
}
```

**Data Source:** `device_data_latest` table  
**Performance:** ⚡ Ultra-fast (single row lookup)  
**Use Case:** Dashboard, Live monitoring, Alerts

---

### 2. **GET `/devices/:deviceId/data/stream`** 📡 LATEST RECORDS
Lấy các records mới nhất (live stream)

```http
GET /api/v1/devices/b3f41e73-1234-5678-abcd-ef1234567890/data/stream?limit=10&tableName=device_data_logs
```

**Query Parameters:**
- `limit` (default: 10) - Số records trả về
- `tableName` (default: device_data_logs) - Bảng dữ liệu
  - `device_data_logs` - Raw MQTT logs
  - `device_data` - Processed time-series data

**Response (device_data_logs):**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "data_json": {
        "voltage": 232.7,
        "timestamp": "15:31:33 04/12/2025"
      },
      "timestamp": "2025-12-04T08:31:34.732Z"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "data_json": {
        "power": 0,
        "current": 0,
        "power_factor": 0,
        "machine_state": false,
        "timestamp": "15:29:00 04/12/2025"
      },
      "timestamp": "2025-12-04T08:29:01.740Z"
    }
  ],
  "timestamp": "2025-12-06T10:30:01.000Z"
}
```

**Data Source:** `device_data_logs` (raw) hoặc `device_data` (processed)  
**Use Case:** Live monitoring, Stream playback, Recent history

---

### 3. **GET `/devices/:deviceId/data`** 📊 HISTORICAL DATA
Lấy dữ liệu theo thời gian (analytics)

```http
GET /api/v1/devices/b3f41e73-1234-5678-abcd-ef1234567890/data?tableName=device_data&limit=100&offset=0
```

**Query Parameters:**
- `tableName` (default: device_data_logs) - Chọn bảng dữ liệu
- `limit` (default: 50) - Records per page
- `offset` (default: 0) - Pagination offset
- `start_date` - ISO timestamp (optional)
- `end_date` - ISO timestamp (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "device_id": "b3f41e73-...",
      "socket_id": "xyz123",
      "voltage": 232.7,
      "current": 0,
      "power": 0,
      "frequency": 50,
      "power_factor": 0,
      "machine_state": false,
      "timestamp": "2025-04-12T08:31:33.000Z",
      "created_at": "2025-04-12T08:31:34.000Z"
    }
  ],
  "pagination": {
    "total": 4,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Data Source:** `device_data` table (processed)  
**Use Case:** Analytics, Reporting, Time-series analysis

---

### 4. **GET `/devices/:deviceId/data/stats`** 📈 STATISTICS
Lấy thống kê dữ liệu theo thời gian

```http
GET /api/v1/devices/b3f41e73-1234-5678-abcd-ef1234567890/data/stats?period=24h&tableName=device_data_logs
```

**Query Parameters:**
- `period` (default: 24h) - Time range
  - `1h` - Last 1 hour
  - `24h` - Last 24 hours
  - `7d` - Last 7 days
  - `30d` - Last 30 days
- `tableName` (default: device_data_logs)

**Response:**
```json
{
  "success": true,
  "device": {
    "serial_number": "MD2024002",
    "device_name": "Device Name",
    "status": "active",
    "model_name": "PDU Model X"
  },
  "statistics": {
    "period": "24h",
    "timeRange": "24 hours",
    "total_records": 25,
    "first_record": "2025-12-04T04:40:41.097Z",
    "latest_record": "2025-12-04T08:31:34.732Z",
    "active_hours": 5
  }
}
```

**Data Source:** `device_data_logs` hoặc `device_data`  
**Use Case:** Dashboard stats, Health monitoring

---

### 5. **GET `/devices/:id/realtime`** ⚡ LEGACY REAL-TIME
Alternative endpoint cho real-time data (device.routes.js)

```http
GET /api/v1/devices/b3f41e73-1234-5678-abcd-ef1234567890/realtime
```

**Response:** Tương tự `/data/current`

---

## WebSocket Connection (Live Updates)

**Endpoint:** `ws://localhost:3030/socket.io`

**Emit Events:**
```javascript
// Subscribe to device real-time updates
socket.on('subscribe-device', (deviceId) => {
  // Server emits updates cho device này
});

// Receive updates
socket.on('device-update', (data) => {
  console.log('New data:', data.device_data_latest);
});
```

---

## Data Selection Guide

| Use Case | Endpoint | Table | Speed | Data Size | Frequency |
|----------|----------|-------|-------|-----------|-----------|
| **Dashboard Widget** | `/data/current` | `device_data_latest` | ⚡⚡⚡ | Small | Real-time |
| **Live Graph** | `/data/stream` | `device_data_logs` | ⚡⚡ | Medium | Per message |
| **Analytics** | `/data?period=7d` | `device_data` | ⚡ | Large | Hourly/Daily |
| **Statistics** | `/data/stats` | `device_data_logs` | ⚡ | Small | On demand |
| **Debugging** | `/data?tableName=device_data_logs` | `device_data_logs` | ⚡ | Large | All messages |
| **Audit Trail** | `/logs` | `device_data_logs` | ⚡ | Large | Permanent |

---

## Architecture Diagram

```
MQTT Messages (Topic: hopt/tang3/pkt/socket2)
         ↓
    Socket MQTT Client
         ↓
    ┌────┴────┬────────────────┬─────────────────┐
    ↓         ↓                ↓                 ↓
[IMMEDIATE] [PERIODIC]      [ALL]            [RAW]
    ↓         ↓                ↓                 ↓
device_   device_data       device_         device_
data_     (incremental      data_latest     data_
latest    updates)          (current)       logs
(REAL-    (ANALYTICS)       (ALERTS)        (AUDIT)
TIME)
    ↓         ↓                ↓                 ↓
/data/    /data/stats      /data/         /logs
current   /data            current-state
-state    /history                       
```

---

## Performance Notes

- **device_data_latest:** Indexed on `device_id` (PK) → O(1) lookup
- **device_data:** Indexed on `(device_id, timestamp DESC)` → O(log n)
- **device_data_logs:** Indexed on `(device_id, timestamp DESC)` → O(log n)

---

## Error Handling

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid device ID format"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Device current state not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to retrieve device current state",
  "details": "error message"
}
```

---

## Updates & Monitoring

- **Real-time Updates:** Chạy qua Socket MQTT Client (incremental)
- **WebSocket Events:** Phát ra `device-update` events
- **Database Sync:** Prisma client auto-sync với Postgresql
- **Missing:** API endpoint `/pdus/{id}/sockets` cần sửa để sử dụng bảng mới

