import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js'; // ✅ Static import

class SocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map(); // userId -> socket
        this.roomMemberships = new Map(); // socketId -> Set of rooms
        
        // ✅ NEW: Device metadata cache for security
        this.deviceMetadataCache = new Map(); // deviceId -> { orgId, deptId, name, timestamp }
        this.pendingCacheRequests = new Map(); // ✅ Track pending requests to prevent race conditions
        this.cacheExpiry = 300000; // 5 minutes
        this.prisma = prisma; // ✅ Store reference to avoid dynamic imports
        
        this.stats = {
            activeConnections: 0,
            messagesEmitted: 0,
            roomsCreated: 0,
            roomJoins: 0,
            roomLeaves: 0,
            cacheHits: 0,
            cacheMisses: 0,
            permissionDenials: 0
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
        this.setupCacheCleanup(); // ✅ Add cache cleanup
        console.log('🔗 Socket.IO server initialized successfully');
    }

    // ✅ NEW: Check if service is ready for broadcasting
    isReady() {
        return this.io !== null;
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
                    socket.orgId = decoded.orgId || null;
                    socket.departmentIds = decoded.departmentIds || [];
                    socket.roles = decoded.roles || [];
                    socket.isAdmin = decoded.roles?.includes('superadmin') || false;
                    
                    // ✅ NEW: Validate organization exists (security enhancement)
                    if (socket.orgId && !socket.isAdmin) {
                        const orgExists = await this.validateOrganization(socket.orgId);
                        if (!orgExists) {
                            console.warn(`⚠️ Invalid orgId ${socket.orgId} for user ${socket.username}`);
                            socket.orgId = null; // Reset to prevent unauthorized access
                        }
                    }
                    
                    console.log(`✅ Authenticated: ${socket.username} (Org: ${socket.orgId}, Depts: ${socket.departmentIds.join(',')}, Admin: ${socket.isAdmin})`);
                } else {
                    // Allow anonymous connections for MQTT data streaming
                    socket.userId = `anonymous-${Date.now()}`;
                    socket.username = 'Anonymous';
                    console.log(`� Anonymous connection allowed`);
                }
                
                next();
            } catch (error) {
                // Still allow connection for MQTT data (with limited permissions)
                socket.userId = `anonymous-${Date.now()}`;
                socket.username = 'Anonymous';
                socket.orgId = null;
                socket.departmentIds = [];
                socket.roles = [];
                socket.isAdmin = false;
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

            // ✅ Auto-join default rooms based on user type (async)
            this.autoJoinDefaultRooms(socket).catch(error => {
                console.error(`❌ Error auto-joining rooms for ${socket.username}:`, error);
            });

            // Send connection confirmation with room info
            socket.emit('connected', {
                message: 'Connected to IoMT MQTT Stream',
                userId: socket.userId,
                username: socket.username,
                timestamp: new Date().toISOString(),
                availableRooms: this.getAvailableRooms(socket),
                joinedRooms: Array.from(this.roomMemberships.get(socket.id) || [])
            });

            // ✅ Handle device room operations (async)
            socket.on('join_device_room', (deviceId) => {
                this.joinDeviceRoom(socket, deviceId).catch(error => {
                    console.error(`❌ Error joining device room:`, error);
                    socket.emit('room_error', { error: 'Internal server error' });
                });
            });

            socket.on('leave_device_room', (deviceId) => {
                this.leaveDeviceRoom(socket, deviceId);
            });

            // ✅ NEW: Handle hierarchy room operations
            socket.on('join_org_room', (orgId) => {
                this.joinOrganizationRoom(socket, orgId);
            });

            socket.on('join_dept_room', (deptId) => {
                this.joinDepartmentRoom(socket, deptId);
            });

            socket.on('leave_org_room', (orgId) => {
                this.leaveOrganizationRoom(socket, orgId);
            });

            socket.on('leave_dept_room', (deptId) => {
                this.leaveDepartmentRoom(socket, deptId);
            });

            // ✅ Handle bulk room operations (async)
            socket.on('join_rooms', (roomNames) => {
                this.joinMultipleRooms(socket, roomNames).catch(error => {
                    console.error(`❌ Error joining multiple rooms:`, error);
                    socket.emit('room_error', { error: 'Internal server error' });
                });
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

            // Handle disconnect with proper cleanup
            socket.on('disconnect', (reason) => {
                // ✅ Get rooms before cleanup
                const userRooms = Array.from(this.roomMemberships.get(socket.id) || []);
                
                // ✅ Explicitly leave all rooms (Socket.IO will handle this automatically, but be explicit)
                userRooms.forEach(room => {
                    socket.leave(room);
                });
                
                // ✅ Cleanup tracking
                this.connectedClients.delete(socket.userId);
                this.roomMemberships.delete(socket.id);
                this.stats.activeConnections--;
                
                console.log(`🔌 Client disconnected: ${socket.username} - ${reason}`);
                console.log(`   Left rooms: [${userRooms.join(', ')}]`);
                console.log(`   Remaining connections: ${this.stats.activeConnections}`);
            });

            // Simple ping/pong
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: new Date().toISOString() });
            });
        });
    }

    // ===== DEVICE ROOM MANAGEMENT =====

    async autoJoinDefaultRooms(socket) {
        const defaultRooms = [];
        
        // ✅ Anonymous users: limited access
        if (socket.userId.startsWith('anonymous')) {
            // Anonymous can only join global monitoring (no sensitive data)
            defaultRooms.push('public:monitoring');
        } else {
            // ✅ Authenticated users: hierarchy-based auto-join
            defaultRooms.push('authenticated');
            
            // Auto-join organization room
            if (socket.orgId) {
                const orgRoom = `org:${socket.orgId}`;
                defaultRooms.push(orgRoom);
            }
            
            // Auto-join department rooms
            socket.departmentIds.forEach(deptId => {
                const deptRoom = `dept:${deptId}`;
                defaultRooms.push(deptRoom);
            });
            
            // Admins get access to admin system room
            if (socket.isAdmin) {
                defaultRooms.push('admin:system');
            }
        }

        // ✅ Sequential join with async checks
        const joinedRooms = [];
        for (const room of defaultRooms) {
            try {
                const canJoin = await this.canJoinRoom(socket, room);
                if (canJoin) {
                    socket.join(room);
                    this.roomMemberships.get(socket.id).add(room);
                    this.stats.roomJoins++;
                    joinedRooms.push(room);
                }
            } catch (error) {
                console.error(`❌ Error joining room ${room}:`, error);
            }
        }

        console.log(`🏠 Auto-joined ${socket.username} to rooms: [${joinedRooms.join(', ')}]`);
    }

    async joinDeviceRoom(socket, deviceId) {
        if (!deviceId) {
            socket.emit('room_error', { error: 'Device ID is required' });
            return;
        }

        const roomName = `device:${deviceId}`;
        
        // ✅ Async permission check with detailed logging
        const canJoin = await this.canAccessDevice(socket, deviceId);
        if (!canJoin) {
            socket.emit('room_error', { 
                error: 'Permission denied for this device room',
                deviceId,
                reason: 'Not authorized to access this device'
            });
            console.log(`❌ ${socket.username} DENIED access to device room ${roomName}`);
            return;
        }

        // ✅ Only join if permission granted
        socket.join(roomName);
        
        // ✅ Only track if join succeeded (verify socket.rooms)
        if (socket.rooms.has(roomName)) {
            this.roomMemberships.get(socket.id).add(roomName);
            this.stats.roomJoins++;

            socket.emit('room_joined', {
                room: roomName,
                deviceId,
                timestamp: new Date().toISOString()
            });

            console.log(`🏠 ${socket.username} GRANTED access to device room: ${roomName}`);
        } else {
            socket.emit('room_error', { 
                error: 'Failed to join device room',
                deviceId,
                reason: 'Internal server error during room join'
            });
            console.error(`❌ Socket join failed for ${socket.username} → ${roomName}`);
        }
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

    // ✅ FIXED: Organization room management (synchronous)
    joinOrganizationRoom(socket, orgId) {
        if (!orgId) {
            socket.emit('room_error', { error: 'Organization ID is required' });
            return;
        }

        const roomName = `org:${orgId}`;
        
        // ✅ Synchronous check for org rooms (no DB needed)
        if (socket.orgId !== orgId && !socket.isAdmin) {
            socket.emit('room_error', { 
                error: 'Permission denied for this organization room',
                reason: 'You do not belong to this organization'
            });
            this.stats.permissionDenials++;
            return;
        }

        socket.join(roomName);
        this.roomMemberships.get(socket.id).add(roomName);
        this.stats.roomJoins++;

        socket.emit('room_joined', {
            room: roomName,
            orgId,
            type: 'organization',
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} joined organization room: ${roomName}`);
    }

    leaveOrganizationRoom(socket, orgId) {
        const roomName = `org:${orgId}`;
        
        socket.leave(roomName);
        this.roomMemberships.get(socket.id).delete(roomName);
        this.stats.roomLeaves++;

        socket.emit('room_left', {
            room: roomName,
            orgId,
            type: 'organization',
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} left organization room: ${roomName}`);
    }

    // ✅ FIXED: Department room management (synchronous)
    joinDepartmentRoom(socket, deptId) {
        if (!deptId) {
            socket.emit('room_error', { error: 'Department ID is required' });
            return;
        }

        const roomName = `dept:${deptId}`;
        
        // ✅ Synchronous check for dept rooms (no DB needed)
        if (!socket.departmentIds.includes(deptId) && !socket.isAdmin) {
            socket.emit('room_error', { 
                error: 'Permission denied for this department room',
                reason: 'You do not belong to this department'
            });
            this.stats.permissionDenials++;
            return;
        }

        socket.join(roomName);
        this.roomMemberships.get(socket.id).add(roomName);
        this.stats.roomJoins++;

        socket.emit('room_joined', {
            room: roomName,
            deptId,
            type: 'department',
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} joined department room: ${roomName}`);
    }

    leaveDepartmentRoom(socket, deptId) {
        const roomName = `dept:${deptId}`;
        
        socket.leave(roomName);
        this.roomMemberships.get(socket.id).delete(roomName);
        this.stats.roomLeaves++;

        socket.emit('room_left', {
            room: roomName,
            deptId,
            type: 'department',
            timestamp: new Date().toISOString()
        });

        console.log(`🏠 ${socket.username} left department room: ${roomName}`);
    }

    async joinMultipleRooms(socket, roomNames) {
        if (!Array.isArray(roomNames)) {
            socket.emit('room_error', { error: 'Room names must be an array' });
            return;
        }

        const joined = [];
        const failed = [];

        // ✅ Sequential processing with async checks
        for (const roomName of roomNames) {
            try {
                const canJoin = await this.canJoinRoom(socket, roomName);
                if (canJoin) {
                    socket.join(roomName);
                    this.roomMemberships.get(socket.id).add(roomName);
                    this.stats.roomJoins++;
                    joined.push(roomName);
                } else {
                    failed.push(roomName);
                }
            } catch (error) {
                console.error(`❌ Error checking permission for room ${roomName}:`, error);
                failed.push(roomName);
            }
        }

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

    // ✅ FIXED: Handle both sync and async room permission checks
    async canJoinRoom(socket, roomName) {
        // ✅ Public rooms: anyone can join
        if (roomName === 'public:monitoring') {
            return true;
        }

        // ✅ Authenticated-only rooms
        if (roomName === 'authenticated') {
            return socket.userId && !socket.userId.startsWith('anonymous');
        }

        // ✅ Organization rooms: sync check (no DB needed)
        if (roomName.startsWith('org:')) {
            const orgId = roomName.split(':')[1];
            return socket.orgId === orgId || socket.isAdmin;
        }

        // ✅ Department rooms: sync check (no DB needed)  
        if (roomName.startsWith('dept:')) {
            const deptId = roomName.split(':')[1];
            return socket.departmentIds.includes(deptId) || socket.isAdmin;
        }

        // ✅ Device rooms: async check (requires DB lookup)
        if (roomName.startsWith('device:')) {
            const deviceId = roomName.split(':')[1];
            return await this.canAccessDevice(socket, deviceId);
        }

        // ✅ Admin-only rooms: sync check
        if (roomName.startsWith('admin:')) {
            return socket.isAdmin;
        }

        // ✅ Legacy: device:all for admins only
        if (roomName === 'device:all') {
            return socket.isAdmin;
        }

        return false;
    }

    // ✅ FIXED: Real device permission check with DB integration
    async canAccessDevice(socket, deviceId) {
        // ✅ Admin bypass
        if (socket.isAdmin) return true;
        
        // ✅ Anonymous blocked immediately
        if (!socket.orgId || socket.userId.startsWith('anonymous')) {
            console.log(`❌ Anonymous/no-org user ${socket.username} blocked from device ${deviceId}`);
            this.stats.permissionDenials++;
            return false;
        }
        
        try {
            // ✅ Get device metadata (with cache)
            const deviceMeta = await this.getDeviceMetadata(deviceId);
            
            if (!deviceMeta) {
                console.log(`❌ Device ${deviceId} not found or inactive`);
                this.stats.permissionDenials++;
                return false;
            }
            
            // ✅ CRITICAL: Check organization match
            if (socket.orgId !== deviceMeta.orgId) {
                console.log(`❌ SECURITY: User org ${socket.orgId} ≠ device org ${deviceMeta.orgId} for device ${deviceId}`);
                this.stats.permissionDenials++;
                return false;
            }
            
            // ✅ Check department match (if device has department)
            if (deviceMeta.deptId && !socket.departmentIds.includes(deviceMeta.deptId)) {
                console.log(`❌ User depts [${socket.departmentIds.join(',')}] don't include device dept ${deviceMeta.deptId}`);
                this.stats.permissionDenials++;
                return false;
            }
            
            console.log(`✅ User ${socket.username} CAN access device ${deviceId} (org: ${deviceMeta.orgId}, dept: ${deviceMeta.deptId})`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error checking device permissions:`, error);
            this.stats.permissionDenials++;
            return false; // ✅ Fail securely
        }
    }

    getAvailableRooms(socket) {
        const availableRooms = [];
        
        // ✅ Public rooms for everyone
        availableRooms.push('public:monitoring');
        
        if (socket.userId && !socket.userId.startsWith('anonymous')) {
            availableRooms.push('authenticated');
            
            // ✅ Organization rooms
            if (socket.orgId) {
                availableRooms.push(`org:${socket.orgId}`);
            }
            
            // ✅ Department rooms
            socket.departmentIds.forEach(deptId => {
                availableRooms.push(`dept:${deptId}`);
            });
            
            // ✅ Admin rooms
            if (socket.isAdmin) {
                availableRooms.push('device:all');
                availableRooms.push('admin:system');
            }
        }

        return {
            rooms: availableRooms,
            hierarchy: {
                organization: socket.orgId,
                departments: socket.departmentIds,
                isAdmin: socket.isAdmin
            }
        };
    }

    // ✅ NEW: Get device metadata with caching
    async getDeviceMetadata(deviceId) {
        // ✅ Check cache first
        const cached = this.deviceMetadataCache.get(deviceId);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            this.stats.cacheHits++;
            return cached.data;
        }
        
        this.stats.cacheMisses++;
        
        // ✅ Check if request is already pending (prevent race conditions)
        if (this.pendingCacheRequests.has(deviceId)) {
            console.log(`⏳ Waiting for pending cache request for ${deviceId}`);
            return await this.pendingCacheRequests.get(deviceId);
        }
        
        // ✅ Create and store promise
        const fetchPromise = this.fetchDeviceMetadataFromDB(deviceId);
        this.pendingCacheRequests.set(deviceId, fetchPromise);
        
        try {
            const metadata = await fetchPromise;
            return metadata;
        } finally {
            // ✅ Cleanup pending request
            this.pendingCacheRequests.delete(deviceId);
        }
    }

    // ✅ NEW: Separate DB fetch method with direct Prisma usage
    async fetchDeviceMetadataFromDB(deviceId) {
        try {
            const device = await this.prisma.$queryRaw`
                SELECT 
                    d.id,
                    d.serial_number as name,
                    d.organization_id as org_id,
                    d.department_id as dept_id,
                    o.name as org_name,
                    dep.name as dept_name
                FROM device d
                LEFT JOIN organizations o ON d.organization_id = o.id
                LEFT JOIN departments dep ON d.department_id = dep.id
                WHERE d.id = ${deviceId}::uuid
                AND d.status = 'active'::device_status
                LIMIT 1
            `;
            
            if (device.length === 0) {
                // ✅ Cache null result to avoid repeated queries
                this.deviceMetadataCache.set(deviceId, {
                    data: null,
                    timestamp: Date.now()
                });
                return null;
            }
            
            const metadata = {
                deviceId: device[0].id,
                name: device[0].name,
                orgId: device[0].org_id,
                deptId: device[0].dept_id,
                orgName: device[0].org_name,
                deptName: device[0].dept_name
            };
            
            // ✅ Cache result
            this.deviceMetadataCache.set(deviceId, {
                data: metadata,
                timestamp: Date.now()
            });
            
            console.log(`� Cached device metadata for ${deviceId}: Org=${metadata.orgId}, Dept=${metadata.deptId}`);
            return metadata;
            
        } catch (error) {
            console.error(`❌ Error fetching device metadata for ${deviceId}:`, error);
            return null;
        }
    }

    // ✅ NEW: Validate organization exists in database
    async validateOrganization(orgId) {
        try {
            const org = await this.prisma.$queryRaw`
                SELECT id FROM organizations 
                WHERE id = ${orgId}::uuid
                LIMIT 1
            `;
            return org.length > 0;
        } catch (error) {
            console.error(`❌ Error validating organization ${orgId}:`, error);
            return false;
        }
    }

    // ✅ NEW: Invalidate cache when device is updated
    invalidateDeviceCache(deviceId) {
        const deleted = this.deviceMetadataCache.delete(deviceId);
        if (deleted) {
            console.log(`🗑️ Cleared cache for device ${deviceId}`);
        }
    }

    // ✅ ENHANCED: Clear expired cache entries and pending requests
    setupCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let clearedCache = 0;
            let clearedPending = 0;
            
            // ✅ Clean expired device metadata cache
            for (const [deviceId, cached] of this.deviceMetadataCache.entries()) {
                if (now - cached.timestamp > this.cacheExpiry) {
                    this.deviceMetadataCache.delete(deviceId);
                    clearedCache++;
                }
            }
            
            // ✅ Clean old pending requests (prevent memory leaks)
            for (const [deviceId, promise] of this.pendingCacheRequests.entries()) {
                // If promise has been pending for more than 30 seconds, remove it
                if (promise._startTime && now - promise._startTime > 30000) {
                    this.pendingCacheRequests.delete(deviceId);
                    clearedPending++;
                }
            }
            
            if (clearedCache > 0 || clearedPending > 0) {
                console.log(`🧹 Cache cleanup: ${clearedCache} expired entries, ${clearedPending} old pending requests`);
            }
        }, 60000); // Every minute
    }

    getRoomStats() {
        return {
            totalRoomJoins: this.stats.roomJoins,
            totalRoomLeaves: this.stats.roomLeaves,
            activeRoomMemberships: Array.from(this.roomMemberships.values()).reduce((total, rooms) => total + rooms.size, 0)
        };
    }

    // ===== DEVICE-AWARE MQTT BROADCASTING =====

    // ✅ OPTIMIZED: Broadcast to hierarchy rooms with memory efficiency
    async broadcastToDeviceRoom(deviceId, deviceName, data, metadata = {}) {
        if (!this.io) return 0;

        try {
            // ✅ Get device metadata for hierarchy broadcasting
            const deviceMeta = await this.getDeviceMetadata(deviceId);

            // ✅ Single base payload (frozen to prevent accidental mutation)
            const basePayload = Object.freeze({
                deviceId,
                deviceName: deviceName || `Device-${deviceId}`,
                data,
                timestamp: new Date().toISOString(),
                source: 'mqtt',
                ...metadata
            });

            // ✅ Hierarchy info (reused across all broadcasts)
            const hierarchy = deviceMeta ? {
                orgId: deviceMeta.orgId,
                deptId: deviceMeta.deptId,
                orgName: deviceMeta.orgName,
                deptName: deviceMeta.deptName
            } : null;

            // ✅ Plan all broadcasts (no duplicate payload creation)
            const broadcasts = [];
            let broadcastCount = 0;

            // ✅ 1. Device room (always)
            const deviceRoom = `device:${deviceId}`;
            broadcasts.push({
                room: deviceRoom,
                event: 'mqtt_data',
                payload: { ...basePayload, room: deviceRoom, hierarchy }
            });

            // ✅ 2. Department room (if exists)
            if (deviceMeta?.deptId) {
                const deptRoom = `dept:${deviceMeta.deptId}`;
                broadcasts.push({
                    room: deptRoom,
                    event: 'dept_device_data',
                    payload: { ...basePayload, room: deptRoom, hierarchy }
                });
            }

            // ✅ 3. Organization room (if exists)
            if (deviceMeta?.orgId) {
                const orgRoom = `org:${deviceMeta.orgId}`;
                broadcasts.push({
                    room: orgRoom,
                    event: 'org_device_data',
                    payload: { ...basePayload, room: orgRoom, hierarchy }
                });
            }

            // ✅ 4. Admin room (always for system monitoring)
            broadcasts.push({
                room: 'admin:system',
                event: 'admin_device_data',
                payload: { ...basePayload, room: 'admin:system', hierarchy }
            });

            // ✅ Batch emit all broadcasts
            for (const { room, event, payload } of broadcasts) {
                this.io.to(room).emit(event, payload);
                broadcastCount++;
            }

            this.stats.messagesEmitted += broadcastCount;

            console.log(`📡 Device ${deviceId} → ${broadcastCount} rooms: [${broadcasts.map(b => b.room).join(', ')}]`);
            
            if (process.env.DEBUG_MQTT === 'true') {
                console.log(`📤 Hierarchy:`, hierarchy);
            }

            // ✅ Warning if no device metadata found
            if (!deviceMeta) {
                console.warn(`⚠️ Device ${deviceId} has no metadata - broadcasting to device room and admin only`);
            }

            return broadcastCount;

        } catch (error) {
            console.error(`❌ Error broadcasting device data for ${deviceId}:`, error);
            // ✅ Fallback: broadcast to device room only
            try {
                this.io.to(`device:${deviceId}`).emit('mqtt_data', {
                    deviceId,
                    deviceName: deviceName || `Device-${deviceId}`,
                    data,
                    timestamp: new Date().toISOString(),
                    source: 'mqtt_fallback',
                    room: `device:${deviceId}`,
                    error: 'Partial broadcast due to error',
                    ...metadata
                });
                this.stats.messagesEmitted++;
                return 1;
            } catch (fallbackError) {
                console.error(`❌ Fallback broadcast also failed:`, fallbackError);
                return 0;
            }
        }
    }

    // ✅ NEW: Hierarchy-aware broadcasting
    broadcastToHierarchy(deviceData, deviceMetadata = {}) {
        if (!this.io) return;

        const { deviceId, orgId, deptId } = deviceMetadata;
        
        const payload = {
            ...deviceData,
            timestamp: new Date().toISOString(),
            source: 'mqtt_hierarchy'
        };

        let broadcastCount = 0;

        // ✅ Broadcast to specific device room (most targeted)
        if (deviceId) {
            payload.room = `device:${deviceId}`;
            this.io.to(`device:${deviceId}`).emit('mqtt_data', payload);
            broadcastCount++;
        }

        // ✅ Broadcast to department room (department overview)
        if (deptId) {
            payload.room = `dept:${deptId}`;
            this.io.to(`dept:${deptId}`).emit('dept_data', payload);
            broadcastCount++;
        }

        // ✅ Broadcast to organization room (org-wide alerts)
        if (orgId) {
            payload.room = `org:${orgId}`;
            this.io.to(`org:${orgId}`).emit('org_data', payload);
            broadcastCount++;
        }

        // ✅ Broadcast to admin room (system monitoring)
        payload.room = 'admin:system';
        this.io.to('admin:system').emit('admin_data', payload);
        broadcastCount++;

        this.stats.messagesEmitted += broadcastCount;
        
        console.log(`📡 Hierarchy broadcast sent to ${broadcastCount} room levels`);
        return broadcastCount;
    }

    // ✅ NEW: Organization-wide notifications
    broadcastToOrganization(orgId, message, type = 'notification') {
        if (!this.io || !orgId) return;

        const payload = {
            type,
            message,
            orgId,
            timestamp: new Date().toISOString(),
            source: 'organization'
        };

        this.io.to(`org:${orgId}`).emit('org_notification', payload);
        this.stats.messagesEmitted++;

        console.log(`📡 Organization broadcast to org:${orgId}: ${message}`);
    }

    // ✅ NEW: Department-wide notifications  
    broadcastToDepartment(deptId, message, type = 'notification') {
        if (!this.io || !deptId) return;

        const payload = {
            type,
            message,
            deptId,
            timestamp: new Date().toISOString(),
            source: 'department'
        };

        this.io.to(`dept:${deptId}`).emit('dept_notification', payload);
        this.stats.messagesEmitted++;

        console.log(`📡 Department broadcast to dept:${deptId}: ${message}`);
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

    // Get comprehensive stats including security metrics
    getStats() {
        return {
            activeConnections: this.stats.activeConnections,
            messagesEmitted: this.stats.messagesEmitted,
            roomsCreated: this.stats.roomsCreated,
            roomJoins: this.stats.roomJoins,
            roomLeaves: this.stats.roomLeaves,
            activeRoomMemberships: Array.from(this.roomMemberships.values()).reduce((total, rooms) => total + rooms.size, 0),
            // ✅ NEW: Security & Performance metrics
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            permissionDenials: this.stats.permissionDenials,
            cacheSize: this.deviceMetadataCache.size,
            cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 
                ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%'
                : 'N/A',
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