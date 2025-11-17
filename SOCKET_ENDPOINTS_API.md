# Socket Endpoints Documentation
## Tang 3 PKT - IoMT Backend API

### 📋 Overview
Các endpoint đã được cập nhật để phản ánh đúng chức năng Socket thay vì tên device cũ.

### 🔌 Socket Mapping

| Socket | Table | MQTT Topic | Old Endpoint | New Endpoint |
|--------|-------|------------|--------------|--------------|
| Socket 1 | `socket1_data` | `hopt/tang3/pkt/socket1` | `/auo-display` | `/socket1` |
| Socket 2 | `socket2_data` | `hopt/tang3/pkt/socket2` | `/camera-control` | `/socket2` |
| Socket 3 | `socket3_data` | `hopt/tang3/pkt/socket3` | `/led-nova` | `/socket3` |
| Socket 4 | `socket4_data` | `hopt/tang3/pkt/socket4` | `/electronic` | `/socket4` |

### 📡 Available Endpoints

#### Socket 1 Endpoints (Tang 3 PKT - Socket 1)
```
GET    /api/iot/socket1           - Get all socket1 data
GET    /api/iot/socket1/latest    - Get latest socket1 data  
GET    /api/iot/socket1/1hour     - Get socket1 data (1 hour)
GET    /api/iot/socket1/6hours    - Get socket1 data (6 hours)
GET    /api/iot/socket1/24hours   - Get socket1 data (24 hours)
GET    /api/iot/socket1/7days     - Get socket1 data (7 days)
GET    /api/iot/socket1/30days    - Get socket1 data (30 days)
GET    /api/iot/socket1/range     - Get socket1 data by date range
POST   /api/iot/socket1           - Add new socket1 data
```

#### Socket 2 Endpoints (Tang 3 PKT - Socket 2)
```
GET    /api/iot/socket2           - Get all socket2 data
GET    /api/iot/socket2/latest    - Get latest socket2 data
GET    /api/iot/socket2/1hour     - Get socket2 data (1 hour)
GET    /api/iot/socket2/6hours    - Get socket2 data (6 hours)
GET    /api/iot/socket2/24hours   - Get socket2 data (24 hours)
GET    /api/iot/socket2/7days     - Get socket2 data (7 days)
GET    /api/iot/socket2/30days    - Get socket2 data (30 days)
GET    /api/iot/socket2/range     - Get socket2 data by date range
POST   /api/iot/socket2           - Add new socket2 data
```

#### Socket 3 Endpoints (Tang 3 PKT - Socket 3)
```
GET    /api/iot/socket3           - Get all socket3 data
GET    /api/iot/socket3/latest    - Get latest socket3 data
GET    /api/iot/socket3/1hour     - Get socket3 data (1 hour)
GET    /api/iot/socket3/6hours    - Get socket3 data (6 hours)
GET    /api/iot/socket3/24hours   - Get socket3 data (24 hours)
GET    /api/iot/socket3/7days     - Get socket3 data (7 days)
GET    /api/iot/socket3/30days    - Get socket3 data (30 days)
GET    /api/iot/socket3/range     - Get socket3 data by date range
POST   /api/iot/socket3           - Add new socket3 data
```

#### Socket 4 Endpoints (Tang 3 PKT - Socket 4)
```
GET    /api/iot/socket4           - Get all socket4 data
GET    /api/iot/socket4/latest    - Get latest socket4 data
GET    /api/iot/socket4/1hour     - Get socket4 data (1 hour)
GET    /api/iot/socket4/6hours    - Get socket4 data (6 hours)
GET    /api/iot/socket4/24hours   - Get socket4 data (24 hours)
GET    /api/iot/socket4/7days     - Get socket4 data (7 days)
GET    /api/iot/socket4/30days    - Get socket4 data (30 days)
GET    /api/iot/socket4/range     - Get socket4 data by date range
POST   /api/iot/socket4           - Add new socket4 data
```

### 📊 Data Schema (All Sockets)

#### Input Data Fields (từ MQTT Topics):
```json
{
    "voltage": 220.5,           // Điện áp (REAL)
    "current": 2.3,             // Dòng điện (REAL)
    "power": 507.15,            // Công suất (REAL)
    "frequency": 50.0,          // Tần số (REAL)
    "power_factor": 0.95,       // Hệ số cosphi (REAL)
    "machine_state": true,      // Trạng thái thiết bị (BOOLEAN)
    "socket_state": true,       // Trạng thái ổ cắm (BOOLEAN)
    "sensor_state": true,       // Trạng thái cảm biến (BOOLEAN)
    "over_voltage": false,      // Điện áp cao (BOOLEAN)
    "under_voltage": false      // Điện áp thấp (BOOLEAN)
}
```

#### Response Data Fields:
```json
{
    "success": true,
    "data": {
        "id": 12345,
        "voltage": 220.5,
        "current": 2.3,
        "power": 507.15,
        "frequency": 50.0,
        "power_factor": 0.95,
        "machine_state": true,
        "socket_state": true,
        "sensor_state": true,
        "over_voltage": false,
        "under_voltage": false,
        "timestamp": "2025-11-17T10:30:45.123Z",
        "formatted_time": "2025-11-17 10:30:45"
    },
    "message": "Successfully retrieved socket data"
}
```

### 🔄 Migration Status

#### ✅ Completed:
- [x] Database tables renamed (auo_display → socket1_data, etc.)
- [x] MQTT topics updated (`hopt/tang3/pkt/socket1-4`)
- [x] Route endpoints updated (`/socket1`, `/socket2`, etc.)
- [x] Controller function aliases created
- [x] Data schema updated for new fields

#### 🔄 Next Steps:
1. Run database schema migration SQL
2. Update frontend API calls to use new endpoints
3. Test MQTT data flow with new topics
4. Update documentation and Postman collection

### 🚀 Usage Examples

#### Get Latest Socket 1 Data:
```bash
curl -X GET "http://localhost:3030/api/iot/socket1/latest" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Add Socket Data via API:
```bash
curl -X POST "http://localhost:3030/api/iot/socket1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "voltage": 220.5,
    "current": 2.3,
    "power": 507.15,
    "frequency": 50.0,
    "power_factor": 0.95,
    "machine_state": true,
    "socket_state": true,
    "sensor_state": true,
    "over_voltage": false,
    "under_voltage": false
  }'
```

#### Get Socket Data by Time Range:
```bash
curl -X GET "http://localhost:3030/api/iot/socket1/range?startDate=2025-11-16&endDate=2025-11-17&groupBy=hour" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 📝 Notes
- Tất cả endpoints cũ vẫn hoạt động thông qua controller aliases
- Schema database cần được update với script SQL provided
- MQTT topics mới sẽ tự động lưu vào đúng socket tables
- Authentication và permission checking vẫn áp dụng như cũ