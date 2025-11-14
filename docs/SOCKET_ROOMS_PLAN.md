# Socket.IO Rooms Implementation Plan

## Current Status: ❌ NO ROOMS IMPLEMENTED

Hiện tại Socket.IO chỉ broadcast globally, không có room segmentation.

## Proposed Room Structure

### 1. Device-Specific Rooms
```javascript
// Join specific device room
socket.join(`device:${deviceId}`);

// Emit to specific device subscribers
io.to(`device:${deviceId}`).emit('mqtt_data', deviceData);

// Join all devices room
socket.join('device:all');
```

### 2. Location-Based Rooms
```javascript
// ICU rooms
socket.join('location:icu_room_101');
socket.join('location:icu_room_102');

// Operating rooms
socket.join('location:operating_room_1');
socket.join('location:operating_room_2');

// Emergency
socket.join('location:emergency_room_1');
```

### 3. Role-Based Rooms
```javascript
// Based on user permissions
socket.join('role:superadmin');    // Can see everything
socket.join('role:doctor');        // Medical devices only
socket.join('role:nurse');         // Patient monitoring only
socket.join('role:technician');    // Equipment status only
```

### 4. Department-Based Rooms
```javascript
socket.join('dept:cardiology');
socket.join('dept:emergency');
socket.join('dept:icu');
socket.join('dept:surgery');
```

### 5. Alert/Warning Rooms
```javascript
socket.join('alerts:critical');     // Critical alerts only
socket.join('alerts:warnings');     // Warning level
socket.join('alerts:all');          // All alert levels
```

## Implementation Benefits

### 🎯 **Targeted Broadcasting**
- Reduce bandwidth usage
- Send relevant data to specific users
- Better performance for large deployments

### 🔒 **Security & Privacy**
- Department isolation
- Role-based data access
- Sensitive equipment separation

### 🚀 **Scalability**
- Efficient data distribution
- Reduced client-side filtering
- Better resource utilization

## Required Changes

### 1. Update SocketService.js
```javascript
// Add room management
setupEventHandlers() {
    this.io.on('connection', async (socket) => {
        // Auto-join based on user role
        await this.autoJoinRoomsBasedOnUser(socket);
        
        // Handle manual room joining
        socket.on('join_room', (roomName) => {
            if (this.canJoinRoom(socket, roomName)) {
                socket.join(roomName);
            }
        });
        
        socket.on('leave_room', (roomName) => {
            socket.leave(roomName);
        });
    });
}

// Smart broadcasting
broadcastToRooms(deviceData, targetRooms = []) {
    targetRooms.forEach(room => {
        this.io.to(room).emit('mqtt_data', deviceData);
    });
}
```

### 2. Update MQTT Broadcasting Logic
```javascript
// In mqtt.dynamic.js
emitRealtimeData(deviceId, deviceData, deviceMetadata) {
    const rooms = this.calculateTargetRooms(deviceId, deviceMetadata);
    
    rooms.forEach(room => {
        global.io.to(room).emit('mqtt_data', {
            deviceId,
            data: deviceData,
            room,
            timestamp: new Date().toISOString()
        });
    });
}

calculateTargetRooms(deviceId, metadata) {
    const rooms = [
        `device:${deviceId}`,        // Specific device
        'device:all'                 // All devices
    ];
    
    // Add location-based rooms
    if (metadata.location) {
        rooms.push(`location:${metadata.location.replace(/\s+/g, '_')}`);
    }
    
    // Add department rooms
    if (metadata.department) {
        rooms.push(`dept:${metadata.department}`);
    }
    
    return rooms;
}
```

## Frontend Integration

### Join Specific Rooms
```javascript
// Join device room
socket.emit('join_room', 'device:f88c7482-5d60-4b00-b003-c6e307594002');

// Join location room
socket.emit('join_room', 'location:icu_room_101');

// Join department room
socket.emit('join_room', 'dept:cardiology');
```

### Listen to Room-Specific Data
```javascript
socket.on('mqtt_data', (data) => {
    console.log(`Data from room ${data.room}:`, data);
    
    // Handle based on room type
    if (data.room.startsWith('device:')) {
        updateDeviceDisplay(data);
    } else if (data.room.startsWith('location:')) {
        updateLocationDashboard(data);
    }
});
```

## Priority Implementation Order

1. ✅ **Device-specific rooms** (HIGH) - Most immediate benefit
2. ✅ **Role-based rooms** (HIGH) - Security requirement  
3. 🔄 **Location-based rooms** (MEDIUM) - UI enhancement
4. 🔄 **Department rooms** (MEDIUM) - Organizational benefit
5. ⏳ **Alert rooms** (LOW) - Future enhancement

## Next Steps

1. Implement device-specific rooms first
2. Add user authentication to room joining
3. Update MQTT broadcasting logic
4. Create frontend room management
5. Add room-based access controls