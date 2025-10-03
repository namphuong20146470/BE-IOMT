import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
import socketService from '../services/socketService.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

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
    // Validate table name (prevent SQL injection)
    if (!ALLOWED_TABLES.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
    }

    try {
        // ✅ IMPROVED: Get latest record within reasonable time window
        // If no recent record, get the absolute latest regardless of time
        let query = `
            SELECT * FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${timeWindowMinutes} minutes'
            ORDER BY timestamp DESC
            LIMIT 1
        `;
        
        let result = await prisma.$queryRawUnsafe(query);
        
        // ✅ Fallback: If no recent record, get absolute latest (up to 24h)
        if (!result[0]) {
            console.warn(`⚠️ No record in ${timeWindowMinutes}min window, trying 24h fallback for ${tableName}`);
            query = `
                SELECT * FROM ${tableName}
                WHERE timestamp >= NOW() - INTERVAL '24 hours'
                ORDER BY timestamp DESC
                LIMIT 1
            `;
            result = await prisma.$queryRawUnsafe(query);
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
        const latestRecord = await getLatestRecord(tableName, 60); // 60min window
        
        if (!latestRecord) {
            console.warn(`⚠️ No previous record found for ${tableName}, creating new record with partial data`);
            return createNewRecord(tableName, newData);
        }

        // ✅ 2. Log duplicate strategy
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`🔄 [${tableName}] DUPLICATE + UPDATE strategy:`);
            console.log(`   📋 Source record ID: ${latestRecord.id}`);
            console.log(`   📥 MQTT updates:`, Object.keys(newData));
            console.log(`   ⏰ Source timestamp: ${latestRecord.timestamp}`);
        }

        // ✅ 3. DUPLICATE entire record structure (exclude id, timestamp)
        const { id, timestamp, ...recordData } = latestRecord;
        
        // ✅ 4. UPDATE only fields provided by MQTT
        const updatedData = {
            ...recordData,  // 🎯 ALL existing data duplicated
            ...newData      // 🎯 Only MQTT fields updated
        };

        // ✅ 5. Log what's preserved vs updated
        if (process.env.DEBUG_MQTT === 'true') {
            const updatedFields = Object.keys(newData);
            const preservedFields = Object.keys(recordData).filter(key => 
                !updatedFields.includes(key) && recordData[key] !== null
            );
            console.log(`   🔄 Updated fields: [${updatedFields.join(', ')}]`);
            console.log(`   💾 Preserved fields: [${preservedFields.join(', ')}]`);
            console.log(`   📊 Preservation ratio: ${preservedFields.length}/${Object.keys(recordData).length}`);
        }

        return updatedData;
    } catch (error) {
        console.error(`❌ Error in duplicate+update for ${tableName}:`, error);
        throw error;
    }
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
        // Validate table name
        if (!ALLOWED_TABLES.includes(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }

        // ✅ NEW STRATEGY: Duplicate + Update
        console.log(`� [${topicName}] Processing with DUPLICATE+UPDATE strategy`);
        
        // ✅ 1. Duplicate latest record and update with MQTT data
        const completeData = await duplicateAndUpdateRecord(tableName, partialData);
        
        // ✅ 2. Insert the duplicated+updated record
        const query = `
            INSERT INTO ${tableName} (
                voltage, 
                current, 
                power_operating, 
                frequency, 
                power_factor, 
                operating_time,
                over_voltage_operating,
                over_current_operating,
                over_power_operating,
                status_operating,
                under_voltage_operating,
                power_socket_status,
                timestamp
            ) VALUES (
                $1::real, 
                $2::real, 
                $3::real, 
                $4::real, 
                $5::real, 
                $6::interval,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                CURRENT_TIMESTAMP
            ) RETURNING id, timestamp
        `;

        const result = await prisma.$queryRawUnsafe(
            query,
            completeData.voltage,
            completeData.current,
            completeData.power_operating,
            completeData.frequency,
            completeData.power_factor,
            completeData.operating_time,
            completeData.over_voltage_operating,
            completeData.over_current_operating,
            completeData.over_power_operating,
            completeData.status_operating,
            completeData.under_voltage_operating,
            completeData.power_socket_status
        );

        // ✅ 3. Analyze what was updated vs preserved
        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
        const allFields = Object.keys(completeData);
        const preservedFields = allFields.filter(key => 
            !changedFields.includes(key) && completeData[key] !== null
        );

        // ✅ 4. Check warnings only for changed values
        const warningFields = ['voltage', 'current', 'power_operating', 'frequency', 'power_factor'];
        const warningData = {};
        
        changedFields.forEach(field => {
            if (warningFields.includes(field)) {
                warningData[field] = completeData[field];
            }
        });

        if (Object.keys(warningData).length > 0) {
            await checkDeviceWarnings(tableName, warningData, result[0]?.id);
        }

        // ✅ 5. Socket.IO emission
        const deviceData = {
            id: result[0]?.id,
            tableName,
            data: completeData,
            changedFields,
            preservedFields,
            strategy: 'duplicate_update',
            timestamp: new Date().toISOString()
        };

        // Emit to device-specific room
        socketService.emitToRoom(`device_${tableName}`, 'deviceDataUpdate', deviceData);
        socketService.emitToRoom('all_devices', 'deviceDataUpdate', deviceData);

        // ✅ 6. Enhanced success logging
        const preservationRatio = `${preservedFields.length}/${allFields.length}`;
        
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ [${topicName}] Record created:`);
            console.log(`   🆔 ID: ${result[0]?.id}`);
            console.log(`   🔄 Updated: [${changedFields.join(', ')}]`);
            console.log(`   💾 Preserved: [${preservedFields.join(', ')}]`);
            console.log(`   📊 Ratio: ${preservationRatio}`);
        } else {
            console.log(`✅ ${topicName} | Updated: [${changedFields.join(', ')}] | Preserved: ${preservationRatio}`);
        }

        return result[0];
    } catch (error) {
        console.error(`❌ Error processing ${topicName}:`, error);
        throw error;
    }
}

// ==================== EXPORT FOR CONTROLLER USE ====================

/**
 * Export duplicate+update functions để controller có thể dùng chung logic
 */
export { getLatestRecord, duplicateAndUpdateRecord, createNewRecord, ALLOWED_TABLES };

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

        // ✅ 2. Insert the duplicated+updated record
        const query = `
            INSERT INTO iot_environment_status (
                leak_current_ma,
                temperature_c,
                humidity_percent,
                over_temperature,
                over_humidity,
                soft_warning,
                strong_warning,
                shutdown_warning,
                timestamp
            ) VALUES (
                $1::real,
                $2::real,
                $3::real,
                $4,
                $5,
                $6,
                $7,
                $8,
                CURRENT_TIMESTAMP
            ) RETURNING id, timestamp
        `;

        const result = await prisma.$queryRawUnsafe(
            query,
            completeData.leak_current_ma,
            completeData.temperature_c,
            completeData.humidity_percent,
            completeData.over_temperature,
            completeData.over_humidity,
            completeData.soft_warning,
            completeData.strong_warning,
            completeData.shutdown_warning
        );

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

        socketService.emitToRoom('device_iot_environment_status', 'deviceDataUpdate', envData);
        socketService.emitToRoom('all_devices', 'deviceDataUpdate', envData);

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