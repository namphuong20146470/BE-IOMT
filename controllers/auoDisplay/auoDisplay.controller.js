import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

/**
 * Helper function to convert groupBy parameter to PostgreSQL date_trunc interval
 * @param {string} groupBy - Time grouping parameter
 * @returns {string} - PostgreSQL interval string or null if invalid
 */
function getTimeGroupInterval(groupBy) {
    const intervalMap = {
        // Friendly names
        'minute': 'minute',
        'hour': 'hour', 
        'day': 'day',
        
        // Technical intervals
        '1m': 'minute',
        '5m': 'minute',  // Will need special handling for 5-minute groups
        '15m': 'minute', // Will need special handling for 15-minute groups  
        '1h': 'hour',
        '6h': 'hour',    // Will need special handling for 6-hour groups
        '1d': 'day'
    };
    
    return intervalMap[groupBy] || null;
}

// Get all auo_display records
export const getAllAuoDisplay = async (req, res) => {
    try {
        // Get all columns from the schema
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time

            FROM auo_display a
            ORDER BY id DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved all AUO display data'
        });
    } catch (error) {
        console.error('Error fetching AUO display data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data',
            error: error.message
        });
    }
};

// Get the latest auo_display record
export const getLatestAuoDisplay = async (req, res) => {
    try {
        // List all fields explicitly
        const latestAuoDisplay = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time

            FROM auo_display a
            ORDER BY id DESC
            LIMIT 1
        `;

        if (!latestAuoDisplay || latestAuoDisplay.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No AUO display records found'
            });
        }

        return res.status(200).json({
            success: true,
            data: latestAuoDisplay[0],
            message: 'Successfully retrieved latest AUO display data'
        });
    } catch (error) {
        console.error('Error fetching latest AUO display data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest AUO display data',
            error: error.message
        });
    }
};

// Updated addAuoDisplay function with timestamp
export const addAuoDisplay = async (req, res) => {
    try {
        const {
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
            power_socket_status
        } = req.body;

        // Validate required fields
        if (voltage === undefined || current === undefined || power_operating === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Insert new record using queryRaw to get the returned ID
        const result = await prisma.$queryRaw`
            INSERT INTO auo_display (
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
                ${voltage}::real, 
                ${current}::real, 
                ${power_operating}::real, 
                ${frequency}::real, 
                ${power_factor}::real, 
                ${operating_time || '0 seconds'}::interval,
                ${over_voltage_operating || false},
                ${over_current_operating || false},
                ${over_power_operating || false},
                ${status_operating || false},
                ${under_voltage_operating || false},
                ${power_socket_status || false},
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        // Check for warnings after inserting data
        await checkDeviceWarnings('auo_display', {
            voltage,
            current,
            power_operating,
            frequency,
            power_factor
        }, result[0].id);

        return res.status(201).json({
            success: true,
            message: 'AUO display data added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        console.error('Error adding AUO display data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add AUO display data',
            error: error.message
        });
    }
};

// Get AUO display data from the last 1 hour
export const getAuoDisplay1Hour = async (req, res) => {
    try {
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM auo_display a
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved AUO display data from last 1 hour',
            count: auoDisplayData.length
        });
    } catch (error) {
        console.error('Error fetching AUO display data (1 hour):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data from last 1 hour',
            error: error.message
        });
    }
};

// Get AUO display data from the last 6 hours
export const getAuoDisplay6Hours = async (req, res) => {
    try {
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM auo_display a
            WHERE timestamp >= NOW() - INTERVAL '6 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved AUO display data from last 6 hours',
            count: auoDisplayData.length
        });
    } catch (error) {
        console.error('Error fetching AUO display data (6 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data from last 6 hours',
            error: error.message
        });
    }
};

// Get AUO display data from the last 24 hours
export const getAuoDisplay24Hours = async (req, res) => {
    try {
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM auo_display a
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved AUO display data from last 24 hours',
            count: auoDisplayData.length
        });
    } catch (error) {
        console.error('Error fetching AUO display data (24 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data from last 24 hours',
            error: error.message
        });
    }
};

// Get AUO display data from the last 7 days
export const getAuoDisplay7Days = async (req, res) => {
    try {
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM auo_display a
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved AUO display data from last 7 days',
            count: auoDisplayData.length
        });
    } catch (error) {
        console.error('Error fetching AUO display data (7 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data from last 7 days',
            error: error.message
        });
    }
};

// Get AUO display data from the last 30 days
export const getAuoDisplay30Days = async (req, res) => {
    try {
        const auoDisplayData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM auo_display a
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            message: 'Successfully retrieved AUO display data from last 30 days',
            count: auoDisplayData.length
        });
    } catch (error) {
        console.error('Error fetching AUO display data (30 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data from last 30 days',
            error: error.message
        });
    }
};

// Get AUO display data by date range
export const getAuoDisplayByDateRange = async (req, res) => {
    try {
        const { startDate, endDate, groupBy, aggregation = 'avg' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate are required'
            });
        }

        // Handle groupBy parameter (support both 'groupBy' and 'interval')
        const timeGroup = groupBy || req.query.interval;
        
        let auoDisplayData;
        
        if (timeGroup) {
            // Build aggregated query based on groupBy parameter
            const groupByInterval = getTimeGroupInterval(timeGroup);
            
            if (!groupByInterval) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid groupBy value. Supported: minute, hour, day, 1m, 5m, 15m, 1h, 6h, 1d'
                });
            }

            // Aggregated query with time grouping
            auoDisplayData = await prisma.$queryRaw`
                SELECT 
                    date_trunc(${groupByInterval}, timestamp) as timestamp,
                    COUNT(*) as record_count,
                    AVG(voltage)::numeric(10,2) as voltage,
                    AVG(current)::numeric(10,3) as current,
                    AVG(power_operating)::numeric(10,2) as power_operating,
                    AVG(frequency)::numeric(10,2) as frequency,
                    AVG(power_factor)::numeric(10,2) as power_factor,
                    MIN(timestamp) as period_start,
                    MAX(timestamp) as period_end,
                    to_char(date_trunc(${groupByInterval}, timestamp), 'YYYY-MM-DD HH24:MI:SS') as formatted_time
                FROM auo_display 
                WHERE timestamp >= ${startDate}::timestamp 
                AND timestamp <= ${endDate}::timestamp 
                GROUP BY date_trunc(${groupByInterval}, timestamp)
                ORDER BY date_trunc(${groupByInterval}, timestamp) DESC
            `;
        } else {
            // Original non-aggregated query
            auoDisplayData = await prisma.$queryRaw`
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
                    timestamp,
                    to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
                FROM auo_display
                WHERE timestamp >= ${startDate}::timestamp 
                AND timestamp <= ${endDate}::timestamp 
                ORDER BY timestamp DESC
            `;
        }

        return res.status(200).json({
            success: true,
            data: auoDisplayData,
            metadata: {
                total: auoDisplayData.length,
                timeRange: {
                    start: startDate,
                    end: endDate
                },
                groupBy: timeGroup || null,
                aggregation: timeGroup ? aggregation : null,
                isAggregated: !!timeGroup
            },
            message: timeGroup ? 
                `Successfully retrieved aggregated AUO display data (${timeGroup})` :
                `Successfully retrieved AUO display data from ${startDate} to ${endDate}`
        });
    } catch (error) {
        console.error('Error fetching AUO display data by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AUO display data by date range',
            error: error.message
        });
    }
};