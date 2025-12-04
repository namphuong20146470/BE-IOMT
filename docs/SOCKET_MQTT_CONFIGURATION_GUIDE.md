# Hướng dẫn cấu hình MQTT cho Sockets và Lưu trữ dữ liệu
> **⚠️ UPDATED ARCHITECTURE:** This guide reflects the new Socket-Based MQTT Architecture. See [SOCKET_BASED_MQTT_ARCHITECTURE.md](./SOCKET_BASED_MQTT_ARCHITECTURE.md) for complete details.

## 1. Cấu hình MQTT cho Socket

### 1.1. Cấu trúc bảng `sockets`
Mỗi socket cần được cấu hình với thông tin MQTT sau:

```sql
-- Cấu hình cơ bản trong bảng sockets
CREATE TABLE sockets (
  id UUID PRIMARY KEY,
  pdu_id UUID NOT NULL,
  socket_number INT NOT NULL,
  name VARCHAR(100),
  mqtt_topic_suffix VARCHAR(100) NOT NULL,  -- VD: "socket1", "socket2"
  
  -- Cấu hình MQTT Broker
  mqtt_broker_host VARCHAR(255),            -- VD: "broker.hivemq.com"
  mqtt_broker_port INT DEFAULT 1883,       -- Port MQTT (1883 standard, 8883 SSL)
  mqtt_credentials JSON DEFAULT '{}',       -- {"username": "", "password": ""}
  mqtt_config JSON DEFAULT '{}',           -- Cấu hình bổ sung
  
  -- Trạng thái kết nối
  status socket_status DEFAULT 'inactive', -- active, idle, inactive, error
  is_enabled BOOLEAN DEFAULT true,
  
  -- Thiết bị được gán
  device_id UUID UNIQUE,                   -- Thiết bị được gắn vào socket
  assigned_at TIMESTAMPTZ,
  assigned_by UUID
);
```

### 1.2. Cấu hình MQTT Chi tiết

#### A. Thông tin Broker
```json
{
  "broker_host": "broker.hivemq.com",
  "broker_port": 1883,
  "protocol": "mqtt",
  "version": "3.1.1",
  "keepalive": 60,
  "clean_session": true,
  "qos": 0
}
```

#### B. Credentials (Nếu cần authentication)
```json
{
  "username": "your_mqtt_username",
  "password": "your_mqtt_password",
  "client_id": "iomt_socket_{socket_id}"
}
```

#### C. Topic Structure
```
Base Topic: hopt/tang3/pkt/
Socket Topics:
- hopt/tang3/pkt/socket1
- hopt/tang3/pkt/socket2
- hopt/tang3/pkt/socket3
- hopt/tang3/pkt/socket4
```

### 1.3. Payload Format
```json
{
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
  "timestamp": "2024-12-03T10:30:00Z"
}
```

## 2. Lưu trữ dữ liệu vào Database

### 2.1. Cấu trúc bảng lưu trữ dữ liệu

#### A. `device_data` - Lưu trữ payload gốc
```sql
CREATE TABLE device_data (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL,
  measurement_id UUID NOT NULL,
  socket_id UUID,
  data_payload JSON NOT NULL,           -- Payload MQTT gốc
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (device_id) REFERENCES device(id),
  FOREIGN KEY (socket_id) REFERENCES sockets(id),
  FOREIGN KEY (measurement_id) REFERENCES measurements(id)
);
```

#### B. `device_latest_data` - Dữ liệu mới nhất (normalized)
```sql
CREATE TABLE device_latest_data (
  device_id UUID,
  measurement_id UUID,
  latest_value REAL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (device_id, measurement_id)
);
```

#### C. `device_current_state` - Trạng thái real-time
```sql
CREATE TABLE device_current_state (
  device_id UUID PRIMARY KEY,
  socket_id UUID,
  
  -- Các giá trị đo lường chính
  active_power REAL,
  apparent_power REAL,
  voltage REAL,
  current REAL,
  power_factor REAL,
  frequency REAL,
  
  -- Trạng thái kết nối
  is_connected BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2. Bảng `measurements` - Định nghĩa các loại đo lường
```sql
INSERT INTO measurements (id, name, unit, data_type) VALUES
('uuid1', 'Active Power', 'W', 'numeric'),
('uuid2', 'Apparent Power', 'VA', 'numeric'),
('uuid3', 'Reactive Power', 'VAR', 'numeric'),
('uuid4', 'Voltage', 'V', 'numeric'),
('uuid5', 'Current', 'A', 'numeric'),
('uuid6', 'Frequency', 'Hz', 'numeric'),
('uuid7', 'Power Factor', '', 'numeric');
```

## 3. Quy trình kết nối và lưu trữ dữ liệu

### 3.1. Khởi tạo Socket MQTT Connection

```javascript
// features/sockets/socket-mqtt-client.js
const mqtt = require('mqtt');

class SocketMQTTClient {
  constructor(socketConfig) {
    this.socketId = socketConfig.id;
    this.config = {
      host: socketConfig.mqtt_broker_host,
      port: socketConfig.mqtt_broker_port,
      ...socketConfig.mqtt_config,
      ...socketConfig.mqtt_credentials
    };
    this.topic = `hopt/tang3/pkt/${socketConfig.mqtt_topic_suffix}`;
  }

  connect() {
    const brokerUrl = `mqtt://${this.config.host}:${this.config.port}`;
    this.client = mqtt.connect(brokerUrl, {
      clientId: `iomt_socket_${this.socketId}`,
      username: this.config.username,
      password: this.config.password,
      keepalive: 60,
      clean: true
    });

    this.client.on('connect', () => {
      console.log(`Socket ${this.socketId} connected to MQTT broker`);
      this.client.subscribe(this.topic);
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  async handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      await this.storeData(payload);
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }
}
```

### 3.2. Lưu trữ dữ liệu (Hybrid Approach)

```javascript
// features/sockets/socket-data.service.js
class SocketDataService {
  async storeSocketData(socketId, deviceId, payload) {
    const prisma = require('../config/db');
    
    try {
      // 1. Lưu payload gốc vào device_data
      await prisma.device_data.create({
        data: {
          device_id: deviceId,
          socket_id: socketId,
          measurement_id: 'power-measurement-uuid', // Sẽ xử lý dynamic
          data_payload: payload,
          timestamp: new Date(payload.timestamp)
        }
      });

      // 2. Cập nhật device_latest_data cho từng measurement
      const measurements = [
        { id: 'power-uuid', value: payload.power },
        { id: 'voltage-uuid', value: payload.voltage },
        { id: 'current-uuid', value: payload.current },
        { id: 'frequency-uuid', value: payload.frequency },
        { id: 'power-factor-uuid', value: payload.power_factor }
      ];

      for (const measurement of measurements) {
        await prisma.device_latest_data.upsert({
          where: {
            device_id_measurement_id: {
              device_id: deviceId,
              measurement_id: measurement.id
            }
          },
          update: {
            latest_value: measurement.value,
            updated_at: new Date()
          },
          create: {
            device_id: deviceId,
            measurement_id: measurement.id,
            latest_value: measurement.value
          }
        });
      }

      // 3. Cập nhật device_current_state (real-time state)
      await prisma.device_current_state.upsert({
        where: { device_id: deviceId },
        update: {
          socket_id: socketId,
          active_power: payload.power,
          voltage: payload.voltage,
          current: payload.current,
          power_factor: payload.power_factor,
          frequency: payload.frequency,
          is_connected: payload.sensor_state,
          last_seen_at: new Date(),
          updated_at: new Date()
        },
        create: {
          device_id: deviceId,
          socket_id: socketId,
          active_power: payload.power,
          voltage: payload.voltage,
          current: payload.current,
          power_factor: payload.power_factor,
          frequency: payload.frequency,
          is_connected: payload.sensor_state,
          last_seen_at: new Date()
        }
      });

      // 4. Cập nhật trạng thái socket
      await prisma.sockets.update({
        where: { id: socketId },
        data: {
          status: payload.socket_state ? 'active' : 'idle',
          updated_at: new Date()
        }
      });

    } catch (error) {
      console.error('Error storing socket data:', error);
      throw error;
    }
  }
}
```

## 4. Cấu hình Socket từ Frontend

### 4.1. API Endpoint để cấu hình Socket
```javascript
// routes/sockets/index.js
router.put('/sockets/:id/mqtt-config', async (req, res) => {
  const { id } = req.params;
  const { 
    mqtt_broker_host, 
    mqtt_broker_port, 
    mqtt_credentials, 
    mqtt_config 
  } = req.body;

  try {
    const socket = await prisma.sockets.update({
      where: { id },
      data: {
        mqtt_broker_host,
        mqtt_broker_port,
        mqtt_credentials,
        mqtt_config,
        updated_at: new Date()
      }
    });

    // Restart MQTT connection for this socket
    await mqttManager.reconnectSocket(id);

    res.json({ success: true, socket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.2. Payload cấu hình Socket
```json
{
  "mqtt_broker_host": "broker.hivemq.com",
  "mqtt_broker_port": 1883,
  "mqtt_credentials": {
    "username": "",
    "password": "",
    "client_id": "iomt_socket_01"
  },
  "mqtt_config": {
    "qos": 0,
    "retain": false,
    "keepalive": 60,
    "clean_session": true,
    "protocol": "mqtt",
    "version": "3.1.1"
  }
}
```

## 5. Truy vấn dữ liệu

### 5.1. Lấy dữ liệu real-time
```sql
SELECT 
  s.name as socket_name,
  s.socket_number,
  dcs.active_power,
  dcs.voltage,
  dcs.current,
  dcs.power_factor,
  dcs.frequency,
  dcs.is_connected,
  dcs.last_seen_at
FROM sockets s
LEFT JOIN device_current_state dcs ON s.device_id = dcs.device_id
WHERE s.pdu_id = 'pdu-uuid'
ORDER BY s.socket_number;
```

### 5.2. Lấy lịch sử dữ liệu
```sql
SELECT 
  dd.timestamp,
  dd.data_payload,
  s.name as socket_name
FROM device_data dd
JOIN sockets s ON dd.socket_id = s.id
WHERE s.id = 'socket-uuid'
  AND dd.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY dd.timestamp DESC;
```

### 5.3. Thống kê theo measurement
```sql
SELECT 
  m.name as measurement_name,
  m.unit,
  dl.latest_value,
  dl.updated_at
FROM device_latest_data dl
JOIN measurements m ON dl.measurement_id = m.id
WHERE dl.device_id = 'device-uuid'
ORDER BY dl.updated_at DESC;
```

## 6. Monitoring và Troubleshooting

### 6.1. Kiểm tra kết nối MQTT
```javascript
// Endpoint để check trạng thái MQTT
router.get('/sockets/:id/mqtt-status', async (req, res) => {
  const { id } = req.params;
  
  const socket = await prisma.sockets.findUnique({
    where: { id },
    include: { device_current_state: true }
  });

  const status = {
    socket_id: id,
    mqtt_configured: !!(socket.mqtt_broker_host && socket.mqtt_broker_port),
    last_data_received: socket.device_current_state?.last_seen_at,
    is_connected: socket.device_current_state?.is_connected || false,
    current_status: socket.status
  };

  res.json(status);
});
```

### 6.2. Logs và Debug
```javascript
// Thêm logging cho MQTT operations
class MQTTLogger {
  static logConnection(socketId, status, details) {
    console.log(`[MQTT] Socket ${socketId}: ${status}`, details);
  }
  
  static logDataReceived(socketId, dataSize, timestamp) {
    console.log(`[MQTT] Socket ${socketId}: Received ${dataSize} bytes at ${timestamp}`);
  }
  
  static logError(socketId, error) {
    console.error(`[MQTT] Socket ${socketId}: Error -`, error);
  }
}
```

## 7. Best Practices

### 7.1. Bảo mật
- Sử dụng TLS/SSL cho MQTT connection (port 8883)
- Lưu trữ credentials được mã hóa
- Implement authentication và authorization

### 7.2. Performance
- Sử dụng connection pooling cho database
- Batch insert cho dữ liệu có volume lớn
- Index optimization cho timestamp queries

### 7.3. Reliability
- Implement retry logic cho MQTT connections
- Heartbeat monitoring để detect disconnected sockets
- Data validation trước khi lưu vào database

Tài liệu này cung cấp đầy đủ thông tin để cấu hình MQTT cho sockets và lưu trữ dữ liệu vào hệ thống database IoMT.