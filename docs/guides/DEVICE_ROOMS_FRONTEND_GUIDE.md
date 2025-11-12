# Device Rooms - Frontend Integration Guide

## 🏠 Socket.IO Device Rooms Implementation

### Overview
Device rooms allow clients to subscribe to specific device data streams instead of receiving all MQTT data globally.

## 📡 Connection & Room Management

### 1. Basic Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    auth: {
        token: localStorage.getItem('access_token') // Optional
    }
});

// Listen for successful connection
socket.on('connected', (data) => {
    console.log('Connected to IoMT:', data);
    console.log('Available rooms:', data.availableRooms);
    console.log('Auto-joined rooms:', data.joinedRooms);
});
```

### 2. Join Specific Device Room
```javascript
// Join room for specific device
const deviceId = 'f88c7482-5d60-4b00-b003-c6e307594002';
socket.emit('join_device_room', deviceId);

// Listen for confirmation
socket.on('room_joined', (data) => {
    console.log('Joined device room:', data);
    // { room: 'device:f88c7482-...', deviceId: 'f88c7482-...', timestamp: '...' }
});

// Listen for errors
socket.on('room_error', (error) => {
    console.error('Room operation failed:', error);
});
```

### 3. Leave Device Room
```javascript
// Leave specific device room
socket.emit('leave_device_room', deviceId);

// Listen for confirmation
socket.on('room_left', (data) => {
    console.log('Left device room:', data);
});
```

### 4. Bulk Room Operations
```javascript
// Join multiple rooms at once
const roomsToJoin = ['device:device1', 'device:device2'];
socket.emit('join_rooms', roomsToJoin);

socket.on('rooms_joined', (data) => {
    console.log('Successfully joined:', data.joined);
    console.log('Failed to join:', data.failed);
});

// Leave multiple rooms
const roomsToLeave = ['device:device1', 'device:device2'];
socket.emit('leave_rooms', roomsToLeave);

socket.on('rooms_left', (data) => {
    console.log('Left rooms:', data.rooms);
});
```

### 5. Get Room Information
```javascript
// Request current room status
socket.emit('get_room_info');

socket.on('room_info', (data) => {
    console.log('Joined rooms:', data.joinedRooms);
    console.log('Available rooms:', data.availableRooms);
    console.log('Room stats:', data.stats);
});
```

## 📊 Receiving Device Data

### 1. Listen to All Device Data (Default)
```javascript
// Automatically joined to 'device:all' room on connection
socket.on('mqtt_data', (data) => {
    console.log('Device data from any device:', data);
    
    // Data structure:
    // {
    //   deviceId: "f88c7482-5d60-4b00-b003-c6e307594002",
    //   deviceName: "LED Nova Device", 
    //   data: { voltage: 232.6, current: 1.822, ... },
    //   room: "device:all",
    //   metadata: { receivedFields: [...], lastUpdate: "...", source: "mqtt_dynamic" }
    // }
});
```

### 2. Listen to Specific Device Data Only
```javascript
// First join the specific device room
socket.emit('join_device_room', 'f88c7482-5d60-4b00-b003-c6e307594002');

// Then leave the 'device:all' room to stop receiving other devices
socket.emit('leave_rooms', ['device:all']);

// Now you'll only receive data from the specific device
socket.on('mqtt_data', (data) => {
    if (data.room === 'device:f88c7482-5d60-4b00-b003-c6e307594002') {
        console.log('Specific device data:', data);
        updateDeviceDisplay(data);
    }
});
```

### 3. Filter Data by Room
```javascript
socket.on('mqtt_data', (data) => {
    switch(data.room) {
        case 'device:all':
            // Handle data from any device (overview dashboard)
            updateOverviewDashboard(data);
            break;
            
        case `device:${specificDeviceId}`:
            // Handle data from specific device
            updateDeviceDetailView(data);
            break;
            
        default:
            console.log('Unknown room:', data.room);
    }
});
```

## 🎯 React Hook Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const useDeviceRoom = (deviceId = null) => {
    const [socket, setSocket] = useState(null);
    const [deviceData, setDeviceData] = useState({});
    const [connectedRooms, setConnectedRooms] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initialize socket connection
        const newSocket = io('http://localhost:3000', {
            auth: {
                token: localStorage.getItem('access_token')
            }
        });

        // Connection handlers
        newSocket.on('connected', (data) => {
            setIsConnected(true);
            setConnectedRooms(data.joinedRooms);
            console.log('Connected to IoMT with rooms:', data.joinedRooms);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
            setConnectedRooms([]);
        });

        // Room management handlers
        newSocket.on('room_joined', (data) => {
            setConnectedRooms(prev => [...prev, data.room]);
        });

        newSocket.on('room_left', (data) => {
            setConnectedRooms(prev => prev.filter(room => room !== data.room));
        });

        // Data handler
        newSocket.on('mqtt_data', (data) => {
            setDeviceData(prevData => ({
                ...prevData,
                [data.deviceId]: {
                    ...data,
                    lastUpdate: new Date()
                }
            }));
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    // Join specific device room
    const joinDeviceRoom = (deviceId) => {
        if (socket && deviceId) {
            socket.emit('join_device_room', deviceId);
        }
    };

    // Leave specific device room
    const leaveDeviceRoom = (deviceId) => {
        if (socket && deviceId) {
            socket.emit('leave_device_room', deviceId);
        }
    };

    // Get room information
    const getRoomInfo = () => {
        if (socket) {
            socket.emit('get_room_info');
        }
    };

    return {
        socket,
        deviceData,
        connectedRooms,
        isConnected,
        joinDeviceRoom,
        leaveDeviceRoom,
        getRoomInfo
    };
};

export default useDeviceRoom;
```

## 🎨 Component Example

```javascript
import React, { useEffect, useState } from 'react';
import useDeviceRoom from './useDeviceRoom';

const DeviceMonitor = ({ deviceId }) => {
    const { 
        deviceData, 
        connectedRooms, 
        isConnected, 
        joinDeviceRoom, 
        leaveDeviceRoom 
    } = useDeviceRoom();

    const [isMonitoring, setIsMonitoring] = useState(false);

    // Auto-join device room when component mounts
    useEffect(() => {
        if (deviceId && isConnected) {
            joinDeviceRoom(deviceId);
            setIsMonitoring(true);
        }

        return () => {
            if (deviceId && isConnected) {
                leaveDeviceRoom(deviceId);
                setIsMonitoring(false);
            }
        };
    }, [deviceId, isConnected]);

    const currentDeviceData = deviceData[deviceId];

    return (
        <div className="device-monitor">
            <h3>Device Monitor: {deviceId}</h3>
            
            <div className="connection-status">
                Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                {isMonitoring && <span> | 📡 Monitoring</span>}
            </div>

            <div className="rooms-info">
                Connected Rooms: {connectedRooms.join(', ')}
            </div>

            {currentDeviceData && (
                <div className="device-data">
                    <h4>{currentDeviceData.deviceName}</h4>
                    <p>Last Update: {currentDeviceData.lastUpdate?.toLocaleString()}</p>
                    <p>From Room: {currentDeviceData.room}</p>
                    
                    <div className="data-fields">
                        {Object.entries(currentDeviceData.data).map(([key, value]) => (
                            <div key={key} className="field">
                                <strong>{key}:</strong> {value}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceMonitor;
```

## 🎯 Available Room Types

### Current Implementation:
1. **`device:all`** - Receives data from all devices (auto-joined)
2. **`device:${deviceId}`** - Receives data from specific device only
3. **`authenticated`** - For logged-in users (auto-joined if authenticated)

### Future Room Types (Planned):
- **`location:${location}`** - Location-based filtering
- **`role:${role}`** - Role-based data access
- **`department:${dept}`** - Department-specific devices
- **`alerts:${level}`** - Alert/warning notifications

## 🔧 Testing

```javascript
// Test in browser console:
socket.emit('join_device_room', 'f88c7482-5d60-4b00-b003-c6e307594002');
socket.emit('get_room_info');

// Monitor device data
socket.on('mqtt_data', console.log);
```

## 📊 Benefits

1. **🎯 Targeted Data**: Only receive data for devices you care about
2. **⚡ Performance**: Reduced bandwidth and CPU usage
3. **🔒 Security**: Foundation for permission-based data access
4. **📱 Scalability**: Better support for large device deployments
5. **🎨 UX**: Cleaner UI with relevant data only