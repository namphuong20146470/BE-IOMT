import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

class SocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map(); // userId -> socket
        this.roomMemberships = new Map(); // socketId -> Set of rooms
        this.stats = {
            activeConnections: 0,
            messagesEmitted: 0,
            roomsCreated: 0,
            roomJoins: 0,
            roomLeaves: 0
        };
    }

    initialize(server) {
        if (this.io) {
            console.log('⚠️ Socket.IO already initialized, skipping...');
            return;
        }

        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.setupMiddleware();
        this.setupEventHandlers();
        console.log('🔗 Socket.IO server initialized successfully');
    }

    setupMiddleware() {
        // Simplified auth - optional for MQTT data streaming
        this.io.use(async (socket, next) => {
            try {
                let token = socket.handshake.auth?.token || 
                           socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                           this.extractTokenFromCookie(socket.handshake.headers.cookie);
                
                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    socket.userId = decoded.userId || decoded.id;
                    socket.username = decoded.username;
                    console.log(`✅ Authenticated: ${socket.username}`);
                } else {
                    // Allow anonymous connections for MQTT data streaming
                    socket.userId = `anonymous-${Date.now()}`;
                    socket.username = 'Anonymous';
                    console.log(`� Anonymous connection allowed`);
                }
                
                next();
            } catch (error) {
                // Still allow connection for MQTT data
                socket.userId = `anonymous-${Date.now()}`;
                socket.username = 'Anonymous';
                console.log(`📡 Auth failed, allowing anonymous: ${error.message}`);
                next();
            }
        });
    }

    extractTokenFromCookie(cookieHeader) {
        if (!cookieHeader) return null;
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});
        return cookies.access_token;
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.connectedClients.set(socket.userId, socket);
            this.roomMemberships.set(socket.id, new Set());
            this.stats.activeConnections++;

            console.log(`🔌 Client connected: ${socket.username} (Total: ${this.stats.activeConnections})`);

            // ✅ Auto-join default rooms based on user type
            this.autoJoinDefaultRooms(socket);

            // Send connection confirmation with room info
            socket.emit('connected', {
                message: 'Connected to IoMT MQTT Stream',
                userId: socket.userId,
                username: socket.username,
                timestamp: new Date().toISOString(),
                availableRooms: this.getAvailableRooms(socket),
                joinedRooms: Array.from(this.roomMemberships.get(socket.id) || [])
            });

            // ✅ Handle device room operations
            socket.on('join_device_room', (deviceId) => {
                this.joinDeviceRoom(socket, deviceId);
            });

            socket.on('leave_device_room', (deviceId) => {
                this.leaveDeviceRoom(socket, deviceId);
            });

            // ✅ Handle bulk room operations
            socket.on('join_rooms', (roomNames) => {
                this.joinMultipleRooms(socket, roomNames);
            });

            socket.on('leave_rooms', (roomNames) => {
                this.leaveMultipleRooms(socket, roomNames);
            });

            // ✅ Get current room info
            socket.on('get_room_info', () => {
                socket.emit('room_info', {
                    joinedRooms: Array.from(this.roomMemberships.get(socket.id) || []),
                    availableRooms: this.getAvailableRooms(socket),
                    stats: this.getRoomStats()
                });
            });

            // Handle disconnect
            socket.on('disconnect', (reason) => {
                this.connectedClients.delete(socket.userId);
                this.roomMemberships.delete(socket.id);
                this.stats.activeConnections--;
                console.log(`🔌 Client disconnected: ${socket.username} - ${reason} (Remaining: ${this.stats.activeConnections})`);
            });

            // Simple ping/pong
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: new Date().toISOString() });
            });
        });
    }

    // ===== DEVICE ROOM MANAGEMENT =====

    autoJoinDefaultRooms(socket) {
        // ✅ Auto-join default rooms
        const defaultRooms = ['device:all']; // All users can see all device updates by default
        
        // Add role-based default rooms if user is authenticated
        if (socket.userId && !socket.userId.startsWith('anonymous')) {
            defaultRooms.push('authenticated');
        }

        defaultRooms.forEach(room => {
            socket.join(room);
            this.roomMemberships.get(socket.id).add(room);
            this.stats.roomJoins++;
        });

        console.log(`🏠 Auto-joined ${socket.username} to rooms: [${defaultRooms.join(', ')}]`);
    }

    joinDeviceRoom(socket, deviceId) {
        if (!deviceId) {
            socket.emit('room_error', { error: 'Device ID is required' });
            return;
        }

        const roomName = `device:${deviceId}`;
        
        if (!this.canJoinRoom(socket, roomName)) {
            socket.emit('room_error', { error: 'Permission denied for this device room' });
            return;
        }

        socket.join(roomName);
        this.roomMemberships.get(socket.id).add(roomName);
        this.stats.roomJoins++;

        socket.emit('room_joined', {
            room: roomName,
            deviceId,
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} joined device room: ${roomName}`);
    }

    leaveDeviceRoom(socket, deviceId) {
        const roomName = `device:${deviceId}`;
        
        socket.leave(roomName);
        this.roomMemberships.get(socket.id).delete(roomName);
        this.stats.roomLeaves++;

        socket.emit('room_left', {
            room: roomName,
            deviceId,
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} left device room: ${roomName}`);
    }

    joinMultipleRooms(socket, roomNames) {
        if (!Array.isArray(roomNames)) {
            socket.emit('room_error', { error: 'Room names must be an array' });
            return;
        }

        const joined = [];
        const failed = [];

        roomNames.forEach(roomName => {
            if (this.canJoinRoom(socket, roomName)) {
                socket.join(roomName);
                this.roomMemberships.get(socket.id).add(roomName);
                this.stats.roomJoins++;
                joined.push(roomName);
            } else {
                failed.push(roomName);
            }
        });

        socket.emit('rooms_joined', {
            joined,
            failed,
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} joined rooms: [${joined.join(', ')}]`);
        if (failed.length > 0) {
            console.log(`❌ ${socket.username} failed to join: [${failed.join(', ')}]`);
        }
    }

    leaveMultipleRooms(socket, roomNames) {
        if (!Array.isArray(roomNames)) {
            socket.emit('room_error', { error: 'Room names must be an array' });
            return;
        }

        roomNames.forEach(roomName => {
            socket.leave(roomName);
            this.roomMemberships.get(socket.id).delete(roomName);
            this.stats.roomLeaves++;
        });

        socket.emit('rooms_left', {
            rooms: roomNames,
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} left rooms: [${roomNames.join(', ')}]`);
    }

    canJoinRoom(socket, roomName) {
        // ✅ Basic permission check
        // Allow device rooms and general rooms for now
        if (roomName.startsWith('device:') || roomName === 'authenticated' || roomName === 'device:all') {
            return true;
        }

        // TODO: Add role-based room access control
        // if (roomName.startsWith('admin:') && !socket.isAdmin) return false;
        
        return false;
    }

    getAvailableRooms(socket) {
        // ✅ Return rooms that user can join
        const availableRooms = ['device:all'];
        
        if (socket.userId && !socket.userId.startsWith('anonymous')) {
            availableRooms.push('authenticated');
        }

        // TODO: Add dynamic device room list from database
        // TODO: Add role-based room suggestions

        return availableRooms;
    }

    getRoomStats() {
        return {
            totalRoomJoins: this.stats.roomJoins,
            totalRoomLeaves: this.stats.roomLeaves,
            activeRoomMemberships: Array.from(this.roomMemberships.values()).reduce((total, rooms) => total + rooms.size, 0)
        };
    }

    // ===== DEVICE-AWARE MQTT BROADCASTING =====

    // NEW: Broadcast to specific device room
    broadcastToDeviceRoom(deviceId, deviceName, data, metadata = {}) {
        if (!this.io) return;

        const payload = {
            deviceId,
            deviceName: deviceName || `Device-${deviceId}`,
            data,
            timestamp: new Date().toISOString(),
            source: 'mqtt',
            room: `device:${deviceId}`,
            ...metadata
        };

        // ✅ Targeted broadcast to specific device room
        this.io.to(`device:${deviceId}`).emit('mqtt_data', payload);
        
        // ✅ Also broadcast to 'device:all' room for users monitoring all devices
        payload.room = 'device:all';
        this.io.to('device:all').emit('mqtt_data', payload);
        
        this.stats.messagesEmitted += 2; // Count both broadcasts

        console.log(`📡 Device data broadcasted to rooms: device:${deviceId}, device:all`);
        
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`📤 Payload:`, payload);
        }
    }

    // ===== SIMPLIFIED MQTT BROADCASTING =====

    // Broadcast MQTT data to ALL connected clients
    broadcastMqttData(deviceId, deviceName, data, metadata = {}) {
        if (!this.io) return;

        const payload = {
            deviceId,
            deviceName: deviceName || `Device-${deviceId}`,
            data,
            timestamp: new Date().toISOString(),
            source: 'mqtt',
            ...metadata
        };

        // Emit to ALL clients
        this.io.emit('mqtt_data', payload);
        this.stats.messagesEmitted++;

        console.log(`📡 MQTT data broadcasted to ${this.stats.activeConnections} clients`);
        
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`📤 Payload:`, payload);
        }
    }

    // Get comprehensive stats including room info
    getStats() {
        return {
            activeConnections: this.stats.activeConnections,
            messagesEmitted: this.stats.messagesEmitted,
            roomsCreated: this.stats.roomsCreated,
            roomJoins: this.stats.roomJoins,
            roomLeaves: this.stats.roomLeaves,
            activeRoomMemberships: Array.from(this.roomMemberships.values()).reduce((total, rooms) => total + rooms.size, 0),
            uptime: Math.floor(process.uptime())
        };
    }

    // Test broadcast
    testBroadcast() {
        this.broadcastMqttData('test-device', 'Test Device', {
            voltage: Math.random() * 240 + 200,
            current: Math.random() * 5 + 1,
            temperature: Math.random() * 10 + 20,
            test: true
        });
    }
}

// Export singleton
const socketService = new SocketService();
export default socketService;