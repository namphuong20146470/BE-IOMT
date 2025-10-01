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
        const query = `
            SELECT * FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${timeWindowMinutes} minutes'
            ORDER BY timestamp DESC
            LIMIT 1
        `;
        
        const result = await prisma.$queryRawUnsafe(query);
        return result[0] || null;
    } catch (error) {
        console.error(`Error getting latest record from ${tableName}:`, error);
        return null;
    }
}

function mergeDeviceData(latestRecord, newData) {
    // ✅ FIX: NO DEFAULTS - preserve all existing values
    
    if (!latestRecord) {
        // ⚠️ EDGE CASE: No previous record exists
        // Initialize with received data only, leave other fields NULL/unset
        console.warn('⚠️ No previous record found, initializing with partial data only');
        return {
            voltage: newData.voltage ?? null,
            current: newData.current ?? null,
            power_operating: newData.power_operating ?? null,
            frequency: newData.frequency ?? null,
            power_factor: newData.power_factor ?? null,
            operating_time: newData.operating_time ?? null,
            over_voltage_operating: newData.over_voltage_operating ?? null,
            over_current_operating: newData.over_current_operating ?? null,
            over_power_operating: newData.over_power_operating ?? null,
            status_operating: newData.status_operating ?? null,
            under_voltage_operating: newData.under_voltage_operating ?? null,
            power_socket_status: newData.power_socket_status ?? null
        };
    }

    // ✅ PROPER DELTA MERGE: newData overrides, existing values preserved
    return {
        voltage: newData.voltage !== undefined ? newData.voltage : latestRecord.voltage,
        current: newData.current !== undefined ? newData.current : latestRecord.current,
        power_operating: newData.power_operating !== undefined ? newData.power_operating : latestRecord.power_operating,
        frequency: newData.frequency !== undefined ? newData.frequency : latestRecord.frequency,
        power_factor: newData.power_factor !== undefined ? newData.power_factor : latestRecord.power_factor,
        operating_time: newData.operating_time !== undefined ? newData.operating_time : latestRecord.operating_time,
        over_voltage_operating: newData.over_voltage_operating !== undefined ? newData.over_voltage_operating : latestRecord.over_voltage_operating,
        over_current_operating: newData.over_current_operating !== undefined ? newData.over_current_operating : latestRecord.over_current_operating,
        over_power_operating: newData.over_power_operating !== undefined ? newData.over_power_operating : latestRecord.over_power_operating,
        status_operating: newData.status_operating !== undefined ? newData.status_operating : latestRecord.status_operating,
        under_voltage_operating: newData.under_voltage_operating !== undefined ? newData.under_voltage_operating : latestRecord.under_voltage_operating,
        power_socket_status: newData.power_socket_status !== undefined ? newData.power_socket_status : latestRecord.power_socket_status
    };
}

function mergeEnvironmentData(latestRecord, newData) {
    if (!latestRecord) {
        // ⚠️ EDGE CASE: No previous record exists
        console.warn('⚠️ No previous environment record found, initializing with partial data only');
        return {
            leak_current_ma: newData.leak_current_ma ?? null,
            temperature_c: newData.temperature_c ?? null,
            humidity_percent: newData.humidity_percent ?? null,
            over_temperature: newData.over_temperature ?? null,
            over_humidity: newData.over_humidity ?? null,
            soft_warning: newData.soft_warning ?? null,
            strong_warning: newData.strong_warning ?? null,
            shutdown_warning: newData.shutdown_warning ?? null
        };
    }

    // ✅ PROPER DELTA MERGE: preserve existing values
    return {
        leak_current_ma: newData.leak_current_ma !== undefined ? newData.leak_current_ma : latestRecord.leak_current_ma,
        temperature_c: newData.temperature_c !== undefined ? newData.temperature_c : latestRecord.temperature_c,
        humidity_percent: newData.humidity_percent !== undefined ? newData.humidity_percent : latestRecord.humidity_percent,
        over_temperature: newData.over_temperature !== undefined ? newData.over_temperature : latestRecord.over_temperature,
        over_humidity: newData.over_humidity !== undefined ? newData.over_humidity : latestRecord.over_humidity,
        soft_warning: newData.soft_warning !== undefined ? newData.soft_warning : latestRecord.soft_warning,
        strong_warning: newData.strong_warning !== undefined ? newData.strong_warning : latestRecord.strong_warning,
        shutdown_warning: newData.shutdown_warning !== undefined ? newData.shutdown_warning : latestRecord.shutdown_warning
    };
}

// ==================== DEVICE DATA PROCESSOR ====================

async function processDeviceData(tableName, topicName, partialData) {
    try {
        // Validate table name
        if (!ALLOWED_TABLES.includes(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }

        // Get latest record
        const latestRecord = await getLatestRecord(tableName);
        
        // Merge data
        const completeData = mergeDeviceData(latestRecord, partialData);
        
        // Insert new record
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
            ) RETURNING id
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

        // Check warnings only for changed values
        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
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

        // 🔥 Emit real-time data to Socket.IO clients
        const deviceData = {
            id: result[0]?.id,
            tableName,
            data: completeData,
            changedFields,
            timestamp: new Date().toISOString()
        };

        // Emit to device-specific room
        socketService.emitToRoom(`device_${tableName}`, 'deviceDataUpdate', deviceData);

        // Emit to all devices room for overview dashboard
        socketService.emitToRoom('all_devices', 'deviceDataUpdate', deviceData);

        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ ${topicName} saved | Changed: [${changedFields.join(', ')}] | Emitted to Socket.IO`);
        }

        return result[0];
    } catch (error) {
        console.error(`❌ Error saving ${topicName}:`, error);
        throw error;
    }
}

// ==================== EXPORT FOR CONTROLLER USE ====================

/**
 * Export merge functions để controller có thể dùng chung logic
 */
export { getLatestRecord, mergeDeviceData, mergeEnvironmentData, ALLOWED_TABLES };

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
        const latestRecord = await getLatestRecord('iot_environment_status');
        const completeData = mergeEnvironmentData(latestRecord, partialData);

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
            ) RETURNING id
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

        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
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

        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ IoT Environment saved | Changed: [${changedFields.join(', ')}]`);
        }
    } catch (error) {
        console.error('❌ Error saving IoT Environment:', error);
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