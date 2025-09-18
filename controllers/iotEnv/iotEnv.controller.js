import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// Get all iot_environment_status records
export const getAllIotEnv = async (req, res) => {
    try {
        const iotEnvData = await prisma.iot_environment_status.findMany({
            orderBy: {
                id: 'desc'
            },
            select: {
                id: true,
                leak_current_ma: true,
                temperature_c: true,
                humidity_percent: true,
                over_temperature: true,
                over_humidity: true,
                soft_warning: true,
                strong_warning: true,
                shutdown_warning: true,
                timestamp: true
            }
        });

        // Format timestamps for each record
        const formattedData = iotEnvData.map(record => ({
            ...record,
            formatted_time: record.timestamp ?
                new Date(record.timestamp).toISOString().slice(0, 19).replace('T', ' ') :
                null
        }));

        return res.status(200).json({
            success: true,
            data: formattedData,
            message: 'Successfully retrieved all IoT environment data'
        });
    } catch (error) {
        console.error('Error fetching IoT environment data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT environment data',
            error: error.message
        });
    }
};

// Get the latest iot_environment_status record
export const getLatestIotEnv = async (req, res) => {
    try {
        const latestIotEnv = await prisma.iot_environment_status.findFirst({
            orderBy: {
                id: 'desc'
            },
            select: {
                id: true,
                leak_current_ma: true,
                temperature_c: true,
                humidity_percent: true,
                over_temperature: true,
                over_humidity: true,
                soft_warning: true,
                strong_warning: true,
                shutdown_warning: true,
                timestamp: true
            }
        });

        if (!latestIotEnv) {
            return res.status(404).json({
                success: false,
                message: 'No IoT environment records found'
            });
        }

        // Format timestamp
        const formattedData = {
            ...latestIotEnv,
            formatted_time: latestIotEnv.timestamp ?
                new Date(latestIotEnv.timestamp).toISOString().slice(0, 19).replace('T', ' ') :
                null
        };

        return res.status(200).json({
            success: true,
            data: formattedData,
            message: 'Successfully retrieved latest IoT environment data'
        });
    } catch (error) {
        console.error('Error fetching latest IoT environment data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest IoT environment data',
            error: error.message
        });
    }
};

// Add a new iot_environment_status record
export const addIotEnv = async (req, res) => {
    try {
        const {
            leak_current_ma,
            temperature_c,
            humidity_percent,
            over_temperature,
            over_humidity,
            soft_warning,
            strong_warning,
            shutdown_warning
        } = req.body;

        // Validate required fields
        if (leak_current_ma === undefined || temperature_c === undefined || humidity_percent === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: leak_current_ma, temperature_c, or humidity_percent'
            });
        }

        // Create new record using Prisma create
        const result = await prisma.iot_environment_status.create({
            data: {
                leak_current_ma: parseFloat(leak_current_ma),
                temperature_c: parseFloat(temperature_c),
                humidity_percent: parseFloat(humidity_percent),
                over_temperature: over_temperature || false,
                over_humidity: over_humidity || false,
                soft_warning: soft_warning || false,
                strong_warning: strong_warning || false,
                shutdown_warning: shutdown_warning || false
            },
            select: {
                id: true,
                timestamp: true
            }
        });

        // Check for warnings after inserting data
        await checkDeviceWarnings('iot_environment_status', {
            leak_current_ma: parseFloat(leak_current_ma),
            temperature_c: parseFloat(temperature_c),
            humidity_percent: parseFloat(humidity_percent)
        }, result.id);

        return res.status(201).json({
            success: true,
            message: 'IoT environment data added successfully',
            data: {
                id: result.id,
                timestamp: result.timestamp,
                formatted_time: result.timestamp ?
                    new Date(result.timestamp).toISOString().slice(0, 19).replace('T', ' ') :
                    null
            }
        });
    } catch (error) {
        console.error('Error adding IoT environment data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add IoT environment data',
            error: error.message
        });
    }
};

// Get IoT Environment data from the last 1 hour
export const getIotEnv1Hour = async (req, res) => {
    try {
        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: 'Successfully retrieved IoT Environment data from last 1 hour',
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data (1 hour):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data from last 1 hour',
            error: error.message
        });
    }
};

// Get IoT Environment data from the last 6 hours
export const getIotEnv6Hours = async (req, res) => {
    try {
        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= NOW() - INTERVAL '6 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: 'Successfully retrieved IoT Environment data from last 6 hours',
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data (6 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data from last 6 hours',
            error: error.message
        });
    }
};

// Get IoT Environment data from the last 24 hours
export const getIotEnv24Hours = async (req, res) => {
    try {
        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: 'Successfully retrieved IoT Environment data from last 24 hours',
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data (24 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data from last 24 hours',
            error: error.message
        });
    }
};

// Get IoT Environment data from the last 7 days
export const getIotEnv7Days = async (req, res) => {
    try {
        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: 'Successfully retrieved IoT Environment data from last 7 days',
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data (7 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data from last 7 days',
            error: error.message
        });
    }
};

// Get IoT Environment data from the last 30 days
export const getIotEnv30Days = async (req, res) => {
    try {
        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: 'Successfully retrieved IoT Environment data from last 30 days',
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data (30 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data from last 30 days',
            error: error.message
        });
    }
};

// Get IoT Environment data by date range
export const getIotEnvByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate are required'
            });
        }

        const iotEnvData = await prisma.$queryRaw`
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
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM iot_environment_status
            WHERE timestamp >= ${startDate}::timestamp 
            AND timestamp <= ${endDate}::timestamp
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: iotEnvData,
            message: `Successfully retrieved IoT Environment data from ${startDate} to ${endDate}`,
            count: iotEnvData.length
        });
    } catch (error) {
        console.error('Error fetching IoT Environment data by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve IoT Environment data by date range',
            error: error.message
        });
    }
};