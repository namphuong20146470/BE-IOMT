// Socket 3 Controller (Tang 3 PKT - Socket 3)
// Manages socket3_data table for electrical measurements from hopt/tang3/pkt/socket3
import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// ==================== HELPER FUNCTIONS ====================

function getTimeGroupInterval(groupBy) {
    const intervalMap = {
        'minute': 'minute',
        'hour': 'hour', 
        'day': 'day',
        'week': 'week',
        'month': 'month',
        '1m': 'minute',
        '5m': 'minute',
        '15m': 'minute',
        '1h': 'hour',
        '6h': 'hour',
        '1d': 'day',
        '1w': 'week',
        '1M': 'month'
    };
    
    return intervalMap[groupBy] || null;
}

function parseTimeRange(range) {
    const rangeMap = {
        '1h': '1 hour',
        '6h': '6 hours',
        '24h': '24 hours',
        '1d': '1 day',
        '7d': '7 days',
        '30d': '30 days',
        '1w': '1 week',
        '1m': '1 month'
    };
    
    return rangeMap[range] || null;
}

// ==================== UNIFIED QUERY FUNCTION ====================

export const getSocket3Data = async (req, res) => {
    try {
        const {
            range,           // '1h', '6h', '24h', '7d', '30d'
            startDate,
            endDate,
            groupBy = 'hour' // 'minute', 'hour', 'day', 'week', 'month'
        } = req.query;

        let query;
        let queryParams = [];

        if (range) {
            // Predefined time range
            const timeRange = parseTimeRange(range);
            if (!timeRange) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid range parameter'
                });
            }

            const timeInterval = getTimeGroupInterval(groupBy);
            if (!timeInterval) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid groupBy parameter'
                });
            }

            query = `
                SELECT 
                    date_trunc($1, timestamp) as time_group,
                    AVG(voltage) as avg_voltage,
                    AVG(current) as avg_current,
                    AVG(power) as avg_power,
                    AVG(frequency) as avg_frequency,
                    AVG(power_factor) as avg_power_factor,
                    COUNT(*) as record_count,
                    BOOL_OR(machine_state) as any_machine_active,
                    BOOL_OR(socket_state) as any_socket_active,
                    BOOL_OR(sensor_state) as any_sensor_active,
                    BOOL_OR(over_voltage) as any_over_voltage,
                    BOOL_OR(under_voltage) as any_under_voltage,
                    MIN(timestamp) as period_start,
                    MAX(timestamp) as period_end
                FROM socket3_data 
                WHERE timestamp >= NOW() - INTERVAL $2
                GROUP BY date_trunc($1, timestamp)
                ORDER BY time_group DESC
                LIMIT 1000
            `;
            queryParams = [timeInterval, timeRange];
        } else if (startDate && endDate) {
            // Custom date range
            const timeInterval = getTimeGroupInterval(groupBy);
            if (!timeInterval) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid groupBy parameter'
                });
            }

            query = `
                SELECT 
                    date_trunc($1, timestamp) as time_group,
                    AVG(voltage) as avg_voltage,
                    AVG(current) as avg_current,
                    AVG(power) as avg_power,
                    AVG(frequency) as avg_frequency,
                    AVG(power_factor) as avg_power_factor,
                    COUNT(*) as record_count,
                    BOOL_OR(machine_state) as any_machine_active,
                    BOOL_OR(socket_state) as any_socket_active,
                    BOOL_OR(sensor_state) as any_sensor_active,
                    BOOL_OR(over_voltage) as any_over_voltage,
                    BOOL_OR(under_voltage) as any_under_voltage,
                    MIN(timestamp) as period_start,
                    MAX(timestamp) as period_end
                FROM socket3_data
                WHERE timestamp >= $2::timestamp 
                    AND timestamp <= $3::timestamp
                GROUP BY date_trunc($1, timestamp)
                ORDER BY time_group DESC
            `;
            queryParams = [timeInterval, startDate, endDate];
        } else {
            // All records without grouping
            query = `
                SELECT 
                    id,
                    voltage,
                    current,
                    power,
                    frequency,
                    power_factor,
                    machine_state,
                    socket_state,
                    sensor_state,
                    over_voltage,
                    under_voltage,
                    timestamp,
                    to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
                FROM socket3_data
                ORDER BY timestamp DESC
                LIMIT 500
            `;
        }

        const socket3Data = await prisma.$queryRawUnsafe(query, ...queryParams);

        return res.status(200).json({
            success: true,
            data: socket3Data,
            count: socket3Data.length,
            query_info: {
                range: range || `${startDate} to ${endDate}`,
                groupBy: groupBy,
                table: 'socket3_data'
            },
            message: 'Successfully retrieved Socket 3 data'
        });
    } catch (error) {
        console.error('Error fetching Socket 3 data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Socket 3 data',
            error: error.message
        });
    }
};

// ==================== MAIN EXPORT FUNCTIONS ====================

// Get all socket3 data
export const getAllSocket3 = (req, res) => getSocket3Data(req, res);

// Get latest socket3 record
export const getLatestSocket3 = async (req, res) => {
    try {
        const latestSocket3 = await prisma.$queryRaw`
            SELECT 
                id,
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            ORDER BY timestamp DESC
            LIMIT 1
        `;

        return res.status(200).json({
            success: true,
            data: latestSocket3[0] || null,
            message: 'Successfully retrieved latest Socket 3 data'
        });
    } catch (error) {
        console.error('Error fetching latest Socket 3 data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest Socket 3 data',
            error: error.message
        });
    }
};

// Add new socket3 data
export const addSocket3 = async (req, res) => {
    try {
        const {
            voltage,
            current,
            power,
            frequency,
            power_factor,
            machine_state = false,
            socket_state = false,
            sensor_state = false,
            over_voltage = false,
            under_voltage = false
        } = req.body;

        // Validate required fields
        if (voltage === undefined || current === undefined || power === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: voltage, current, power'
            });
        }

        const result = await prisma.$queryRaw`
            INSERT INTO socket3_data (
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage,
                timestamp
            ) VALUES (
                ${voltage}::real,
                ${current}::real,
                ${power}::real,
                ${frequency}::real,
                ${power_factor}::real,
                ${machine_state}::boolean,
                ${socket_state}::boolean,
                ${sensor_state}::boolean,
                ${over_voltage}::boolean,
                ${under_voltage}::boolean,
                CURRENT_TIMESTAMP
            )
            RETURNING id, timestamp
        `;

        // Check for warnings
        await checkDeviceWarnings('socket3_data', {
            voltage,
            current,
            power,
            frequency,
            power_factor,
            over_voltage,
            under_voltage
        }, result[0].id);

        return res.status(201).json({
            success: true,
            message: 'Socket 3 data added successfully',
            data: {
                id: result[0].id,
                timestamp: result[0].timestamp,
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage
            }
        });
    } catch (error) {
        console.error('Error adding Socket 3 data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add Socket 3 data',
            error: error.message
        });
    }
};

// ==================== TIME RANGE FUNCTIONS ====================

export const getSocket31Hour = (req, res) => {
    req.query.range = '1h';
    return getSocket3Data(req, res);
};

export const getSocket36Hours = (req, res) => {
    req.query.range = '6h';
    return getSocket3Data(req, res);
};

export const getSocket324Hours = (req, res) => {
    req.query.range = '24h';
    return getSocket3Data(req, res);
};

export const getSocket37Days = (req, res) => {
    req.query.range = '7d';
    return getSocket3Data(req, res);
};

export const getSocket330Days = (req, res) => {
    req.query.range = '30d';
    return getSocket3Data(req, res);
};

export const getSocket3ByDateRange = getSocket3Data;

// ==================== BACKWARD COMPATIBILITY ALIASES ====================
// Maintain compatibility with old function names
export const getAllLedNova = getAllSocket3;
export const getLatestLedNova = getLatestSocket3;
export const addLedNova = addSocket3;
export const getLedNova1Hour = getSocket31Hour;
export const getLedNova6Hours = getSocket36Hours;
export const getLedNova24Hours = getSocket324Hours;
export const getLedNova7Days = getSocket37Days;
export const getLedNova30Days = getSocket330Days;
export const getLedNovaByDateRange = getSocket3ByDateRange;