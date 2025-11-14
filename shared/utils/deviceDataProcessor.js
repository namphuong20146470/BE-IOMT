// utils/deviceDataProcessor.js
// Shared logic giữa MQTT và REST API

import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// ==================== CONFIGURATION ====================

const DEVICE_TABLES = {
    AUO_DISPLAY: 'auo_display',
    CAMERA_CONTROL: 'camera_control_unit',
    ELECTRONIC: 'electronic_endoflator',
    LED_NOVA: 'led_nova_100'
};

const DEVICE_SCHEMAS = {
    [DEVICE_TABLES.AUO_DISPLAY]: {
        fields: [
            'voltage', 'current', 'power_operating', 'frequency', 
            'power_factor', 'operating_time', 'over_voltage_operating',
            'over_current_operating', 'over_power_operating', 
            'status_operating', 'under_voltage_operating', 'power_socket_status'
        ],
        warningFields: ['voltage', 'current', 'power_operating', 'frequency', 'power_factor'],
        defaults: {
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
        }
    }
    // Add other devices...
};

// ==================== CORE FUNCTIONS ====================

/**
 * Get latest record within time window
 */
export async function getLatestRecord(tableName, timeWindowMinutes = 1) {
    // Validate table name to prevent SQL injection
    const validTables = Object.values(DEVICE_TABLES);
    if (!validTables.includes(tableName)) {
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
        throw error;
    }
}

/**
 * Merge partial data with latest record
 */
export function mergeDeviceData(tableName, latestRecord, newData) {
    const schema = DEVICE_SCHEMAS[tableName];
    if (!schema) {
        throw new Error(`Unknown device schema: ${tableName}`);
    }

    const { defaults } = schema;

    // If no latest record, use defaults + new data
    if (!latestRecord) {
        return {
            ...defaults,
            ...newData
        };
    }

    // Merge: new data > latest record > defaults
    const merged = {};
    for (const field of schema.fields) {
        merged[field] = newData[field] ?? latestRecord[field] ?? defaults[field];
    }

    return merged;
}

/**
 * Insert device data with merge logic
 * @param {string} tableName - Device table name
 * @param {object} partialData - Partial data from MQTT/API
 * @param {object} options - { merge: boolean, source: 'mqtt'|'api' }
 */
export async function insertDeviceData(tableName, partialData, options = {}) {
    const { merge = true, source = 'unknown' } = options;
    
    const schema = DEVICE_SCHEMAS[tableName];
    if (!schema) {
        throw new Error(`Unknown device schema: ${tableName}`);
    }

    try {
        // Get complete data
        let completeData;
        
        if (merge) {
            const latestRecord = await getLatestRecord(tableName);
            completeData = mergeDeviceData(tableName, latestRecord, partialData);
        } else {
            // No merge - use defaults for missing fields
            completeData = {
                ...schema.defaults,
                ...partialData
            };
        }

        // Build dynamic insert query
        const fields = schema.fields;
        const values = fields.map(field => completeData[field]);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        
        // Type casting for specific fields
        const typeCasts = fields.map((field, i) => {
            if (field === 'operating_time') return `$${i + 1}::interval`;
            if (['voltage', 'current', 'power_operating', 'frequency', 'power_factor'].includes(field)) {
                return `$${i + 1}::real`;
            }
            return `$${i + 1}`;
        }).join(', ');

        const query = `
            INSERT INTO ${tableName} (
                ${fields.join(', ')},
                timestamp
            ) VALUES (
                ${typeCasts},
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const result = await prisma.$queryRawUnsafe(query, ...values);
        const insertedId = result[0]?.id;

        // Check warnings only for changed fields
        const changedFields = Object.keys(partialData).filter(key => key !== 'timestamp');
        const warningData = {};
        
        changedFields.forEach(field => {
            if (schema.warningFields.includes(field)) {
                warningData[field] = completeData[field];
            }
        });

        if (Object.keys(warningData).length > 0) {
            await checkDeviceWarnings(tableName, warningData, insertedId);
        }

        return {
            success: true,
            id: insertedId,
            changedFields,
            source,
            merged: merge
        };

    } catch (error) {
        console.error(`Error inserting data to ${tableName}:`, error);
        throw error;
    }
}

// ==================== VALIDATION ====================

export function validateDeviceData(tableName, data) {
    const schema = DEVICE_SCHEMAS[tableName];
    if (!schema) {
        return { valid: false, error: `Unknown device: ${tableName}` };
    }

    // Check if at least one field is provided
    const providedFields = Object.keys(data).filter(key => 
        schema.fields.includes(key) && data[key] !== undefined
    );

    if (providedFields.length === 0) {
        return { 
            valid: false, 
            error: 'At least one field is required',
            allowedFields: schema.fields
        };
    }

    // Validate field types
    for (const field of providedFields) {
        const value = data[field];
        
        // Number fields
        if (['voltage', 'current', 'power_operating', 'frequency', 'power_factor'].includes(field)) {
            if (typeof value !== 'number' || isNaN(value)) {
                return { valid: false, error: `${field} must be a number` };
            }
        }
        
        // Boolean fields
        if (field.includes('over_') || field.includes('status') || field.includes('warning')) {
            if (typeof value !== 'boolean') {
                return { valid: false, error: `${field} must be a boolean` };
            }
        }
    }

    return { valid: true };
}

export { DEVICE_TABLES, DEVICE_SCHEMAS };