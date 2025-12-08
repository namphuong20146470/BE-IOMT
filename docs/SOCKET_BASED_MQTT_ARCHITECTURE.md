# Socket-Based MQTT Architecture Guide

## Overview
IoMT system now uses a **Socket-Based MQTT Architecture** where MQTT connectivity is managed through PDU (Power Distribution Units) and their associated sockets, eliminating the need for device-specific connectivity configuration.

## Architecture Components

### 1. **PDU (Power Distribution Unit)**
- Contains `mqtt_base_topic` (e.g., `"hopt/tang3/pkt"`)  
- Manages organization and department associations
- Physical location and specifications

### 2. **Socket**
- Each socket has `mqtt_topic_suffix` (e.g., `"socket1"`, `"socket2"`)
- Contains complete MQTT broker configuration:
  - `mqtt_broker_host` - MQTT broker hostname
  - `mqtt_broker_port` - MQTT broker port (default: 1883)
  - `mqtt_credentials` - JSON object with username/password
  - `mqtt_config` - JSON object with QoS, retain, keepalive settings

### 3. **Device**
- Assigned to a specific socket via `socket.device_id`
- Inherits MQTT configuration from its assigned socket
- Data flows through the socket's MQTT topic

## MQTT Topic Structure

**Full Topic Format:** `{pdu.mqtt_base_topic}/{socket.mqtt_topic_suffix}`

**Example:**
- PDU: `mqtt_base_topic = "hopt/tang3/pkt"`
- Socket: `mqtt_topic_suffix = "socket1"`
- **Result:** `"hopt/tang3/pkt/socket1"`

## Configuration Examples

### Socket MQTT Configuration
```json
{
  "mqtt_broker_host": "broker.hivemq.com",
  "mqtt_broker_port": 1883,
  "mqtt_credentials": {
    "username": "iomt_user",
    "password": "secure_password"
  },
  "mqtt_config": {
    "qos": 1,
    "retain": false,
    "keepalive": 60,
    "clean_session": true
  }
}
```

### Device Assignment Flow
1. **Create PDU** with `mqtt_base_topic`
2. **Configure Socket** with MQTT broker details and `mqtt_topic_suffix`
3. **Assign Device** to socket via `socket.device_id`
4. **MQTT Connection** established automatically using socket configuration

## API Changes

### Old Device Connectivity Endpoints (REMOVED)
```
❌ GET /mqtt/connectivity
❌ POST /mqtt/connectivity
❌ PUT /mqtt/connectivity/:id
❌ DELETE /mqtt/connectivity/:id
```

### New Socket-Based Endpoints
```
✅ GET /mqtt/devices                    # Get MQTT devices via sockets
✅ GET /mqtt/devices/:deviceId          # Get device MQTT config via socket
✅ POST /mqtt/devices                   # Assign device to socket with MQTT config
✅ PUT /mqtt/devices/:deviceId          # Update socket MQTT config
✅ DELETE /mqtt/devices/:deviceId       # Unassign device from socket

✅ GET /sockets/:id/mqtt-config         # Get socket MQTT configuration
✅ PUT /sockets/:id/mqtt-config         # Update socket MQTT configuration
✅ GET /sockets/:id/mqtt-status         # Get socket MQTT connection status
```

## Database Schema Changes

### Removed Tables
- ❌ `device_connectivity` - Eliminated redundant table

### Enhanced Tables
```sql
-- Sockets table now contains all MQTT configuration
ALTER TABLE sockets ADD COLUMN mqtt_broker_host VARCHAR(255);
ALTER TABLE sockets ADD COLUMN mqtt_broker_port INT DEFAULT 1883;
ALTER TABLE sockets ADD COLUMN mqtt_credentials JSONB DEFAULT '{}';
ALTER TABLE sockets ADD COLUMN mqtt_config JSONB DEFAULT '{}';

-- PDU contains base MQTT topic
ALTER TABLE power_distribution_units ADD COLUMN mqtt_base_topic VARCHAR(255);
```

## MQTT Client Implementation

### Socket MQTT Client
New `SocketMQTTClient` class manages connections:

```javascript
import socketMQTTClient from '../features/mqtt/socket-mqtt-client.js';

// Initialize all socket connections
await socketMQTTClient.initializeAll();

// Connect specific socket
await socketMQTTClient.connectSocket(socketConfig);

// Publish to socket topic
await socketMQTTClient.publishToSocket(socketId, message);

// Get connection status
const status = socketMQTTClient.getSocketStatus(socketId);
```

### Event Handling
```javascript
socketMQTTClient.on('connected', ({ socketId, socket }) => {
    console.log(`Socket ${socket.socket_number} connected`);
});

socketMQTTClient.on('data', ({ socketId, socket, data }) => {
    console.log(`Data received from socket ${socket.socket_number}:`, data);
});

socketMQTTClient.on('error', ({ socketId, error }) => {
    console.error(`Socket ${socketId} error:`, error);
});
```

## Data Flow

### MQTT Message Processing
1. **Message Received** on topic `hopt/tang3/pkt/socket1`
2. **Socket Identified** by topic suffix matching
3. **Device Located** via `socket.device_id`
4. **Data Stored** in `device_data_logs` with `socket_id`
5. **Current State Updated** in `device_current_state`

### Data Storage
```sql
-- Raw MQTT data logs
INSERT INTO device_data_logs (device_id, socket_id, data_json, timestamp)
VALUES (device_id, socket_id, mqtt_payload, NOW());

-- Current device state (real-time)
UPSERT device_current_state 
SET voltage = data.voltage, current = data.current, ...
WHERE device_id = device_id;
```

## Migration Steps

### From device_connectivity to Socket-based
1. **Export existing MQTT configs** from `device_connectivity`
2. **Identify device-socket assignments**
3. **Migrate MQTT configs** to appropriate sockets
4. **Update application code** to use socket endpoints
5. **Test MQTT connectivity** via new architecture
6. **Drop device_connectivity table**

## Benefits

### ✅ **Simplified Architecture**
- Single source of truth for MQTT configuration
- Logical PDU → Socket → Device hierarchy
- Eliminated data redundancy

### ✅ **Better Organization**
- MQTT config tied to physical infrastructure (PDU/Socket)
- Easier bulk configuration management
- Clear organizational boundaries

### ✅ **Enhanced Scalability**
- Socket-based connection pooling
- PDU-level MQTT broker configuration
- Automatic topic generation

### ✅ **Improved Maintainability**
- Fewer tables to manage
- Consistent configuration patterns
- Centralized MQTT client management

## Troubleshooting

### Common Issues
1. **Device not receiving data**
   - Check socket MQTT configuration
   - Verify PDU base topic + socket suffix
   - Confirm device assignment to socket

2. **MQTT connection failures**
   - Validate broker credentials in socket config
   - Check network connectivity from socket's perspective
   - Review MQTT client logs for specific socket

3. **Topic mismatch**
   - Ensure PDU `mqtt_base_topic` is correct
   - Verify socket `mqtt_topic_suffix` matches expected pattern
   - Check for trailing slashes or special characters

### Monitoring
```javascript
// Get all socket statuses
const statuses = socketMQTTClient.getAllStatuses();

// Monitor specific socket
const socketStatus = socketMQTTClient.getSocketStatus(socketId);
console.log('Socket Status:', socketStatus);
```

## Future Enhancements

1. **Dynamic Topic Management**
   - Auto-generate topics based on PDU location
   - Support for hierarchical topic structures
   - Topic validation and conflict detection

2. **Advanced MQTT Features**
   - SSL/TLS configuration per socket
   - Custom authentication methods
   - Quality of Service (QoS) optimization

3. **Monitoring & Analytics**
   - Real-time connection monitoring
   - MQTT message rate tracking
   - Performance metrics per socket/PDU