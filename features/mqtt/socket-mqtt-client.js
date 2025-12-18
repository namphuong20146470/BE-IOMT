// features/mqtt/socket-mqtt-client.js
import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

/**
 * Parse MQTT timestamp to valid Date object
 * ✅ IMPORTANT: This preserves the MQTT device's timestamp as-is
 * - Does NOT convert timezone
 * - Returns whatever timestamp the device sends
 * Format: "HH:mm:ss DD/MM/YYYY" (e.g., "16:38:46 17/12/2025")
 */
function parseMqttTimestamp(timestampStr) {
    if (!timestampStr) return new Date();  // Fallback to current time
    
    try {
        // Expected format: "HH:mm:ss DD/MM/YYYY"
        const match = timestampStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
        
        if (match) {
            const [, hours, minutes, seconds, day, month, year] = match;
            // JavaScript Date: months are 0-indexed
            // ✅ Parse as-is, no timezone conversion
            const date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            );
            
            // Validate the date is valid
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Fallback: try native Date parsing
        const date = new Date(timestampStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        // If all parsing fails, use current time
        console.warn(`⚠️  Invalid timestamp format: "${timestampStr}", using current time`);
        return new Date();
        
    } catch (error) {
        console.error(`❌ Error parsing timestamp "${timestampStr}":`, error.message);
        return new Date();
    }
}

/**
 * Socket-based MQTT Client Manager
 * Manages MQTT connections for devices via their assigned sockets
 */
class SocketMQTTClient extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map(); // socket_id -> mqtt_client
        this.connections = new Map(); // socket_id -> connection_info
        this.reconnectTimers = new Map();
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        
        // Add error handler to prevent unhandled errors from crashing server
        this.on('error', (errorInfo) => {
            console.error('🚨 Socket MQTT Client Error handled:', {
                socketId: errorInfo.socketId,
                error: errorInfo.error?.message || 'Unknown error',
                socket: errorInfo.socket?.socket_number || 'Unknown socket'
            });
            // Don't crash - just log and continue
        });
    }

    /**
     * Initialize MQTT connections for all active sockets
     */
    async initializeAll() {
        try {
            console.log('🔌 Initializing Socket MQTT connections...');
            
            const activeSockets = await prisma.sockets.findMany({
                where: {
                    AND: [
                        { mqtt_broker_host: { not: null } },
                        { is_enabled: true },
                        { device_id: { not: null } }
                    ]
                },
                include: {
                    pdu: true,
                    device: {
                        include: {
                            model: true
                        }
                    }
                }
            });

            console.log(`📡 Found ${activeSockets.length} active MQTT sockets`);

            for (const socket of activeSockets) {
                await this.connectSocket(socket);
            }

            console.log('✅ Socket MQTT initialization complete');
        } catch (error) {
            console.error('❌ Failed to initialize Socket MQTT:', error);
            throw error;
        }
    }

    /**
     * Connect to MQTT broker for a specific socket
     */
    async connectSocket(socketConfig) {
        const socketId = socketConfig.id;
        
        try {
            // Disconnect existing connection if any
            if (this.clients.has(socketId)) {
                await this.disconnectSocket(socketId);
            }

            const fullTopic = `${socketConfig.pdu.mqtt_base_topic}/${socketConfig.mqtt_topic_suffix}`;
            
            // Parse MQTT credentials
            const credentials = typeof socketConfig.mqtt_credentials === 'string' 
                ? JSON.parse(socketConfig.mqtt_credentials) 
                : socketConfig.mqtt_credentials || {};

            // Parse MQTT config
            const mqttConfig = typeof socketConfig.mqtt_config === 'string'
                ? JSON.parse(socketConfig.mqtt_config)
                : socketConfig.mqtt_config || {};

            // Build connection options
            const connectionOptions = {
                host: socketConfig.mqtt_broker_host,
                port: socketConfig.mqtt_broker_port || 1883,
                protocol: 'mqtt',
                keepalive: mqttConfig.keepalive || 60,
                clean: mqttConfig.clean_session !== false,
                qos: mqttConfig.qos || 0,
                retain: mqttConfig.retain || false,
                reconnectPeriod: this.reconnectInterval,
                ...credentials,
                clientId: `iomt_socket_${socketId}_${Date.now()}`
            };

            console.log(`🔌 Connecting socket ${socketConfig.socket_number} to MQTT:`, {
                host: connectionOptions.host,
                port: connectionOptions.port,
                topic: fullTopic,
                device: socketConfig.device?.serial_number
            });

            // Create MQTT client
            const client = mqtt.connect(connectionOptions);
            
            // Store connection info
            this.connections.set(socketId, {
                socket: socketConfig,
                topic: fullTopic,
                options: connectionOptions,
                status: 'connecting',
                reconnectAttempts: 0
            });

            // Set up event handlers
            this.setupEventHandlers(client, socketId);

            // Store client
            this.clients.set(socketId, client);

            return client;

        } catch (error) {
            console.error(`❌ Failed to connect socket ${socketId}:`, error);
            this.emit('error', { socketId, error });
            throw error;
        }
    }

    /**
     * Set up MQTT client event handlers
     */
    setupEventHandlers(client, socketId) {
        const connectionInfo = this.connections.get(socketId);
        const socket = connectionInfo.socket;
        
        client.on('connect', async () => {
            console.log(`✅ Socket ${socket.socket_number} connected to MQTT`);
            
            // Update connection status
            connectionInfo.status = 'connected';
            connectionInfo.reconnectAttempts = 0;
            
            // Clear reconnect timer if exists
            if (this.reconnectTimers.has(socketId)) {
                clearTimeout(this.reconnectTimers.get(socketId));
                this.reconnectTimers.delete(socketId);
            }

            // Subscribe to the socket's topic
            client.subscribe(connectionInfo.topic, { qos: connectionInfo.options.qos }, (err) => {
                if (err) {
                    console.error(`❌ Failed to subscribe to ${connectionInfo.topic}:`, err);
                } else {
                    console.log(`📡 Subscribed to topic: ${connectionInfo.topic}`);
                }
            });

            // Update socket status in database
            try {
                await prisma.sockets.update({
                    where: { id: socketId },
                    data: { 
                        status: 'active',
                        updated_at: new Date()
                    }
                });
            } catch (dbError) {
                console.error('Failed to update socket status:', dbError);
            }

            this.emit('connected', { socketId, socket });
        });

        client.on('message', async (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log(`📨 Socket ${socket.socket_number} received data:`, data);

                // ✅ FIX: Only store if device is assigned
                if (socket.device_id) {
                    // Store data in device_data_logs
                    await this.storeDeviceData(socketId, data);

                    // Update device current state
                    await this.updateDeviceCurrentState(socket.device_id, socketId, data);
                } else {
                    console.warn(`⚠️  Socket ${socket.socket_number} (${socket.name}) received data but NO DEVICE ASSIGNED - skipping storage`);
                    console.warn(`   Data received:`, JSON.stringify(data).substring(0, 100));
                }

                this.emit('data', { 
                    socketId, 
                    socket, 
                    topic, 
                    data,
                    timestamp: new Date()
                });

            } catch (error) {
                console.error(`❌ Failed to process message for socket ${socket.socket_number}:`, error);
                this.emit('error', { socketId, error, message: message.toString() });
            }
        });

        client.on('error', async (error) => {
            console.error(`❌ MQTT error for socket ${socket.socket_number}:`, error);
            
            connectionInfo.status = 'error';
            
            // Update socket status
            try {
                await prisma.sockets.update({
                    where: { id: socketId },
                    data: { status: 'error' }
                });
            } catch (dbError) {
                console.error('Failed to update socket status:', dbError);
            }

            this.emit('error', { socketId, socket, error });
        });

        client.on('close', async () => {
            console.log(`🔌 Socket ${socket.socket_number} disconnected from MQTT`);
            
            connectionInfo.status = 'disconnected';
            
            // Update socket status
            try {
                await prisma.sockets.update({
                    where: { id: socketId },
                    data: { status: 'inactive' }
                });
            } catch (dbError) {
                console.error('Failed to update socket status:', dbError);
            }

            this.emit('disconnected', { socketId, socket });

            // Schedule reconnection if not manually disconnected
            if (connectionInfo.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect(socketId);
            }
        });

        client.on('reconnect', () => {
            console.log(`🔄 Socket ${socket.socket_number} attempting to reconnect...`);
            connectionInfo.reconnectAttempts++;
            this.emit('reconnecting', { socketId, socket, attempts: connectionInfo.reconnectAttempts });
        });
    }

    /**
     * Schedule reconnection for a socket
     */
    scheduleReconnect(socketId) {
        const connectionInfo = this.connections.get(socketId);
        
        if (connectionInfo && connectionInfo.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectInterval * Math.pow(2, connectionInfo.reconnectAttempts);
            
            console.log(`⏰ Scheduling reconnect for socket ${connectionInfo.socket.socket_number} in ${delay}ms (attempt ${connectionInfo.reconnectAttempts + 1})`);
            
            const timer = setTimeout(() => {
                this.connectSocket(connectionInfo.socket);
            }, delay);
            
            this.reconnectTimers.set(socketId, timer);
        }
    }

    /**
     * Store device data history with DUPLICATE+UPDATE strategy (similar to mqtt.database.js)
     */
    async storeDeviceData(socketId, mqttData) {
        try {
            const socket = this.connections.get(socketId).socket;
            const deviceId = socket.device_id;
            
            // ✅ VALIDATION: Must have device assigned
            if (!deviceId) {
                console.warn(`⚠️  [Socket ${socket.socket_number}] Cannot store data - no device assigned`);
                return null;
            }
            
            console.log(`📝 [Device ${deviceId}] Storing history with DUPLICATE+UPDATE strategy`);
            
            // 1. Get latest device_data record for this device
            const latestRecord = await prisma.device_data.findFirst({
                where: { device_id: deviceId },
                orderBy: { created_at: 'desc' }
            });

            let completeData;
            
            if (latestRecord) {
                // 2. MERGE: Preserve existing values, update with MQTT data
                completeData = {
                    device_id: deviceId,
                    socket_id: socketId,
                    
                    // Measurement values - preserve old if MQTT doesn't provide new
                    voltage: mqttData.hasOwnProperty('voltage') ? mqttData.voltage : latestRecord.voltage,
                    current: mqttData.hasOwnProperty('current') ? mqttData.current : latestRecord.current,
                    power: mqttData.hasOwnProperty('power') ? mqttData.power : latestRecord.power,
                    frequency: mqttData.hasOwnProperty('frequency') ? mqttData.frequency : latestRecord.frequency,
                    power_factor: mqttData.hasOwnProperty('power_factor') ? mqttData.power_factor : latestRecord.power_factor,
                    
                    // State indicators - preserve old if MQTT doesn't provide new
                    machine_state: mqttData.hasOwnProperty('machine_state') ? mqttData.machine_state : latestRecord.machine_state,
                    socket_state: mqttData.hasOwnProperty('socket_state') ? mqttData.socket_state : latestRecord.socket_state,
                    sensor_state: mqttData.hasOwnProperty('sensor_state') ? mqttData.sensor_state : latestRecord.sensor_state,
                    
                    // Alert indicators - preserve old if MQTT doesn't provide new
                    over_voltage: mqttData.hasOwnProperty('over_voltage') ? mqttData.over_voltage : latestRecord.over_voltage,
                    under_voltage: mqttData.hasOwnProperty('under_voltage') ? mqttData.under_voltage : latestRecord.under_voltage,
                    
                    // Always update timestamps
                    timestamp: parseMqttTimestamp(mqttData.timestamp)
                    // Note: data_payload removed - not in device_data schema, raw JSON stored in device_data_logs
                };

                // Log what was changed vs preserved
                const changedFields = Object.keys(mqttData).filter(key => key !== 'timestamp');
                const allFields = ['voltage', 'current', 'power', 'frequency', 'power_factor', 'machine_state', 'socket_state', 'sensor_state', 'over_voltage', 'under_voltage'];
                const preservedFields = allFields.filter(field => 
                    !changedFields.includes(field) && latestRecord[field] !== null
                );

                console.log(`📊 [Device ${deviceId}] MERGE complete:`);
                console.log(`   🔄 Updated: [${changedFields.join(', ')}]`);
                console.log(`   💾 Preserved: [${preservedFields.join(', ')}] (${preservedFields.length}/${allFields.length})`);
                
            } else {
                // 3. NEW RECORD: No previous data, create with only MQTT data
                completeData = {
                    device_id: deviceId,
                    socket_id: socketId,
                    
                    // Only set fields that MQTT provides, others remain null
                    voltage: mqttData.voltage || null,
                    current: mqttData.current || null,
                    power: mqttData.power || null,
                    frequency: mqttData.frequency || null,
                    power_factor: mqttData.power_factor || null,
                    
                    machine_state: mqttData.machine_state || false,
                    socket_state: mqttData.socket_state || false,
                    sensor_state: mqttData.sensor_state || false,
                    
                    over_voltage: mqttData.over_voltage || false,
                    under_voltage: mqttData.under_voltage || false,
                    
                    timestamp: parseMqttTimestamp(mqttData.timestamp)
                    // Note: data_payload removed - not in schema, use device_data_logs for raw JSON
                };

                console.log(`🆕 [Device ${deviceId}] Creating first record with ${Object.keys(mqttData).length} MQTT fields`);
            }

            // 4. Insert new history record with complete data
            // ✅ timestamp: MQTT device timestamp (as-is)
            // ✅ created_at: Server UTC time (auto by Prisma @default(now()))
            const newRecord = await prisma.device_data.create({
                data: {
                    ...completeData,
                    created_at: new Date()  // ✅ Explicitly set UTC time
                }
            });

            console.log(`✅ [Device ${deviceId}] History record created - ID: ${newRecord.id}`);

            // 5. Also keep device_data_logs for raw JSON storage
            await prisma.device_data_logs.create({
                data: {
                    device_id: deviceId,
                    socket_id: socketId,
                    data_json: mqttData,
                    timestamp: new Date()  // ✅ UTC time
                }
            });
            
            return newRecord;
            
        } catch (error) {
            console.error(`❌ Failed to store device data history:`, error);
            throw error;
        }
    }

    /**
     * Update device current state with incremental merge logic (similar to mqtt.database.js)
     */
    async updateDeviceCurrentState(deviceId, socketId, mqttData) {
        try {
            // ✅ VALIDATION: Must have valid deviceId
            if (!deviceId) {
                console.warn(`⚠️  Cannot update device state - deviceId is null`);
                return null;
            }
            
            console.log(`📊 [Device ${deviceId}] Updating current state with MERGE strategy:`, Object.keys(mqttData));
            
            // Get current state from database
            const currentState = await prisma.device_data_latest.findUnique({
                where: { device_id: deviceId }
            });

            if (currentState) {
                // INCREMENTAL UPDATE: Only update fields that MQTT provides
                const updateData = {
                    // Always update metadata
                    socket_id: socketId,
                    is_connected: true,
                    last_seen_at: new Date(),  // ✅ UTC
                    updated_at: new Date(),    // ✅ UTC
                    timestamp: parseMqttTimestamp(mqttData.timestamp)  // ✅ MQTT timestamp (as-is)
                };

                // Map ONLY incoming MQTT fields (preserve existing values for others)
                const mqttFieldMap = {
                    voltage: 'voltage',
                    current: 'current', 
                    power: 'power',
                    frequency: 'frequency',
                    power_factor: 'power_factor',
                    machine_state: 'machine_state',
                    socket_state: 'socket_state',
                    sensor_state: 'sensor_state',
                    over_voltage: 'over_voltage',
                    under_voltage: 'under_voltage'
                };

                const changedFields = [];
                const preservedFields = [];
                
                // Check all possible fields
                for (const [mqttKey, dbField] of Object.entries(mqttFieldMap)) {
                    if (mqttData.hasOwnProperty(mqttKey)) {
                        // Field provided by MQTT - update it
                        const newValue = mqttData[mqttKey];
                        const oldValue = currentState[dbField];
                        
                        updateData[dbField] = newValue;
                        
                        if (oldValue !== newValue) {
                            changedFields.push(`${dbField}: ${oldValue} → ${newValue}`);
                        }
                    } else {
                        // Field NOT provided by MQTT - preserve existing value
                        if (currentState[dbField] !== null) {
                            preservedFields.push(dbField);
                        }
                    }
                }

                await prisma.device_data_latest.update({
                    where: { device_id: deviceId },
                    data: updateData
                });
                
                console.log(`✅ [Device ${deviceId}] Current state updated:`);
                console.log(`   🔄 Changed: [${changedFields.join(', ')}]`);
                console.log(`   💾 Preserved: [${preservedFields.join(', ')}] (${preservedFields.length} fields)`);
                
            } else {
                // CREATE new record with initial state (only MQTT fields + metadata)
                const createData = {
                    device_id: deviceId,
                    socket_id: socketId,
                    
                    // Only set fields that MQTT provides
                    voltage: mqttData.voltage || null,
                    current: mqttData.current || null,
                    power: mqttData.power || null,
                    frequency: mqttData.frequency || null,
                    power_factor: mqttData.power_factor || null,
                    machine_state: mqttData.machine_state || false,
                    socket_state: mqttData.socket_state || false,
                    sensor_state: mqttData.sensor_state || false,
                    over_voltage: mqttData.over_voltage || false,
                    under_voltage: mqttData.under_voltage || false,
                    
                    // Metadata
                    is_connected: true,
                    last_seen_at: new Date(),  // ✅ UTC
                    updated_at: new Date(),    // ✅ UTC
                    timestamp: parseMqttTimestamp(mqttData.timestamp)  // ✅ MQTT timestamp (as-is)
                };

                await prisma.device_data_latest.create({
                    data: createData
                });
                
                console.log(`🆕 [Device ${deviceId}] Created initial current state with ${Object.keys(mqttData).length} MQTT fields`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to update device current state:`, error);
            throw error;
        }
    }

    /**
     * Disconnect a specific socket
     */
    async disconnectSocket(socketId) {
        try {
            const client = this.clients.get(socketId);
            const connectionInfo = this.connections.get(socketId);
            
            if (client) {
                client.end(true);
                this.clients.delete(socketId);
            }
            
            if (connectionInfo) {
                connectionInfo.status = 'disconnected';
            }

            // Clear reconnect timer
            if (this.reconnectTimers.has(socketId)) {
                clearTimeout(this.reconnectTimers.get(socketId));
                this.reconnectTimers.delete(socketId);
            }

            // Update socket status
            await prisma.sockets.update({
                where: { id: socketId },
                data: { status: 'inactive' }
            });

            console.log(`🔌 Socket ${socketId} disconnected`);
        } catch (error) {
            console.error(`Failed to disconnect socket ${socketId}:`, error);
        }
    }

    /**
     * Reconnect a specific socket
     */
    async reconnectSocket(socketId) {
        try {
            const connectionInfo = this.connections.get(socketId);
            if (connectionInfo) {
                await this.connectSocket(connectionInfo.socket);
            }
        } catch (error) {
            console.error(`Failed to reconnect socket ${socketId}:`, error);
        }
    }

    /**
     * Publish message to a socket's topic
     */
    async publishToSocket(socketId, message, options = {}) {
        try {
            const client = this.clients.get(socketId);
            const connectionInfo = this.connections.get(socketId);
            
            if (!client || !connectionInfo) {
                throw new Error(`Socket ${socketId} not connected`);
            }

            const publishOptions = {
                qos: options.qos || connectionInfo.options.qos || 0,
                retain: options.retain || connectionInfo.options.retain || false
            };

            return new Promise((resolve, reject) => {
                client.publish(
                    connectionInfo.topic, 
                    JSON.stringify(message), 
                    publishOptions,
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        } catch (error) {
            console.error(`Failed to publish to socket ${socketId}:`, error);
            throw error;
        }
    }

    /**
     * Get connection status for a socket
     */
    getSocketStatus(socketId) {
        const connectionInfo = this.connections.get(socketId);
        const client = this.clients.get(socketId);
        
        return {
            socketId,
            status: connectionInfo?.status || 'disconnected',
            connected: client?.connected || false,
            reconnectAttempts: connectionInfo?.reconnectAttempts || 0,
            topic: connectionInfo?.topic,
            broker: connectionInfo ? {
                host: connectionInfo.options.host,
                port: connectionInfo.options.port
            } : null
        };
    }

    /**
     * Get all connection statuses
     */
    getAllStatuses() {
        return Array.from(this.connections.keys()).map(socketId => 
            this.getSocketStatus(socketId)
        );
    }

    /**
     * Shutdown all connections
     */
    async shutdown() {
        console.log('🔌 Shutting down all MQTT connections...');
        
        // Clear all timers
        this.reconnectTimers.forEach(timer => clearTimeout(timer));
        this.reconnectTimers.clear();

        // Disconnect all clients
        const disconnectPromises = Array.from(this.clients.keys()).map(socketId => 
            this.disconnectSocket(socketId)
        );

        await Promise.all(disconnectPromises);

        // Clear maps
        this.clients.clear();
        this.connections.clear();

        console.log('✅ All MQTT connections closed');
    }
}

// Export singleton instance
export default new SocketMQTTClient();