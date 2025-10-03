import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

class SocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map(); // userId -> socket
        this.stats = {
            activeConnections: 0,
            messagesEmitted: 0
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
            this.stats.activeConnections++;

            console.log(`� Client connected: ${socket.username} (Total: ${this.stats.activeConnections})`);

            // Send connection confirmation
            socket.emit('connected', {
                message: 'Connected to IoMT MQTT Stream',
                userId: socket.userId,
                username: socket.username,
                timestamp: new Date().toISOString()
            });

            // Handle disconnect
            socket.on('disconnect', (reason) => {
                this.connectedClients.delete(socket.userId);
                this.stats.activeConnections--;
                console.log(`🔌 Client disconnected: ${socket.username} - ${reason} (Remaining: ${this.stats.activeConnections})`);
            });

            // Simple ping/pong
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: new Date().toISOString() });
            });
        });
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

    // Get simple stats
    getStats() {
        return {
            activeConnections: this.stats.activeConnections,
            messagesEmitted: this.stats.messagesEmitted,
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