import mqtt from 'mqtt';
import { checkDeviceWarnings } from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
import socketService from '../services/socketService.js';
import prisma from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

// ==================== CONFIGURATION ====================

const mqttConfig = {
    host: process.env.MQTT_HOST || 'broker.hivemq.com',
    port: parseInt(process.env.MQTT_PORT || '1883'),
    clientId: `iot-server-${Math.random().toString(16).slice(2, 8)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000
};

const TIME_WINDOW_MINUTES = parseInt(process.env.MQTT_TIME_WINDOW_MINUTES || '1');

// Whitelist allowed tables (SQL injection protection)
const ALLOWED_TABLES = [
    'auo_display',
    'camera_control_unit', 
    'electronic_endoflator',
    'led_nova_100',
    'iot_environment_status'
];

console.log(`Connecting to MQTT broker at ${mqttConfig.host}:${mqttConfig.port}`);
const url = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;

const client = mqtt.connect(url, mqttConfig);

const topics = {
    auoDisplay: 'iot/auo-display',
    cameraControl: 'iot/camera-control',
    electronic: 'iot/electronic',
    ledNova: 'iot/led-nova',
    iotEnv: 'iot/environment'
};

// ==================== HELPER FUNCTIONS ====================

async function getLatestRecord(tableName, timeWindowMinutes = TIME_WINDOW_MINUTES) {
    if (!ALLOWED_TABLES.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
    }

    try {
        let query;
        
        if (tableName === 'iot_environment_status') {
            // ✅ Environment có schema riêng
            query = `
                SELECT 
                    id,
                    leak_current_ma,
                    temperature_c,
                    humidity_percent,
                    over_temperature,
                    over_humidity,
                    soft_warning,
                    strong_warning,
                    shutdown_warning,
                    timestamp
                FROM ${tableName} 
                ORDER BY timestamp DESC 
                LIMIT 1
            `;
        } else {
            // ✅ TẤT CẢ device tables khác đều dùng schema này
            // (auo_display, camera_control_unit, electronic_endoflator, led_nova_100)
            query = `
                SELECT 
                    id,
                    voltage,
                    current,
                    power_operating,
                    frequency,
                    power_factor,
                    CAST(operating_time AS TEXT) as operating_time,
                    over_voltage_operating,
                    over_current_operating,
                    over_power_operating,
                    status_operating,
                    under_voltage_operating,
                    power_socket_status,
                    timestamp
                FROM ${tableName} 
                ORDER BY timestamp DESC  
                LIMIT 1
            `;
        }
        
        const result = await prisma.$queryRawUnsafe(query);
        
        if (result[0]) {
            if (process.env.DEBUG_MQTT === 'true') {
                const timeDiff = Math.round((new Date() - new Date(result[0].timestamp)) / 60000);
                console.log(`📋 Latest record for ${tableName}: ${timeDiff} minutes old`);
            }
        } else {
            console.warn(`⚠️ No previous record found in ${tableName} table`);
        }
        
        return result[0] || null;
    } catch (error) {
        console.error(`Error getting latest record from ${tableName}:`, error);
        return null;
    }
}
// ==================== DUPLICATE + UPDATE STRATEGY ====================

async function duplicateAndUpdateRecord(tableName, newData) {
    try {
        // ✅ 1. Get COMPLETE latest record
        const latestRecord = await getLatestRecord(tableName);
        
        // ✅ 2. Enhanced logging
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`🔍 [${tableName}] Latest record analysis:`);
            if (latestRecord) {
                const nullFields = Object.entries(latestRecord)
                    .filter(([key, value]) => value === null && key !== 'id' && key !== 'timestamp')
                    .map(([key]) => key);
                console.log(`   📋 Record ID: ${latestRecord.id}`);
                console.log(`   ⏰ Timestamp: ${latestRecord.timestamp}`);
                console.log(`   ❌ NULL fields: [${nullFields.join(', ')}]`);
                console.log(`   ✅ Valid fields: ${Object.keys(latestRecord).length - nullFields.length - 2}`);
            } else {
                console.log(`   ⚠️ No latest record found!`);
            }
        }
        
        // ✅ 3. If no record exists, create minimal record
        if (!latestRecord) {
            console.warn(`⚠️ Table ${tableName} is empty, creating minimal record with MQTT data only`);
            return createMinimalRecord(tableName, newData);
        }

        // ✅ 4. Merge with found record
        return mergeWithRecord(tableName, latestRecord, newData);
        
    } catch (error) {
        console.error(`❌ Error in duplicate+update for ${tableName}:`, error);
        throw error;
    }
}
// ✅ NEW: Separate merge function with better null handling
async function mergeWithRecord(tableName, sourceRecord, newData) {
    // ✅ 2. Log merge strategy
    if (process.env.DEBUG_MQTT === 'true') {
        console.log(`🔄 [${tableName}] MERGE strategy:`);
        console.log(`   📋 Source record ID: ${sourceRecord.id}`);
        console.log(`   📥 MQTT updates:`, Object.keys(newData));
        console.log(`   ⏰ Source timestamp: ${sourceRecord.timestamp}`);
    }

    // ✅ 3. SMART MERGE: Keep existing non-null values, update with MQTT data
    const { id, timestamp, ...recordData } = sourceRecord;
    
    // ✅ 4. Enhanced merge with null handling
    const updatedData = {};
    
    // First, copy all existing non-null values
    for (const [key, value] of Object.entries(recordData)) {
        if (value !== null) {
            updatedData[key] = value;
        }
    }
    
    // Then, override with MQTT data (even if null - MQTT data is authoritative)
    for (const [key, value] of Object.entries(newData)) {
        updatedData[key] = value;
    }

    // ✅ 5. Enhanced logging for merge analysis
    if (process.env.DEBUG_MQTT === 'true') {
        const updatedFields = Object.keys(newData);
        const preservedFields = Object.keys(recordData).filter(key => 
            !updatedFields.includes(key) && recordData[key] !== null
        );
        const nullFields = Object.keys(recordData).filter(key => 
            !updatedFields.includes(key) && recordData[key] === null
        );
        
        console.log(`   🔄 Updated by MQTT: [${updatedFields.join(', ')}]`);
        console.log(`   💾 Preserved non-null: [${preservedFields.join(', ')}]`);
        console.log(`   ⚠️ Remaining null: [${nullFields.join(', ')}]`);
        console.log(`   📊 Data completeness: ${(Object.keys(updatedData).length - nullFields.length)}/${Object.keys(recordData).length}`);
    }

    return updatedData;
}

// ✅ NEW: Create minimal record with only MQTT-provided fields
async function createMinimalRecord(tableName, mqttData) {
    console.log(`🆕 Creating minimal record for ${tableName} with only MQTT fields`);
    
    if (process.env.DEBUG_MQTT === 'true') {
        console.log(`   📥 MQTT fields: [${Object.keys(mqttData).join(', ')}]`);
        console.log(`   ⚠️ Other fields will remain NULL until populated`);
    }
    
    // ✅ Return ONLY the fields that MQTT provides
    // This prevents massive NULL field insertion
    return { ...mqttData };
}

// ✅ NEW: Smart insert function that only inserts non-null fields
async function insertDeviceRecord(tableName, data) {
    const deviceFields = [
        'voltage', 'current', 'power_operating', 'frequency', 'power_factor', 
        'operating_time', 'over_voltage_operating', 'over_current_operating',
        'over_power_operating', 'status_operating', 'under_voltage_operating', 
        'power_socket_status'
    ];
    
    console.log(`📝 [${tableName}] insertDeviceRecord called`);
    console.log(`   Input data:`, JSON.stringify(data));
    
    const fieldsToInsert = deviceFields.filter(field => 
        data[field] !== null && data[field] !== undefined
    );
    
    console.log(`   Fields to insert:`, fieldsToInsert);
    
    if (fieldsToInsert.length === 0) {
        console.error(`❌ [${tableName}] No valid fields to insert!`);
        console.error(`   Expected:`, deviceFields);
        console.error(`   Got:`, Object.keys(data));
        return null;
    }
    
    const fieldNames = fieldsToInsert.join(', ');
    const placeholders = fieldsToInsert.map((_, index) => {
        const field = fieldsToInsert[index];
        if (field === 'operating_time') return `$${index + 1}::interval`;
        if (['voltage', 'current', 'power_operating', 'frequency', 'power_factor'].includes(field)) {
            return `$${index + 1}::real`;
        }
        return `$${index + 1}`;
    }).join(', ');
    
    const query = `
        INSERT INTO ${tableName} (${fieldNames}, timestamp) 
        VALUES (${placeholders}, CURRENT_TIMESTAMP) 
        RETURNING id, timestamp
    `;
    
    const values = fieldsToInsert.map(field => data[field]);
    
    console.log(`   Query:`, query);
    console.log(`   Values:`, values);
    
    try {
        const result = await prisma.$queryRawUnsafe(query, ...values);
        console.log(`✅ [${tableName}] Insert success, ID:`, result[0]?.id);
        return result;
    } catch (error) {
        console.error(`❌ [${tableName}] Insert ERROR:`, error.message);
        console.error(`   Query:`, query);
        console.error(`   Values:`, values);
        console.error(`   Stack:`, error.stack);
        return null;
    }
}

// ✅ NEW: Smart insert for environment data
async function insertEnvironmentRecord(data) {
    const envFields = [
        'leak_current_ma', 'temperature_c', 'humidity_percent',
        'over_temperature', 'over_humidity', 'soft_warning', 
        'strong_warning', 'shutdown_warning'
    ];
    
    // Filter out null/undefined fields
    const fieldsToInsert = envFields.filter(field => 
        data[field] !== null && data[field] !== undefined
    );
    
    if (fieldsToInsert.length === 0) {
        console.warn(`⚠️ No valid fields to insert for iot_environment_status`);
        return null;
    }
    
    // Build dynamic query
    const fieldNames = fieldsToInsert.join(', ');
    const placeholders = fieldsToInsert.map((_, index) => {
        const field = fieldsToInsert[index];
        // Handle specific data types for environment
        if (['leak_current_ma', 'temperature_c', 'humidity_percent'].includes(field)) {
            return `$${index + 1}::real`;
        }
        return `$${index + 1}`;
    }).join(', ');
    
    const query = `
        INSERT INTO iot_environment_status (${fieldNames}, timestamp) 
        VALUES (${placeholders}, CURRENT_TIMESTAMP) 
        RETURNING id, timestamp
    `;
    
    const values = fieldsToInsert.map(field => data[field]);
    
    if (process.env.DEBUG_MQTT === 'true') {
        console.log(`📝 [iot_environment_status] Smart INSERT:`);
        console.log(`   📊 Fields: [${fieldsToInsert.join(', ')}]`);
        console.log(`   ❌ Skipped NULL: [${envFields.filter(f => !fieldsToInsert.includes(f)).join(', ')}]`);
    }
    
    return await prisma.$queryRawUnsafe(query, ...values);
}

async function createNewRecord(tableName, partialData) {
    // ✅ Fallback when no previous record exists
    console.log(`🆕 Creating new record for ${tableName} (no previous data)`);
    
    if (tableName === 'iot_environment_status') {
        return {
            leak_current_ma: partialData.leak_current_ma ?? null,
            temperature_c: partialData.temperature_c ?? null,
            humidity_percent: partialData.humidity_percent ?? null,
            over_temperature: partialData.over_temperature ?? null,
            over_humidity: partialData.over_humidity ?? null,
            soft_warning: partialData.soft_warning ?? null,
            strong_warning: partialData.strong_warning ?? null,
            shutdown_warning: partialData.shutdown_warning ?? null
        };
    } else {
        // Device tables
        return {
            voltage: partialData.voltage ?? null,
            current: partialData.current ?? null,
            power_operating: partialData.power_operating ?? null,
            frequency: partialData.frequency ?? null,
            power_factor: partialData.power_factor ?? null,
            operating_time: partialData.operating_time ?? null,
            over_voltage_operating: partialData.over_voltage_operating ?? null,
            over_current_operating: partialData.over_current_operating ?? null,
            over_power_operating: partialData.over_power_operating ?? null,
            status_operating: partialData.status_operating ?? null,
            under_voltage_operating: partialData.under_voltage_operating ?? null,
            power_socket_status: partialData.power_socket_status ?? null
        };
    }
}

// ==================== DEVICE DATA PROCESSOR ====================

async function processDeviceData(tableName, topicName, partialData) {
    try {
        if (!ALLOWED_TABLES.includes(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }

        console.log(`🔄 [${topicName}] Processing with DUPLICATE+UPDATE strategy`);
        
        const completeData = await duplicateAndUpdateRecord(tableName, partialData);
        
        // ✅ FIX 1: Check completeData có valid không
        const hasValidFields = Object.values(completeData).some(v => v !== null && v !== undefined);
        if (!hasValidFields) {
            console.error(`❌ [${topicName}] No valid data after merge!`);
            console.error(`   MQTT data:`, partialData);
            console.error(`   Complete data:`, completeData);
            return null; // Exit early
        }
        
        const result = await insertDeviceRecord(tableName, completeData);

        // ✅ FIX 2: Check result trước khi dùng
        if (!result || !result[0]) {
            console.error(`❌ [${topicName}] Insert failed - no record created`);
            console.error(`   Table:`, tableName);
            console.error(`   Data:`, completeData);
            return null; // Exit early
        }

        // ✅ Từ đây trở xuống mới safe
        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
        const allFields = Object.keys(completeData);
        const preservedFields = allFields.filter(key => 
            !changedFields.includes(key) && completeData[key] !== null
        );

        const warningFields = ['voltage', 'current', 'power_operating', 'frequency', 'power_factor'];
        const warningData = {};
        
        changedFields.forEach(field => {
            if (warningFields.includes(field)) {
                warningData[field] = completeData[field];
            }
        });

        if (Object.keys(warningData).length > 0) {
            try {
                await checkDeviceWarnings(tableName, warningData, result[0].id);
            } catch (warnError) {
                console.error(`⚠️ Warning check failed:`, warnError.message);
                // Don't throw, continue
            }
        }

        const deviceData = {
            id: result[0].id,
            tableName,
            data: completeData,
            changedFields,
            preservedFields,
            strategy: 'duplicate_update',
            timestamp: new Date().toISOString()
        };

        // ✅ FIX: Use correct socketService method
        socketService.broadcastMqttData(result[0].id, topicName, deviceData, {
            type: 'deviceUpdate',
            table: tableName,
            changed: changedFields,
            preserved: preservedFields.length
        });

        const preservationRatio = `${preservedFields.length}/${allFields.length}`;
        
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ [${topicName}] Record created:`);
            console.log(`   🆔 ID: ${result[0].id}`);
            console.log(`   🔄 Updated: [${changedFields.join(', ')}]`);
            console.log(`   💾 Preserved: [${preservedFields.join(', ')}]`);
            console.log(`   📊 Ratio: ${preservationRatio}`);
        } else {
            console.log(`✅ ${topicName} | Updated: [${changedFields.join(', ')}] | Preserved: ${preservationRatio}`);
        }

        return result[0];
        
    } catch (error) {
        console.error(`❌ Error processing ${topicName}:`, error);
        console.error(`   Stack:`, error.stack);
        // ✅ FIX 3: Không throw, để MQTT tiếp tục
        return null;
    }
}

// ==================== EXPORT FOR CONTROLLER USE ====================

/**
 * Export duplicate+update functions để controller có thể dùng chung logic
 */
export { 
    getLatestRecord, 
    duplicateAndUpdateRecord, 
    mergeWithRecord, 
    createMinimalRecord,
    insertDeviceRecord,
    insertEnvironmentRecord,
    ALLOWED_TABLES 
};

// ==================== TOPIC HANDLERS ====================

async function processAuoDisplayData(data) {
    await processDeviceData('auo_display', 'AUO Display', data);
}

async function processCameraControlData(data) {
    await processDeviceData('camera_control_unit', 'Camera Control Unit', data);
}

async function processElectronicData(data) {
    await processDeviceData('electronic_endoflator', 'Electronic Endoflator', data);
}

async function processLedNovaData(data) {
    await processDeviceData('led_nova_100', 'LED Nova', data);
}

async function processIotEnvData(partialData) {
    try {
        console.log(`🔄 [IoT Environment] Processing with DUPLICATE+UPDATE strategy`);
        
        // ✅ 1. Duplicate latest record and update with MQTT data
        const completeData = await duplicateAndUpdateRecord('iot_environment_status', partialData);

        // ✅ 2. Smart insert: only insert fields that have data
        const result = await insertEnvironmentRecord(completeData);

        // ✅ 3. Analyze what was updated vs preserved
        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
        const allFields = Object.keys(completeData);
        const preservedFields = allFields.filter(key => 
            !changedFields.includes(key) && completeData[key] !== null
        );

        // ✅ 4. Check warnings only for changed values
        const warningFields = ['leak_current_ma', 'temperature_c', 'humidity_percent'];
        const warningData = {};
        
        changedFields.forEach(field => {
            if (warningFields.includes(field)) {
                warningData[field] = completeData[field];
            }
        });

        if (Object.keys(warningData).length > 0) {
            await checkDeviceWarnings('iot_environment_status', warningData, result[0]?.id);
        }

        // ✅ 5. Socket.IO emission
        const envData = {
            id: result[0]?.id,
            tableName: 'iot_environment_status',
            data: completeData,
            changedFields,
            preservedFields,
            strategy: 'duplicate_update',
            timestamp: new Date().toISOString()
        };

        // ✅ FIX: Use correct socketService method
        socketService.broadcastMqttData('iot-environment', 'IoT Environment Status', envData, {
            type: 'environmentUpdate',
            changed: changedFields,
            preserved: preservedFields.length
        });

        // ✅ 6. Enhanced success logging
        const preservationRatio = `${preservedFields.length}/${allFields.length}`;

        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ [IoT Environment] Record created:`);
            console.log(`   🆔 ID: ${result[0]?.id}`);
            console.log(`   🔄 Updated: [${changedFields.join(', ')}]`);
            console.log(`   💾 Preserved: [${preservedFields.join(', ')}]`);
            console.log(`   📊 Ratio: ${preservationRatio}`);
        } else {
            console.log(`✅ IoT Environment | Updated: [${changedFields.join(', ')}] | Preserved: ${preservationRatio}`);
        }
    } catch (error) {
        console.error('❌ Error processing IoT Environment:', error);
    }
}

// ==================== MQTT EVENT HANDLERS ====================

client.on('connect', () => {
    console.log(`✅ MQTT connected: ${mqttConfig.host}:${mqttConfig.port}`);

    Object.values(topics).forEach(topic => {
        // Set QoS 1 for at-least-once delivery
        client.subscribe(topic, { qos: 1 }, (err) => {
            if (!err) {
                console.log(`📡 Subscribed: ${topic} (QoS: 1)`);
            } else {
                console.error(`❌ Subscribe error [${topic}]:`, err);
            }
        });
    });
});

client.on('message', async (topic, message) => {
    try {
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`📨 Received [${topic}]: ${message.toString()}`);
        }
        
        const data = JSON.parse(message.toString());

        switch (topic) {
            case topics.auoDisplay:
                await processAuoDisplayData(data);
                break;
            case topics.cameraControl:
                await processCameraControlData(data);
                break;
            case topics.electronic:
                await processElectronicData(data);
                break;
            case topics.ledNova:
                await processLedNovaData(data);
                break;
            case topics.iotEnv:
                await processIotEnvData(data);
                break;
            default:
                console.log(`⚠️  No handler for topic: ${topic}`);
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error(`❌ Invalid JSON on ${topic}:`, message.toString());
        } else {
            console.error(`❌ Error processing ${topic}:`, error.message);
        }
    }
});

client.on('error', (error) => {
    console.error('❌ MQTT client error:', error);
});

client.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
});

client.on('close', () => {
    console.log('🔌 MQTT connection closed');
});

client.on('offline', () => {
    console.log('📴 MQTT client offline');
});

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down MQTT client...');
    
    // Unsubscribe from all topics
    Object.values(topics).forEach(topic => {
        client.unsubscribe(topic);
    });
    
    // Close MQTT connection
    client.end(false, {}, () => {
        console.log('✅ MQTT disconnected');
    });
    
    // Close Prisma connection
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default client;