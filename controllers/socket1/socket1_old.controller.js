// Socket 1 Controller (Tang 3 PKT - Socket 1)
// Manages socket1_data table for electrical measurements
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

export const getAuoDisplayData = async (req, res) => {
    try {
        const {
            range,           // '1h', '6h', '24h', '7d', '30d'
            startDate,
            endDate,
            groupBy,         // 'minute', 'hour', 'day'
            aggregation = 'avg',
            page = 1,
            limit = 1000,
            latest = false
        } = req.query;

        // Case 1: Get latest record
        if (latest === 'true') {
            const latestRecord = await prisma.$queryRaw`
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
                FROM socket1_data
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            if (!latestRecord || latestRecord.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No records found'
                });
            }

            return res.status(200).json({
                success: true,
                data: latestRecord[0],
                message: 'Latest record retrieved'
            });
        }

        // Build time filter
        let timeFilter = '';
        let timeFilterParams = [];
        let paramIndex = 1;

        if (range) {
            const interval = parseTimeRange(range);
            if (!interval) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid range. Use: 1h, 6h, 24h, 7d, 30d'
                });
            }
            timeFilter = `WHERE timestamp >= NOW() - INTERVAL '${interval}'`;
        } else if (startDate && endDate) {
            timeFilter = `WHERE timestamp >= $${paramIndex}::timestamp AND timestamp <= $${paramIndex + 1}::timestamp`;
            timeFilterParams.push(startDate, endDate);
            paramIndex += 2;
        }

        // Case 2: Aggregated data
        if (groupBy) {
            const interval = getTimeGroupInterval(groupBy);
            if (!interval) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid groupBy. Use: minute, hour, day, 1m, 1h, 1d'
                });
            }

            const query = `
                SELECT 
                    date_trunc('${interval}', timestamp) as timestamp,
                    COUNT(*) as record_count,
                    AVG(voltage)::numeric(10,2) as avg_voltage,
                    MIN(voltage)::numeric(10,2) as min_voltage,
                    MAX(voltage)::numeric(10,2) as max_voltage,
                    AVG(current)::numeric(10,3) as avg_current,
                    MIN(current)::numeric(10,3) as min_current,
                    MAX(current)::numeric(10,3) as max_current,
                    AVG(power)::numeric(10,2) as avg_power,
                    MIN(power)::numeric(10,2) as min_power,
                    MAX(power)::numeric(10,2) as max_power,
                    AVG(frequency)::numeric(10,2) as avg_frequency,
                    AVG(power_factor)::numeric(10,2) as avg_power_factor,
                    BOOL_OR(machine_state) as any_machine_active,
                    BOOL_OR(socket_state) as any_socket_active,
                    BOOL_OR(sensor_state) as any_sensor_active,
                    BOOL_OR(over_voltage) as any_over_voltage,
                    BOOL_OR(under_voltage) as any_under_voltage,
                    to_char(date_trunc('${interval}', timestamp), 'YYYY-MM-DD HH24:MI:SS') as formatted_time
                FROM socket1_data 
                ${timeFilter}
                GROUP BY date_trunc('${interval}', timestamp)
                ORDER BY date_trunc('${interval}', timestamp) DESC
                LIMIT $${paramIndex}
            `;

            timeFilterParams.push(parseInt(limit));
            const data = await prisma.$queryRawUnsafe(query, ...timeFilterParams);

            return res.status(200).json({
                success: true,
                data,
                metadata: {
                    total: data.length,
                    groupBy,
                    aggregation,
                    range: range || null,
                    timeRange: startDate && endDate ? { start: startDate, end: endDate } : null
                },
                message: 'Aggregated data retrieved successfully'
            });
        }

        // Case 3: Raw data with pagination
        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM socket1_data 
            ${timeFilter}
        `;

        const totalResult = await prisma.$queryRawUnsafe(countQuery, ...timeFilterParams);
        const total = parseInt(totalResult[0].total);

        const dataQuery = `
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
            FROM socket1_data
            ${timeFilter}
            ORDER BY timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        timeFilterParams.push(parseInt(limit), offset);
        const data = await prisma.$queryRawUnsafe(dataQuery, ...timeFilterParams);

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            },
            metadata: {
                range: range || null,
                timeRange: startDate && endDate ? { start: startDate, end: endDate } : null
            },
            message: 'Data retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching AUO display data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve data',
            error: error.message
        });
    }
};

// ==================== ADD DATA (for MQTT) ====================

export const addAuoDisplay = async (req, res) => {
    try {
        const {
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
        } = req.body;

        // Validate at least one field
        if (!voltage && !current && !power) {
            return res.status(400).json({
                success: false,
                message: 'At least one field is required'
            });
        }

        const result = await prisma.$queryRaw`
            INSERT INTO socket1_data (
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
                ${voltage || null}::real, 
                ${current || null}::real, 
                ${power || null}::real, 
                ${frequency || null}::real, 
                ${power_factor || null}::real, 
                ${machine_state || false}::boolean,
                ${socket_state || false}::boolean,
                ${sensor_state || false}::boolean,
                ${over_voltage || false}::boolean,
                ${under_voltage || false}::boolean,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        // Check warnings for provided fields only
        const warningData = {};
        if (voltage !== undefined) warningData.voltage = voltage;
        if (current !== undefined) warningData.current = current;
        if (power !== undefined) warningData.power = power;
        if (frequency !== undefined) warningData.frequency = frequency;
        if (power_factor !== undefined) warningData.power_factor = power_factor;
        if (over_voltage !== undefined) warningData.over_voltage = over_voltage;
        if (under_voltage !== undefined) warningData.under_voltage = under_voltage;

        if (Object.keys(warningData).length > 0) {
            await checkDeviceWarnings('socket1_data', warningData, result[0].id);
        }

        return res.status(201).json({
            success: true,
            message: 'Data added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        console.error('Error adding AUO display data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add data',
            error: error.message
        });
    }
};

// ==================== LEGACY ENDPOINTS (backward compatibility) ====================

export const getAllAuoDisplay = (req, res) => {
    req.query.limit = req.query.limit || 1000;
    return getAuoDisplayData(req, res);
};

export const getLatestAuoDisplay = (req, res) => {
    req.query.latest = 'true';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplay1Hour = (req, res) => {
    req.query.range = '1h';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplay6Hours = (req, res) => {
    req.query.range = '6h';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplay24Hours = (req, res) => {
    req.query.range = '24h';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplay7Days = (req, res) => {
    req.query.range = '7d';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplay30Days = (req, res) => {
    req.query.range = '30d';
    return getAuoDisplayData(req, res);
};

export const getAuoDisplayByDateRange = getAuoDisplayData;

// ==================== SOCKET 1 ALIASES ====================
// Tang 3 PKT Socket 1 endpoints (socket1_data table)
export const getAllSocket1 = getAllAuoDisplay;
export const getLatestSocket1 = getLatestAuoDisplay;
export const addSocket1 = addAuoDisplay;
export const getSocket11Hour = getAuoDisplay1Hour;
export const getSocket16Hours = getAuoDisplay6Hours;
export const getSocket124Hours = getAuoDisplay24Hours;
export const getSocket17Days = getAuoDisplay7Days;
export const getSocket130Days = getAuoDisplay30Days;
export const getSocket1ByDateRange = getAuoDisplayByDateRange;
