# MQTT DATA STORAGE STRATEGY - FINAL DOCUMENTATION

## 📊 OVERVIEW

Hệ thống IoMT sử dụng **HYBRID STORAGE APPROACH** để lưu trữ dữ liệu MQTT từ PDU sockets, hỗ trợ đầy đủ các loại công suất (W, VA, VAR).

## ✅ GIẢI QUYẾT VẤN ĐỀ: W vs VA vs VAR

### CÁC LOẠI CÔNG SUẤT

| Type | Name | Unit | Formula | Use Case |
|------|------|------|---------|----------|
| **P** | Active Power | **W** | V × I × cos(φ) | Tính tiền điện |
| **S** | Apparent Power | **VA** | V × I | Thiết kế máy biến áp |
| **Q** | Reactive Power | **VAR** | V × I × sin(φ) | Bù công suất |
| **PF** | Power Factor | - | P / S = cos(φ) | Hiệu suất |

### RELATIONSHIP
```
S² = P² + Q²
Power Factor = P / S = cos(φ)
```

## 🗄️ DATABASE SCHEMA (UPDATED)

### 1. measurements Table (Unchanged)
```sql
CREATE TABLE measurements (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  unit VARCHAR(20),
  data_type measurement_data_type
);

-- Current measurements:
Active Power     | W   | numeric
Apparent Power   | VA  | numeric
Reactive Power   | VAR | numeric
Voltage          | V   | numeric
Current          | A   | numeric
Frequency        | Hz  | numeric
Power Factor     | -   | numeric (dimensionless)
```

### 2. device_data Table (Raw Storage - Unchanged)
```sql
CREATE TABLE device_data (
  id UUID PRIMARY KEY,
  device_id UUID,
  measurement_id UUID,  -- FK to measurements
  socket_id UUID,
  data_payload JSONB,    -- Full MQTT payload
  timestamp TIMESTAMPTZ
);
```

**Purpose**: Lưu full payload, preserve original data

### 3. device_latest_data Table (Latest Values - Unchanged)
```sql
CREATE TABLE device_latest_data (
  device_id UUID,
  measurement_id UUID,
  latest_value NUMERIC,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (device_id, measurement_id)
);
```

**Purpose**: Fast query cho dashboard, không cần scan device_data

### 4. ⭐ sockets Table (Configuration Only - UPDATED)
```sql
CREATE TABLE sockets (
  id UUID PRIMARY KEY,
  socket_number INT,
  name VARCHAR(100),
  mqtt_topic_suffix VARCHAR(100),
  max_power_watts REAL,
  socket_type VARCHAR(50),
  device_id UUID,
  status socket_status,         -- Connection status only
  is_enabled BOOLEAN,
  mqtt_broker_host VARCHAR(255),
  mqtt_broker_port INT,
  mqtt_credentials JSON,
  -- REMOVED: current_power, current_voltage, current_current, last_data_at
  ...
);
```

**Purpose**: Socket configuration & connection management ONLY

### 5. ⭐ device_current_state Table (Real-time Data - SIMPLIFIED)
```sql
CREATE TABLE device_current_state (
  device_id UUID PRIMARY KEY,
  socket_id UUID,
  active_power REAL,           -- W (Active Power)
  apparent_power REAL,         -- VA (Apparent Power)
  voltage REAL,                -- V
  current REAL,                -- A
  power_factor REAL,           -- Power Factor
  frequency REAL,              -- Hz
  is_connected BOOLEAN,        -- Device connectivity
  last_seen_at TIMESTAMPTZ,    -- Last data received
  updated_at TIMESTAMPTZ
);
```

**Purpose**: Real-time device status, simplified and focused

## 🔄 DATA FLOW

### Input: MQTT Message
```json
Topic: hopt/tang3/pkt/socket1
Payload: {
  "voltage": 220,
  "current": 2.5,
  "power": 500,            // Active Power (W)
  "apparent_power": 550,   // Apparent Power (VA) 
  "reactive_power": 150,   // Reactive Power (VAR)
  "power_factor": 0.91,
  "frequency": 50
}
```

### Processing Steps

```javascript
// 1. Parse payload
const payload = JSON.parse(mqttMessage);

// 2. Resolve socket → device
const socket = await getSocketByTopic(topic);
const device = await getOrCreateDevice(socket.id);

// 3. Get measurement IDs
const activePowerId = await getMeasurementId('Active Power');
const apparentPowerId = await getMeasurementId('Apparent Power');
const voltageId = await getMeasurementId('Voltage');

// 4. Insert to device_data (raw storage)
await prisma.device_data.create({
  device_id: device.id,
  measurement_id: activePowerId,  // Primary measurement
  socket_id: socket.id,
  data_payload: payload,           // Full JSON
  timestamp: new Date()
});

// 5. Update device_latest_data (for each metric)
await prisma.device_latest_data.upsert({
  where: { device_id_measurement_id: { device_id, measurement_id: activePowerId }},
  update: { latest_value: payload.power },
  create: { device_id, measurement_id: activePowerId, latest_value: payload.power }
});

// Repeat for apparent_power, voltage, current, etc.

// 6. Update device_current_state (real-time data)
await prisma.device_current_state.upsert({
  where: { device_id: device.id },
  update: {
    socket_id: socket.id,
    active_power: payload.power,
    apparent_power: payload.apparent_power,
    voltage: payload.voltage,
    current: payload.current,
    power_factor: payload.power_factor,
    frequency: payload.frequency,
    is_connected: true,
    last_seen_at: new Date()
  },
  create: { /* same fields */ }
});

// 7. Update sockets (status only)
await prisma.sockets.update({
  where: { id: socket.id },
  data: {
    status: payload.power > 0 ? 'active' : 'idle'
  }
});
```

### Output: 4 Tables Updated

1. **device_data**: 
   - 1 record với full JSONB payload
   - measurement_id = Active Power (primary metric)

2. **device_latest_data**: 
   - N records (1 per measurement type)
   - Active Power: 500W
   - Apparent Power: 550VA
   - Voltage: 220V
   - etc.

3. **device_current_state**: (⭐ NEW ROLE)
   - 1 upsert với real-time metrics
   - active_power, apparent_power, voltage, current
   - power_factor, frequency, is_connected, last_seen_at

4. **sockets**: (⭐ SIMPLIFIED ROLE)
   - 1 update với connection status only
   - status (active/idle/inactive)
   - Configuration & MQTT setup unchanged

## 🎯 USE CASES

### Dashboard Query (Fast)
```sql
-- Get latest power values
SELECT 
  s.socket_number,
  s.current_power as active_power_w,
  s.current_voltage as voltage_v,
  s.status
FROM sockets s
WHERE s.pdu_id = ?;
```

### Historical Chart (Flexible)
```sql
-- Get power history
SELECT 
  timestamp,
  data_payload->>'power' as active_power,
  data_payload->>'apparent_power' as apparent_power
FROM device_data
WHERE socket_id = ?
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Analytics by Measurement Type
```sql
-- Compare W vs VA
SELECT 
  m.name,
  m.unit,
  AVG(d.latest_value) as avg_value,
  MAX(d.latest_value) as max_value
FROM device_latest_data d
JOIN measurements m ON d.measurement_id = m.id
WHERE d.device_id = ?
GROUP BY m.name, m.unit;
```

## 📈 PERFORMANCE

### Storage Estimate (1 payload/sec, 1 year)
- device_data: ~6 GB (JSONB payload)
- device_latest_data: ~1 MB (latest only)
- sockets: ~10 KB (current values)
- **Total**: ~6 GB/socket/year

### Query Performance
- Dashboard: **Instant** (direct query sockets table)
- Latest values: **Fast** (indexed device_latest_data)
- Historical: **Good** (JSONB with GIN index)

## 🚀 SCALABILITY

### Phase 1: Current (0-100 sockets)
✅ PostgreSQL JSONB + denormalized sockets table

### Phase 2: Partitioning (100M+ records)
- Partition device_data by timestamp (monthly)
- Archive old partitions

### Phase 3: Time-Series DB (100+ sockets)
- Migrate to TimescaleDB
- Keep PostgreSQL for metadata

## ✅ ADVANTAGES

1. **Flexible**: JSONB accepts any payload structure
2. **Fast Inserts**: 1 record per payload
3. **Fast Reads**: Denormalized sockets table
4. **Multi-unit Support**: W, VA, VAR via measurements
5. **Analytics Ready**: JSONB operators + normalized latest_data
6. **Future-proof**: Easy to add new measurements

## 📊 SUMMARY

**Câu trả lời:** ✅ **HOÀN TOÀN GIẢI QUYẾT ĐƯỢC**

Cấu trúc hiện tại hỗ trợ:
- ✅ Active Power (W)
- ✅ Apparent Power (VA)
- ✅ Reactive Power (VAR)
- ✅ Bất kỳ measurement type nào khác

Chỉ cần tạo thêm measurements tương ứng và hệ thống sẽ tự động handle!
