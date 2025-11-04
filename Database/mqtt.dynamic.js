import mqtt from 'mqtt';
import crypto from 'crypto';
import { checkDeviceWarnings } from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
import socketService from '../services/socketService.js';
import prisma from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

class DynamicMqttManager {
    constructor() {
        this.clients = new Map();
        this.deviceTopics = new Map();
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.isInitialized = false;
        
        // Multi-layer caching
        this.deviceStateCache = new Map(); // deviceId -> { field: { value, updated_at, dataType } }
        this.measurementCache = new Map(); // measurementName -> measurement info
        
        // ✅ Message deduplication cache
        this.processedMessages = new Map(); // messageHash -> timestamp
        this.messageRetentionTime = 10000; // 10 seconds
        
        // Retry queue for failed saves
        this.retryQueue = [];
        this.maxRetryQueueSize = 1000;
        
        // Statistics
        this.stats = {
            messagesReceived: 0,
            messagesSaved: 0,
            rawDataLogged: 0,
            fieldsProcessed: 0,
            errors: 0,
            retries: 0,
            connectionErrors: 0,
            duplicatesSkipped: 0,
            cacheSizeDevices: 0,
            cacheSizeMeasurements: 0
        };
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Dynamic MQTT Manager...');
            
            // Load measurement definitions
            await this.loadMeasurements();
            
            // Load all active device connections
            await this.loadActiveDevices();
            
            // Load existing device states into cache
            await this.loadDeviceStates();
            
            // Setup periodic tasks
            this.setupPeriodicRefresh();
            this.setupPeriodicCleanup();
            this.setupRetryProcessor();
            this.setupStatsLogger();
            
            this.isInitialized = true;
            console.log('✅ Dynamic MQTT Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Dynamic MQTT Manager:', error);
        }
    }

    // ===== INITIALIZATION METHODS =====

    async loadMeasurements() {
        try {
            const measurements = await prisma.$queryRaw`
                SELECT id, name, data_type, unit 
                FROM measurements
            `;
            
            measurements.forEach(m => {
                this.measurementCache.set(m.name, m);
            });
            
            this.stats.cacheSizeMeasurements = measurements.length;
            console.log(`📊 Loaded ${measurements.length} measurements into cache`);
        } catch (error) {
            console.error('Error loading measurements:', error);
        }
    }

    async loadDeviceStates() {
        try {
            const latestData = await prisma.$queryRaw`
                SELECT 
                    ld.device_id,
                    m.name as measurement_name,
                    m.data_type,
                    ld.latest_value,
                    ld.updated_at
                FROM device_latest_data ld
                JOIN measurements m ON ld.measurement_id = m.id
            `;
            
            // Group by device_id
            latestData.forEach(row => {
                if (!this.deviceStateCache.has(row.device_id)) {
                    this.deviceStateCache.set(row.device_id, {});
                }
                this.deviceStateCache.get(row.device_id)[row.measurement_name] = {
                    value: row.latest_value,
                    updated_at: row.updated_at,
                    dataType: row.data_type
                };
            });
            
            this.stats.cacheSizeDevices = this.deviceStateCache.size;
            console.log(`💾 Loaded states for ${this.deviceStateCache.size} devices into cache`);
        } catch (error) {
            console.error('Error loading device states:', error);
        }
    }

    async loadActiveDevices() {
        try {
            const tablesExist = await this.checkTablesExist();
            if (!tablesExist) {
                console.log('⚠️  Device management tables not found.');
                return;
            }

            const activeDevices = await prisma.$queryRaw`
                SELECT 
                    d.id,
                    d.serial_number,
                    dc.mqtt_user,
                    dc.mqtt_topic,
                    dc.broker_host,
                    dc.broker_port,
                    dc.ssl_enabled,
                    dc.heartbeat_interval,
                    dm.name as model_name,
                    m.name as manufacturer
                FROM device d
                JOIN device_connectivity dc ON d.id = dc.device_id
                JOIN device_models dm ON d.model_id = dm.id
                LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
                WHERE dc.is_active = true 
                AND d.status = 'active'::device_status
            `;

            console.log(`📡 Found ${activeDevices.length} active dynamic MQTT devices`);

            if (activeDevices.length === 0) return;

            const brokerGroups = this.groupDevicesByBroker(activeDevices);

            for (const [brokerKey, devices] of brokerGroups.entries()) {
                await this.createBrokerConnection(brokerKey, devices);
            }

        } catch (error) {
            console.error('Error loading active devices:', error);
        }
    }

    async checkTablesExist() {
        try {
            const result = await prisma.$queryRaw`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'device'
                ) as device_exists,
                EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'device_connectivity'
                ) as connectivity_exists
            `;
            
            return result[0].device_exists && result[0].connectivity_exists;
        } catch (error) {
            return false;
        }
    }

    groupDevicesByBroker(devices) {
        const groups = new Map();

        devices.forEach(device => {
            const brokerKey = `${device.broker_host}:${device.broker_port}:${device.ssl_enabled}`;
            
            if (!groups.has(brokerKey)) {
                groups.set(brokerKey, {
                    config: {
                        host: device.broker_host,
                        port: device.broker_port,
                        ssl: device.ssl_enabled
                    },
                    devices: []
                });
            }

            groups.get(brokerKey).devices.push(device);
        });

        return groups;
    }

    // ===== MQTT CONNECTION METHODS =====

    async createBrokerConnection(brokerKey, brokerData) {
        try {
            const { config, devices } = brokerData;
            
            const mqttConfig = {
                host: config.host,
                port: config.port,
                protocol: config.ssl ? 'mqtts' : 'mqtt',
                clientId: `dynamic-mqtt-${Math.random().toString(16).slice(2, 8)}`,
                clean: true,
                connectTimeout: 10000, // Increased from 4s to 10s
                reconnectPeriod: 5000,  // Increased from 1s to 5s
                rejectUnauthorized: false,
                // Add DNS resolution options for better connectivity
                family: 4 // Force IPv4
            };

            console.log(`🔌 Connecting to dynamic broker: ${config.host}:${config.port}`);

            const client = mqtt.connect(`${mqttConfig.protocol}://${config.host}:${config.port}`, mqttConfig);
            this.clients.set(brokerKey, client);
            this.setupClientEvents(client, brokerKey, devices);

        } catch (error) {
            console.error(`❌ Error creating dynamic broker connection for ${brokerKey}:`, error);
            
            // Retry with local broker if external broker fails
            if (brokerKey.includes('broker.hivemq.com')) {
                console.log(`🔄 Retrying with fallback broker...`);
                setTimeout(() => {
                    this.createBrokerConnection(`${brokerKey}-fallback`, {
                        config: {
                            host: 'test.mosquitto.org',
                            port: 1883,
                            ssl: false
                        },
                        devices
                    });
                }, 5000);
            }
        }
    }

    setupClientEvents(client, brokerKey, devices) {
        client.on('connect', () => {
            console.log(`✅ Dynamic MQTT connected to broker: ${brokerKey}`);
            this.reconnectAttempts.delete(brokerKey);

            devices.forEach(device => {
                if (device.mqtt_topic) {
                    client.subscribe(device.mqtt_topic, (err) => {
                        if (!err) {
                            console.log(`📡 Subscribed to ${device.mqtt_topic} (${device.model_name})`);
                            this.deviceTopics.set(device.mqtt_topic, device);
                        }
                    });
                }
            });
        });

        client.on('message', async (topic, message) => {
            await this.handleMessage(topic, message);
        });

        client.on('error', (error) => {
            console.error(`❌ MQTT error for ${brokerKey}:`, error);
            this.stats.connectionErrors++;
            
            // Log specific DNS/connection errors
            if (error.code === 'ENOTFOUND' || error.syscall === 'getaddrinfo') {
                console.error(`🌐 DNS resolution failed for ${brokerKey}. Check internet connection or try a different broker.`);
            }
        });

        client.on('reconnect', () => {
            const attempts = this.reconnectAttempts.get(brokerKey) || 0;
            if (attempts < this.maxReconnectAttempts) {
                console.log(`🔄 Reconnecting to ${brokerKey}... (${attempts + 1})`);
                this.reconnectAttempts.set(brokerKey, attempts + 1);
            } else {
                console.error(`❌ Max reconnection attempts for ${brokerKey}`);
                client.end();
            }
        });

        client.on('close', () => {
            console.log(`📪 Connection closed for ${brokerKey}`);
        });
    }

    // ===== MESSAGE HANDLING =====

    async handleMessage(topic, message) {
        try {
            this.stats.messagesReceived++;

            const device = this.deviceTopics.get(topic) || await this.getDeviceByTopic(topic);
            
            if (!device) {
                console.warn(`⚠️  No device found for topic: ${topic}`);
                return;
            }

            let incomingData;
            try {
                incomingData = JSON.parse(message.toString());
            } catch (parseError) {
                console.error(`❌ Invalid JSON for ${topic}`);
                this.stats.errors++;
                return;
            }

            // ✅ Generate message hash for deduplication
            const messageHash = this.generateMessageHash(device.id, incomingData);
            
            // ✅ Check if message already processed recently
            if (this.isMessageDuplicate(messageHash)) {
                this.stats.duplicatesSkipped++;
                console.log(`⏭️ Skipping duplicate message for ${device.serial_number} (${this.stats.duplicatesSkipped} total skipped)`);
                return;
            }
            
            // ✅ Mark message as processed
            this.markMessageProcessed(messageHash);

            if (process.env.DEBUG_MQTT === 'true') {
                console.log(`📨 Message ${this.stats.messagesReceived} from ${device.serial_number} (${topic}):`, incomingData);
            }

            // Process with optimized delta logic
            await this.processDeviceDataOptimized(device, incomingData);

        } catch (error) {
            console.error(`❌ Error handling message for ${topic}:`, error);
            this.stats.errors++;
        }
    }

    // ✅ Generate unique hash for message deduplication
    generateMessageHash(deviceId, data) {
        const contentString = JSON.stringify({
            deviceId,
            timestamp: data.timestamp,
            // Include key fields that make message unique (exclude timestamp for exact match)
            data: Object.entries(data)
                .filter(([key]) => !['timestamp'].includes(key))
                .sort()
        });
        return crypto.createHash('md5').update(contentString).digest('hex');
    }

    // ✅ Check if message is duplicate
    isMessageDuplicate(messageHash) {
        const processedTime = this.processedMessages.get(messageHash);
        if (!processedTime) return false;
        
        const now = Date.now();
        if (now - processedTime > this.messageRetentionTime) {
            // Expired, remove from cache
            this.processedMessages.delete(messageHash);
            return false;
        }
        
        return true;
    }

    // ✅ Mark message as processed
    markMessageProcessed(messageHash) {
        this.processedMessages.set(messageHash, Date.now());
        
        // Cleanup old entries periodically
        if (this.processedMessages.size > 10000) {
            const now = Date.now();
            for (const [hash, timestamp] of this.processedMessages.entries()) {
                if (now - timestamp > this.messageRetentionTime) {
                    this.processedMessages.delete(hash);
                }
            }
        }
    }

    async getDeviceByTopic(topic) {
        try {
            const devices = await prisma.$queryRaw`
                SELECT 
                    d.id,
                    d.serial_number,
                    dc.mqtt_topic,
                    dc.data_mapping,
                    dm.name as model_name,
                    m.name as manufacturer
                FROM device d
                JOIN device_connectivity dc ON d.id = dc.device_id
                JOIN device_models dm ON d.model_id = dm.id
                LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
                WHERE dc.mqtt_topic = ${topic} 
                AND dc.is_active = true 
                AND d.status = 'active'::device_status
            `;

            return devices[0] || null;
        } catch (error) {
            console.error('Error getting device by topic:', error);
            return null;
        }
    }

    // ===== OPTIMIZED DATA PROCESSING =====

    async processDeviceDataOptimized(device, incomingData) {
        try {
            const deviceId = device.id;
            
            // STEP 1: Get current state from cache
            let currentState = this.deviceStateCache.get(deviceId) || {};
            
            // STEP 2: Process ALL incoming fields (MQTT already filtered at device)
            const processedFields = this.processAllFields(incomingData, currentState);
            
            // STEP 3: Merge to get full state
            const fullState = this.mergeState(currentState, processedFields);
            
            const changedFields = processedFields; // All fields are considered "changed" from MQTT
            
            console.log(`📊 Device ${device.serial_number}: Processing all ${Object.keys(incomingData).length} fields from MQTT`);
            
            // ✅ STEP 4: Save ALL data in one place (raw log + processed data)
            await this.saveBatchOptimized(deviceId, changedFields, fullState, incomingData);
            
            // Update cache with full state
            this.deviceStateCache.set(deviceId, fullState);
            this.stats.cacheSizeDevices = this.deviceStateCache.size;
            
            // STEP 5: Check device warnings with full state
            await this.checkWarnings(device, fullState);
            
            this.stats.messagesSaved++;
            this.stats.fieldsProcessed += Object.keys(processedFields).length;
            console.log(`✅ Processed and saved data for ${device.serial_number} (${Object.keys(processedFields).length} fields, Total: ${this.stats.messagesSaved} messages)`)
            
            // Update last_connected timestamp
            await this.updateDeviceLastConnected(deviceId);

        } catch (error) {
            console.error(`Error processing device ${device.id}:`, error);
            this.stats.errors++;
            throw error;
        }
    }

    processAllFields(incomingData, currentState) {
        const processedFields = {};
        
        for (const [key, value] of Object.entries(incomingData)) {
            // Skip metadata fields
            if (['timestamp', 'device_id', 'serial_number', 'asset_tag'].includes(key)) {
                continue;
            }
            
            const currentDataType = currentState[key]?.dataType;
            
            // Parse value with proper type handling
            const processedValue = this.parseValue(value, currentDataType);
            
            // Always include all fields from MQTT (device already filtered)
            processedFields[key] = processedValue;
            
            if (process.env.DEBUG_MQTT === 'true') {
                const currentValue = currentState[key]?.value;
                const isActualChange = currentValue === undefined || currentValue !== processedValue;
                console.log(`   📊 ${key}: ${currentValue} → ${processedValue} ${isActualChange ? '(NEW/CHANGED)' : '(SAME)'}`);
            }
        }
        
        return processedFields;
    }

    parseValue(value, expectedType) {
        if (value === null || value === undefined) return null;
        
        // ✅ Respect expected type strictly để tránh data corruption
        switch (expectedType) {
            case 'numeric':
                return typeof value === 'number' ? value : parseFloat(value);
            case 'boolean':
                return Boolean(value);
            case 'text':
                return String(value); // ✅ Không parse số để giữ nguyên "18:27:53"
            case 'json':
                return typeof value === 'string' ? JSON.parse(value) : value;
            default:
                // ✅ Auto-detect nhưng không parse string sang số để tránh mất data
                const type = typeof value;
                if (type === 'number') return value;
                if (type === 'boolean') return value;
                if (type === 'object') return value;
                return String(value); // Keep strings as strings
        }
    }

    mergeState(currentState, processedFields) {
        const merged = { ...currentState };
        
        for (const [key, value] of Object.entries(processedFields)) {
            merged[key] = {
                value: value,
                updated_at: new Date(),
                dataType: this.inferDataType(value)
            };
        }
        
        return merged;
    }

    // ===== WARNING SYSTEM INTEGRATION =====

    async checkWarnings(device, fullState) {
        try {
            const stateForWarnings = this.convertStateForWarnings(fullState);
            
            await checkDeviceWarnings(
                device.model_name,
                stateForWarnings,
                device.serial_number
            );
            
            if (process.env.DEBUG_MQTT === 'true') {
                console.log(`✅ Warnings checked for ${device.serial_number}`);
            }
        } catch (warningError) {
            console.error(`⚠️ Warning check failed for ${device.serial_number}:`, warningError);
            // Don't throw - warnings shouldn't break data flow
        }
    }

    convertStateForWarnings(fullState) {
        const warningData = {};
        for (const [key, data] of Object.entries(fullState)) {
            warningData[key] = data.value;
        }
        return warningData;
    }

    // ===== OPTIMIZED DATABASE OPERATIONS =====

    async saveRawDataLog(deviceId, rawData) {
        try {
            await prisma.$queryRaw`
                INSERT INTO device_data_logs (
                    device_id, data_json, timestamp
                ) VALUES (
                    ${deviceId}::uuid,
                    ${JSON.stringify(rawData)}::jsonb,
                    ${new Date()}
                )
            `;
            
            this.stats.rawDataLogged++;
            
            if (process.env.DEBUG_MQTT === 'true') {
                console.log(`📝 Raw data logged for device ${deviceId}: ${Object.keys(rawData).length} fields (Total logged: ${this.stats.rawDataLogged})`);
            }
            
        } catch (error) {
            console.error(`❌ Error saving raw data log for device ${deviceId}:`, error.message);
            this.stats.errors++; // ✅ Track errors in stats
            
            // ✅ Add to retry queue if it's a critical error
            if (this.isRetryableError(error)) {
                console.warn(`🔄 Adding raw data log to retry queue for device ${deviceId}`);
                // Could implement a separate retry queue for logs if needed
            }
            // Still don't throw - this shouldn't break the main flow
        }
    }

    async saveBatchOptimized(deviceId, allFields, fullState, rawData, retryCount = 0) {
        try {
            // ✅ Raw log riêng biệt - không cần transaction
            await this.saveRawDataLog(deviceId, rawData);
            
            // ✅ Transaction chỉ cho critical data với measurements được tạo INSIDE transaction
            await prisma.$transaction(async (tx) => {
                const timestamp = new Date();
                
                // ✅ Create measurements INSIDE transaction để đảm bảo consistency
                const measurementMap = await this.ensureMeasurementsInTransaction(
                    tx, allFields, fullState
                );
                
                // Now safe to use với measurementMap được đảm bảo
                await Promise.all([
                    this.saveAllFieldsToHistory(tx, deviceId, allFields, timestamp, measurementMap),
                    this.updateLatestDataBatch(tx, deviceId, fullState, timestamp, measurementMap)
                ]);
            }, {
                timeout: 10000, // ✅ Explicit timeout
                maxWait: 5000
            });
            
            // ✅ Emit sau khi save thành công
            this.emitRealtimeData(deviceId, allFields, fullState);
            
            console.log(`💾 Saved ${Object.keys(allFields).length} fields for device ${deviceId}`);
            
        } catch (error) {
            // ✅ Clear measurement cache on error to force refresh
            this.clearMeasurementCacheForFields(allFields, fullState);
            
            if (retryCount < 3 && this.isRetryableError(error)) {
                this.stats.retries++;
                console.warn(`🔄 Retrying save for device ${deviceId}, attempt ${retryCount + 1}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                // ✅ Call retry method that DOESN'T save raw log again
                return this.saveBatchOptimizedRetry(deviceId, allFields, fullState, retryCount + 1);
            }
            
            // Add to retry queue if max retries exceeded
            this.addToRetryQueue(deviceId, allFields, fullState, rawData);
            throw error;
        }
    }

    // ✅ Separate retry method that DOESN'T save raw log again
    async saveBatchOptimizedRetry(deviceId, allFields, fullState, retryCount = 0) {
        try {
            // ✅ NO raw log save - already saved in original call
            
            await prisma.$transaction(async (tx) => {
                const timestamp = new Date();
                
                const measurementMap = await this.ensureMeasurementsInTransaction(
                    tx, allFields, fullState
                );
                
                await Promise.all([
                    this.saveAllFieldsToHistory(tx, deviceId, allFields, timestamp, measurementMap),
                    this.updateLatestDataBatch(tx, deviceId, fullState, timestamp, measurementMap)
                ]);
            }, {
                timeout: 10000,
                maxWait: 5000
            });
            
            this.emitRealtimeData(deviceId, allFields, fullState);
            console.log(`💾 Retry saved ${Object.keys(allFields).length} fields for device ${deviceId}`);
            
        } catch (error) {
            this.clearMeasurementCacheForFields(allFields, fullState);
            
            if (retryCount < 3 && this.isRetryableError(error)) {
                this.stats.retries++;
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this.saveBatchOptimizedRetry(deviceId, allFields, fullState, retryCount + 1);
            }
            throw error;
        }
    }

    // ✅ NEW: Ensure all measurements exist INSIDE transaction for consistency
    async ensureMeasurementsInTransaction(tx, allFields, fullState) {
        const measurementMap = new Map();
        const allFieldNames = [...new Set([
            ...Object.keys(allFields), 
            ...Object.keys(fullState)
        ])];
        
        for (const fieldName of allFieldNames) {
            let measurement = this.measurementCache.get(fieldName);
            
            if (!measurement) {
                // ✅ Create measurement INSIDE transaction để đảm bảo atomicity
                measurement = await this.getOrCreateMeasurement(tx, fieldName, 
                    allFields[fieldName] || fullState[fieldName]?.value);
                this.measurementCache.set(fieldName, measurement);
                this.stats.cacheSizeMeasurements = this.measurementCache.size;
            }
            
            // ✅ Validate measurement exists
            if (!measurement || !measurement.id) {
                throw new Error(`Failed to create measurement for field: ${fieldName}`);
            }
            
            measurementMap.set(fieldName, measurement);
        }
        
        return measurementMap;
    }

    // ✅ DEPRECATED: Keep for backward compatibility but not used
    async ensureMeasurementsExist(allFields, fullState) {
        console.warn('⚠️ ensureMeasurementsExist is deprecated, use ensureMeasurementsInTransaction');
        // Empty implementation - method được giữ để tránh breaking changes
    }

    // ✅ NEW: Clear cache for specific fields on error
    clearMeasurementCacheForFields(allFields, fullState) {
        const allFieldNames = new Set([
            ...Object.keys(allFields),
            ...Object.keys(fullState)
        ]);

        for (const fieldName of allFieldNames) {
            this.measurementCache.delete(fieldName);
        }
        
        this.stats.cacheSizeMeasurements = this.measurementCache.size;
        console.log(`🧹 Cleared measurement cache for ${allFieldNames.size} fields`);
    }

    async saveAllFieldsToHistory(tx, deviceId, allFields, timestamp, measurementMap) {
        const measurementData = [];
        
        for (const [fieldName, value] of Object.entries(allFields)) {
            // ✅ Use pre-validated measurementMap
            const measurement = measurementMap.get(fieldName);
            
            if (!measurement) {
                throw new Error(`❌ Missing measurement in measurementMap for ${fieldName}`);
            }
            
            measurementData.push({
                measurementId: measurement.id,
                measurementName: fieldName,
                value: value
            });
        }
        
        // Batch insert
        if (measurementData.length > 0) {
            const values = measurementData.map((m, idx) => 
                `($${idx * 4 + 1}::uuid, $${idx * 4 + 2}::uuid, $${idx * 4 + 3}::jsonb, $${idx * 4 + 4})`
            ).join(',');
            
            const params = measurementData.flatMap(m => [
                deviceId,
                m.measurementId,
                JSON.stringify({ [m.measurementName]: m.value }),
                timestamp
            ]);
            
            try {
                await tx.$queryRawUnsafe(`
                    INSERT INTO device_data (
                        device_id, measurement_id, data_payload, timestamp
                    ) VALUES ${values}
                `, ...params);
                
                console.log(`✅ Saved ${measurementData.length} fields to device_data`);
            } catch (fkError) {
                // ✅ Handle foreign key constraint errors gracefully
                if (fkError.code === 'P2010' && fkError.meta?.code === '23503') {
                    console.error(`❌ Foreign key constraint error for device_data:`, fkError.meta.message);
                    console.error(`Measurement IDs:`, measurementData.map(m => m.measurementId));
                    
                    // Re-validate measurements exist
                    for (const m of measurementData) {
                        const exists = await tx.$queryRaw`
                            SELECT id FROM measurements WHERE id = ${m.measurementId}
                        `;
                        if (exists.length === 0) {
                            console.error(`❌ Missing measurement ID: ${m.measurementId} for ${m.measurementName}`);
                        }
                    }
                }
                throw fkError;
            }
        }
    }

    async updateLatestDataBatch(tx, deviceId, fullState, timestamp, measurementMap) {
        const updates = [];
        
        for (const [fieldName, fieldData] of Object.entries(fullState)) {
            // ✅ Use pre-validated measurementMap
            const measurement = measurementMap.get(fieldName);
            
            if (!measurement) {
                throw new Error(`❌ Missing measurement in measurementMap for ${fieldName}`);
            }
            
            // ✅ CRITICAL FIX: Only insert numeric values to device_latest_data
            // Skip text values like "18:27:32" as latest_value column is Float type
            const value = fieldData.value;
            if (typeof value === 'number' || 
                (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value)))) {
                
                updates.push({
                    deviceId,
                    measurementId: measurement.id,
                    value: typeof value === 'number' ? value : parseFloat(value),
                    updatedAt: fieldData.updated_at || timestamp
                });
            } else {
                console.log(`⏭️ Skipping non-numeric value for latest_data: ${fieldName}=${value} (${typeof value})`);
            }
        }
        
        // Batch upsert - all values are numeric now
        if (updates.length > 0) {
            const values = updates.map((u, idx) => 
                `($${idx * 4 + 1}::uuid, $${idx * 4 + 2}::uuid, $${idx * 4 + 3}::float, $${idx * 4 + 4})`
            ).join(',');
            
            const params = updates.flatMap(u => [
                u.deviceId,
                u.measurementId,
                u.value,
                u.updatedAt
            ]);
            
            await tx.$queryRawUnsafe(`
                INSERT INTO device_latest_data (
                    device_id, measurement_id, latest_value, updated_at
                ) VALUES ${values}
                ON CONFLICT (device_id, measurement_id) 
                DO UPDATE SET 
                    latest_value = EXCLUDED.latest_value,
                    updated_at = EXCLUDED.updated_at
            `, ...params);
        }
    }

    async getOrCreateMeasurement(tx, fieldName, value) {
        try {
            // ✅ First try to get existing measurement
            const existing = await tx.$queryRaw`
                SELECT id, name, data_type 
                FROM measurements 
                WHERE name = ${fieldName}
            `;
            
            if (existing.length > 0) {
                console.log(`📋 Found existing measurement: ${fieldName}`);
                return existing[0];
            }
            
            // ✅ If not found, create with UPSERT to handle race conditions
            return await this.createMeasurement(tx, fieldName, value);
            
        } catch (error) {
            console.error(`❌ Error in getOrCreateMeasurement for ${fieldName}:`, error);
            throw error;
        }
    }

    async createMeasurement(tx, fieldName, value) {
        const dataType = this.inferDataType(value);
        
        // ✅ Use UPSERT to handle race conditions
        const result = await tx.$queryRaw`
            INSERT INTO measurements (
                name, data_type, unit, validation_rules
            ) VALUES (
                ${fieldName},
                ${dataType}::measurement_data_type,
                'auto',
                ${JSON.stringify({ auto_created: true, source: 'mqtt_dynamic' })}::jsonb
            )
            ON CONFLICT (name) 
            DO UPDATE SET 
                data_type = EXCLUDED.data_type,
                validation_rules = EXCLUDED.validation_rules
            RETURNING id, name, data_type
        `;
        
        console.log(`📊 Auto-created/updated measurement: ${fieldName} (${dataType})`);
        return result[0];
    }

    inferDataType(value) {
        if (value === null || value === undefined) return 'text';
        
        // ✅ Check actual type, not string content
        const type = typeof value;
        
        if (type === 'number') {
            return 'numeric'; // All numbers as numeric (matches enum)
        }
        if (type === 'boolean') return 'boolean';
        if (type === 'object') return 'json';
        
        // ✅ String luôn là text, KHÔNG parse để tránh mất data như "18:27:53" → 18
        if (type === 'string') {
            return 'text';
        }
        
        return 'text'; // Default fallback
    }

    // ✅ NEW: Safe measurement creation outside transaction
    async getOrCreateMeasurementSafe(fieldName, value) {
        try {
            // First try to find existing using raw query (faster)
            const existing = await prisma.$queryRaw`
                SELECT id, name, data_type 
                FROM measurements 
                WHERE name = ${fieldName}
            `;
            
            if (existing.length > 0) {
                console.log(`📋 Found existing measurement (safe): ${fieldName}`);
                return existing[0];
            }
            
            // Create new measurement using UPSERT for safety
            const dataType = this.inferDataType(value);
            const result = await prisma.$queryRaw`
                INSERT INTO measurements (
                    name, data_type, unit, validation_rules
                ) VALUES (
                    ${fieldName},
                    ${dataType}::measurement_data_type,
                    'auto',
                    ${JSON.stringify({ auto_created: true, source: 'mqtt_dynamic_safe' })}::jsonb
                )
                ON CONFLICT (name) 
                DO UPDATE SET 
                    data_type = EXCLUDED.data_type,
                    validation_rules = EXCLUDED.validation_rules
                RETURNING id, name, data_type
            `;
            
            console.log(`📊 Safe auto-created measurement: ${fieldName} (${dataType})`);
            return result[0];
            
        } catch (error) {
            console.error(`❌ Error in safe measurement creation ${fieldName}:`, error.message);
            // Don't throw - this is pre-creation, let transaction handle it
            return null;
        }
    }

    // ===== ERROR HANDLING & RETRY =====

    isRetryableError(error) {
        const retryableErrors = [
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'LOCK',
            'DEADLOCK'
        ];
        
        return retryableErrors.some(errType => 
            error.message?.includes(errType) || error.code === errType
        );
    }

    addToRetryQueue(deviceId, allFields, fullState, rawData) {
        if (this.retryQueue.length >= this.maxRetryQueueSize) {
            console.warn('⚠️ Retry queue full, dropping oldest entry');
            this.retryQueue.shift();
        }
        
        this.retryQueue.push({
            deviceId,
            allFields,
            fullState,
            rawData,
            timestamp: new Date(),
            retryCount: 0
        });
        
        console.log(`📦 Added to retry queue (size: ${this.retryQueue.length})`);
    }

    setupRetryProcessor() {
        setInterval(async () => {
            if (this.retryQueue.length === 0) return;
            
            console.log(`🔄 Processing retry queue (${this.retryQueue.length} items)...`);
            
            const item = this.retryQueue.shift();
            
            try {
                // ✅ Use retry method that doesn't save raw log again
                await this.saveBatchOptimizedRetry(
                    item.deviceId,
                    item.allFields,
                    item.fullState,
                    item.retryCount
                );
                console.log(`✅ Retry successful for device ${item.deviceId}`);
            } catch (error) {
                item.retryCount++;
                if (item.retryCount < 5) {
                    this.retryQueue.push(item);
                } else {
                    console.error(`❌ Max retries exceeded for device ${item.deviceId}`);
                }
            }
        }, 30000); // Every 30 seconds
    }

    // ===== PERIODIC MAINTENANCE =====

    setupPeriodicCleanup() {
        setInterval(() => {
            const now = Date.now();
            const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
            
            let cleanedCount = 0;
            
            // Existing device cache cleanup
            for (const [deviceId, state] of this.deviceStateCache.entries()) {
                const lastUpdate = Math.max(...Object.values(state).map(s => 
                    new Date(s.updated_at).getTime()
                ));
                
                if (now - lastUpdate > CACHE_EXPIRY) {
                    this.deviceStateCache.delete(deviceId);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} inactive device caches`);
                this.stats.cacheSizeDevices = this.deviceStateCache.size;
            }
            
            // ✅ Add measurement cache limit để tránh memory leak
            if (this.measurementCache.size > 10000) {
                console.warn(`⚠️ Measurement cache too large (${this.measurementCache.size}), clearing...`);
                this.measurementCache.clear();
                this.loadMeasurements(); // Reload from DB
                console.log('🔄 Measurement cache cleared and reloaded');
            }
        }, 300000); // Every 5 minutes
    }

    setupPeriodicRefresh() {
        setInterval(async () => {
            try {
                if (process.env.DEBUG_MQTT === 'true') {
                    console.log('🔄 Refreshing MQTT configurations...');
                }
                
                // Close existing connections
                for (const [brokerKey, client] of this.clients.entries()) {
                    client.end(true);
                }
                
                this.clients.clear();
                this.deviceTopics.clear();
                
                // Reload
                await this.loadMeasurements();
                await this.loadActiveDevices();
                
            } catch (error) {
                console.error('Error during refresh:', error);
            }
        }, 300000); // Every 5 minutes
    }

    setupStatsLogger() {
        setInterval(() => {
            console.log('📊 MQTT Manager Statistics:', {
                ...this.stats,
                retryQueueSize: this.retryQueue.length,
                uptime: Math.floor(process.uptime())
            });
        }, 60000); // Every minute
    }

    // ===== UTILITY METHODS =====

    async updateDeviceLastConnected(deviceId) {
        try {
            await prisma.$queryRaw`
                UPDATE device_connectivity 
                SET last_connected = CURRENT_TIMESTAMP 
                WHERE device_id = ${deviceId}::uuid
            `;
        } catch (error) {
            console.error('Error updating last connected:', error);
        }
    }

    async addDevice(deviceId) {
        try {
            const device = await prisma.$queryRaw`
                SELECT 
                    d.id, d.serial_number,
                    dc.mqtt_topic, dc.broker_host,
                    dc.broker_port, dc.ssl_enabled,
                    dc.data_mapping,
                    dm.name as model_name,
                    m.name as manufacturer
                FROM device d
                JOIN device_connectivity dc ON d.id = dc.device_id
                JOIN device_models dm ON d.model_id = dm.id
                LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
                WHERE d.id = ${deviceId}::uuid 
                AND dc.is_active = true
            `;

            if (device.length > 0) {
                const brokerKey = `${device[0].broker_host}:${device[0].broker_port}:${device[0].ssl_enabled}`;
                const client = this.clients.get(brokerKey);
                
                if (client && client.connected) {
                    client.subscribe(device[0].mqtt_topic);
                    this.deviceTopics.set(device[0].mqtt_topic, device[0]);
                    console.log(`✅ Added device ${device[0].serial_number}`);
                } else {
                    await this.loadActiveDevices();
                }
            }

        } catch (error) {
            console.error('Error adding device:', error);
        }
    }

    removeDevice(topic) {
        this.deviceTopics.delete(topic);
        
        for (const client of this.clients.values()) {
            if (client.connected) {
                client.unsubscribe(topic);
            }
        }
    }

    getConnectionStatus() {
        const status = {
            initialized: this.isInitialized,
            brokers: {},
            devices: this.deviceTopics.size,
            cachedStates: this.deviceStateCache.size,
            retryQueueSize: this.retryQueue.length,
            stats: this.stats
        };
        
        for (const [brokerKey, client] of this.clients.entries()) {
            status.brokers[brokerKey] = {
                connected: client.connected,
                reconnecting: client.reconnecting
            };
        }
        
        return status;
    }

    getActiveTopics() {
        return Array.from(this.deviceTopics.keys());
    }

    getStats() {
        return {
            ...this.stats,
            retryQueueSize: this.retryQueue.length,
            cacheSizeDevices: this.deviceStateCache.size,
            cacheSizeMeasurements: this.measurementCache.size,
            uptime: Math.floor(process.uptime())
        };
    }

    closeAllConnections() {
        console.log('🔌 Closing all MQTT connections...');
        for (const client of this.clients.values()) {
            client.end(true);
        }
        this.clients.clear();
        this.deviceTopics.clear();
    }

    // ==================== SIMPLIFIED SOCKET.IO INTEGRATION ====================
    
    emitRealtimeData(deviceId, allFields, fullState) {
        try {
            // Sử dụng global Socket.IO instance
            if (!global.io) {
                console.warn('⚠️ Socket.IO not available');
                return;
            }

            // Get device name from cache or use serial number
            const device = this.getDeviceFromTopics(deviceId);
            const deviceName = device?.model_name || device?.serial_number || `Device-${deviceId}`;

            // Convert fullState to simple data object
            const simpleData = {};
            for (const [key, fieldData] of Object.entries(fullState)) {
                simpleData[key] = fieldData.value;
            }

            // ✅ NEW: Room-based broadcasting instead of global
            const payload = {
                deviceId,
                deviceName,
                data: simpleData,
                metadata: {
                    receivedFields: Object.keys(allFields),
                    lastUpdate: new Date().toISOString(),
                    source: 'mqtt_dynamic'
                }
            };

            // ✅ Broadcast to specific device room
            payload.room = `device:${deviceId}`;
            global.io.to(`device:${deviceId}`).emit('mqtt_data', payload);
            
            // ✅ Also broadcast to 'device:all' room for users monitoring all devices  
            payload.room = 'device:all';
            global.io.to('device:all').emit('mqtt_data', payload);

            if (process.env.DEBUG_MQTT === 'true') {
                console.log(`🔥 Socket.IO room broadcast sent for ${deviceName}: rooms [device:${deviceId}, device:all] with ${Object.keys(allFields).length} fields`);
            }

        } catch (error) {
            console.error('❌ Error emitting real-time data:', error);
        }
    }

    // Helper to get device info from topics cache
    getDeviceFromTopics(deviceId) {
        for (const device of this.deviceTopics.values()) {
            if (device.id === deviceId) {
                return device;
            }
        }
        return null;
    }
}

// Create and initialize
const dynamicMqttManager = new DynamicMqttManager();

setTimeout(() => {
    dynamicMqttManager.initialize();
}, 2000);

export default dynamicMqttManager;