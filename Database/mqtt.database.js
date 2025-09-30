import mqtt from 'mqtt';
import { PrismaClient, Prisma } from '@prisma/client';
import { checkDeviceWarnings } from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

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
    const defaults = {
        voltage: 0,
        current: 0,
        power_operating: 0,
        frequency: 0,
        power_factor: 0,
        operating_time: '00:00:00',
        over_voltage_operating: false,
        over_current_operating: false,
        over_power_operating: false,
        status_operating: false,
        under_voltage_operating: false,
        power_socket_status: false
    };

    if (!latestRecord) {
        return {
            ...defaults,
            ...newData
        };
    }

    // Merge: prioritize new data, fallback to latest record
    return {
        voltage: newData.voltage ?? latestRecord.voltage ?? defaults.voltage,
        current: newData.current ?? latestRecord.current ?? defaults.current,
        power_operating: newData.power_operating ?? latestRecord.power_operating ?? defaults.power_operating,
        frequency: newData.frequency ?? latestRecord.frequency ?? defaults.frequency,
        power_factor: newData.power_factor ?? latestRecord.power_factor ?? defaults.power_factor,
        operating_time: newData.operating_time ?? latestRecord.operating_time ?? defaults.operating_time,
        over_voltage_operating: newData.over_voltage_operating ?? latestRecord.over_voltage_operating ?? defaults.over_voltage_operating,
        over_current_operating: newData.over_current_operating ?? latestRecord.over_current_operating ?? defaults.over_current_operating,
        over_power_operating: newData.over_power_operating ?? latestRecord.over_power_operating ?? defaults.over_power_operating,
        status_operating: newData.status_operating ?? latestRecord.status_operating ?? defaults.status_operating,
        under_voltage_operating: newData.under_voltage_operating ?? latestRecord.under_voltage_operating ?? defaults.under_voltage_operating,
        power_socket_status: newData.power_socket_status ?? latestRecord.power_socket_status ?? defaults.power_socket_status
    };
}

function mergeEnvironmentData(latestRecord, newData) {
    const defaults = {
        leak_current_ma: 0,
        temperature_c: 0,
        humidity_percent: 0,
        over_temperature: false,
        over_humidity: false,
        soft_warning: false,
        strong_warning: false,
        shutdown_warning: false
    };

    if (!latestRecord) {
        return {
            ...defaults,
            ...newData
        };
    }

    return {
        leak_current_ma: newData.leak_current_ma ?? latestRecord.leak_current_ma ?? defaults.leak_current_ma,
        temperature_c: newData.temperature_c ?? latestRecord.temperature_c ?? defaults.temperature_c,
        humidity_percent: newData.humidity_percent ?? latestRecord.humidity_percent ?? defaults.humidity_percent,
        over_temperature: newData.over_temperature ?? latestRecord.over_temperature ?? defaults.over_temperature,
        over_humidity: newData.over_humidity ?? latestRecord.over_humidity ?? defaults.over_humidity,
        soft_warning: newData.soft_warning ?? latestRecord.soft_warning ?? defaults.soft_warning,
        strong_warning: newData.strong_warning ?? latestRecord.strong_warning ?? defaults.strong_warning,
        shutdown_warning: newData.shutdown_warning ?? latestRecord.shutdown_warning ?? defaults.shutdown_warning
    };
}

// ==================== DEVICE DATA PROCESSOR ====================

async function processDeviceData(tableName, topicName, partialData) {
    try {
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

        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`✅ ${topicName} saved | Changed: [${changedFields.join(', ')}]`);
        }

        return result[0];
    } catch (error) {
        console.error(`❌ Error saving ${topicName}:`, error);
        throw error;
    }
}

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
    console.log(`MQTT client connected to ${mqttConfig.host}:${mqttConfig.port}`);

    Object.values(topics).forEach(topic => {
        client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`Subscribed to ${topic}`);
            } else {
                console.error(`Error subscribing to ${topic}:`, err);
            }
        });
    });
});

client.on('message', async (topic, message) => {
    try {
        if (process.env.DEBUG_MQTT === 'true') {
            console.log(`Received on ${topic}: ${message.toString()}`);
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
                console.log(`No handler for topic ${topic}`);
        }
    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

client.on('error', (error) => {
    console.error('MQTT client error:', error);
});

client.on('reconnect', () => {
    console.log('MQTT client reconnecting...');
});

client.on('close', () => {
    console.log('MQTT connection closed');
});

export default client;
