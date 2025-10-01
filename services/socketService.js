import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

class SocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map(); // userId -> socket
        this.deviceSubscriptions = new Map(); // deviceId -> Set of socketIds
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesEmitted: 0,
            deviceSubscriptions: 0
        };
    }

    initialize(server) {
        if (this.io) {
            console.log('⚠️ Socket.IO already initialized, skipping...');
            return;
        }

        if (!server) {
            throw new Error('Server instance is required');
        }

        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET environment variable is not set');
            throw new Error('JWT_SECRET is required for Socket.IO authentication');
        }

        try {
            this.io = new Server(server, {
                cors: {
                    origin: "*", // Configure this based on your frontend domain
                    methods: ["GET", "POST"],
                    credentials: true
                },
                pingTimeout: 60000,
                pingInterval: 25000
            });

            // Add connection error handler
            this.io.engine.on("connection_error", (err) => {
                console.log('❌ Socket.IO connection error:', err.req?.url);
                console.log('❌ Error code:', err.code);
                console.log('❌ Error message:', err.message);
            });

            this.setupMiddleware();
            this.setupEventHandlers();
            console.log('🔗 Socket.IO server initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Socket.IO server:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                // Support multiple token sources for Socket.IO
                let token = null;
                
                // 1. From Socket.IO auth handshake
                if (socket.handshake.auth.token) {
                    token = socket.handshake.auth.token;
                }
                // 2. From Authorization header
                else if (socket.handshake.headers.authorization?.startsWith('Bearer ')) {
                    token = socket.handshake.headers.authorization.substring(7);
                }
                // 3. From cookies (if passed via headers)
                else if (socket.handshake.headers.cookie) {
                    const cookies = socket.handshake.headers.cookie
                        .split(';')
                        .map(c => c.trim().split('='))
                        .reduce((acc, [key, value]) => {
                            acc[key] = value;
                            return acc;
                        }, {});
                    
                    token = cookies.access_token;
                }
                
                if (!token) {
                    console.log('❌ Socket connection rejected: No token provided');
                    return next(new Error('Authentication required - provide token via auth.token or Authorization header'));
                }

                // Remove 'Bearer ' prefix if present
                const cleanToken = token.replace('Bearer ', '');
                
                // Verify JWT token
                const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
                socket.userId = decoded.userId || decoded.id;
                socket.username = decoded.username;
                socket.organizationId = decoded.organization_id;
                socket.departmentId = decoded.department_id;
                
                console.log(`✅ Socket authenticated: ${socket.username} (${socket.userId})`);
                next();
            } catch (error) {
                console.log('❌ Socket authentication failed:', error.message);
                next(new Error('Invalid token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }

    handleConnection(socket) {
        const { userId, username, organizationId } = socket;
        
        // Store connected client
        this.connectedClients.set(userId, socket);
        this.stats.totalConnections++;
        this.stats.activeConnections++;

        console.log(`🔌 Client connected: ${username} (Active: ${this.stats.activeConnections})`);

        // Send connection confirmation
        socket.emit('connected', {
            message: 'Connected to IoMT real-time server',
            userId,
            username,
            timestamp: new Date().toISOString(),
            serverStats: this.getPublicStats()
        });

        // Handle device subscription
        socket.on('subscribe_device', (data) => {
            this.handleDeviceSubscription(socket, data);
        });

        // Handle device unsubscription
        socket.on('unsubscribe_device', (data) => {
            this.handleDeviceUnsubscription(socket, data);
        });

        // Handle get device data request
        socket.on('get_device_data', (data) => {
            this.handleGetDeviceData(socket, data);
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            this.handleDisconnection(socket, reason);
        });

        // Handle custom events
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        socket.on('get_stats', () => {
            socket.emit('stats', this.getPublicStats());
        });
    }

    handleDeviceSubscription(socket, data) {
        try {
            const { deviceId, deviceType } = data;
            
            if (!deviceId) {
                socket.emit('error', { message: 'Device ID is required for subscription' });
                return;
            }

            // Add to device subscriptions
            if (!this.deviceSubscriptions.has(deviceId)) {
                this.deviceSubscriptions.set(deviceId, new Set());
            }
            this.deviceSubscriptions.get(deviceId).add(socket.id);
            
            // Add to socket's subscribed devices
            if (!socket.subscribedDevices) {
                socket.subscribedDevices = new Set();
            }
            socket.subscribedDevices.add(deviceId);

            this.stats.deviceSubscriptions++;

            console.log(`📡 ${socket.username} subscribed to device: ${deviceId}`);
            
            socket.emit('device_subscribed', {
                deviceId,
                deviceType,
                message: `Subscribed to device ${deviceId}`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error handling device subscription:', error);
            socket.emit('error', { message: 'Failed to subscribe to device' });
        }
    }

    handleDeviceUnsubscription(socket, data) {
        try {
            const { deviceId } = data;
            
            if (this.deviceSubscriptions.has(deviceId)) {
                this.deviceSubscriptions.get(deviceId).delete(socket.id);
                
                // Remove empty sets
                if (this.deviceSubscriptions.get(deviceId).size === 0) {
                    this.deviceSubscriptions.delete(deviceId);
                }
            }

            if (socket.subscribedDevices) {
                socket.subscribedDevices.delete(deviceId);
            }

            this.stats.deviceSubscriptions--;

            console.log(`📡 ${socket.username} unsubscribed from device: ${deviceId}`);
            
            socket.emit('device_unsubscribed', {
                deviceId,
                message: `Unsubscribed from device ${deviceId}`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error handling device unsubscription:', error);
            socket.emit('error', { message: 'Failed to unsubscribe from device' });
        }
    }

    async handleGetDeviceData(socket, data) {
        try {
            const { deviceId, limit = 10 } = data;
            
            // This would integrate with your existing device data API
            // For now, emit a placeholder response
            socket.emit('device_data', {
                deviceId,
                data: [],
                timestamp: new Date().toISOString(),
                message: 'Device data retrieval not implemented yet'
            });

        } catch (error) {
            console.error('Error getting device data:', error);
            socket.emit('error', { message: 'Failed to get device data' });
        }
    }

    handleDisconnection(socket, reason) {
        const { userId, username } = socket;

        // Remove from connected clients
        this.connectedClients.delete(userId);
        this.stats.activeConnections--;

        // Clean up device subscriptions
        if (socket.subscribedDevices) {
            socket.subscribedDevices.forEach(deviceId => {
                if (this.deviceSubscriptions.has(deviceId)) {
                    this.deviceSubscriptions.get(deviceId).delete(socket.id);
                    
                    if (this.deviceSubscriptions.get(deviceId).size === 0) {
                        this.deviceSubscriptions.delete(deviceId);
                    }
                }
            });
        }

        console.log(`🔌 Client disconnected: ${username} - ${reason} (Active: ${this.stats.activeConnections})`);
    }

    // ===== MQTT INTEGRATION METHODS =====

    broadcastDeviceData(deviceId, data, metadata = {}) {
        const subscribedSockets = this.deviceSubscriptions.get(deviceId);
        
        if (!subscribedSockets || subscribedSockets.size === 0) {
            return; // No subscribers for this device
        }

        const payload = {
            deviceId,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                source: 'mqtt',
                topic: metadata.topic || 'unknown',
                ...metadata
            }
        };

        let broadcastCount = 0;
        subscribedSockets.forEach(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('device_data_update', payload);
                broadcastCount++;
            }
        });

        if (broadcastCount > 0) {
            this.stats.messagesEmitted++;
            console.log(`📡 Broadcasted data for device ${deviceId} to ${broadcastCount} clients`);
        }
    }

    broadcastSystemAlert(alertType, message, data = {}) {
        this.io.emit('system_alert', {
            type: alertType,
            message,
            data,
            timestamp: new Date().toISOString()
        });

        this.stats.messagesEmitted++;
        console.log(`🚨 System alert broadcasted: ${alertType} - ${message}`);
    }

    // Send to specific user
    sendToUser(userId, event, data) {
        const socket = this.connectedClients.get(userId);
        if (socket) {
            socket.emit(event, data);
            this.stats.messagesEmitted++;
            return true;
        }
        return false;
    }

    // Send to users in same organization
    sendToOrganization(organizationId, event, data) {
        let sentCount = 0;
        this.connectedClients.forEach(socket => {
            if (socket.organizationId === organizationId) {
                socket.emit(event, data);
                sentCount++;
            }
        });
        
        if (sentCount > 0) {
            this.stats.messagesEmitted += sentCount;
        }
        
        return sentCount;
    }

    // ===== UTILITY METHODS =====

    getPublicStats() {
        return {
            activeConnections: this.stats.activeConnections,
            deviceSubscriptions: this.deviceSubscriptions.size,
            totalMessagesEmitted: this.stats.messagesEmitted,
            uptime: process.uptime()
        };
    }

    getDetailedStats() {
        return {
            ...this.stats,
            connectedUsers: Array.from(this.connectedClients.values()).map(socket => ({
                userId: socket.userId,
                username: socket.username,
                organizationId: socket.organizationId,
                subscribedDevices: socket.subscribedDevices ? Array.from(socket.subscribedDevices) : []
            })),
            deviceSubscriptionDetails: Object.fromEntries(
                Array.from(this.deviceSubscriptions.entries()).map(([deviceId, sockets]) => [
                    deviceId,
                    sockets.size
                ])
            )
        };
    }

    // Test method for development
    simulateDeviceData(deviceId, sampleData) {
        this.broadcastDeviceData(deviceId, sampleData, {
            source: 'simulation',
            topic: 'test/simulation'
        });
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;