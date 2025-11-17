// Socket 3 Controller (Tang 3 PKT - Socket 3)
// Manages socket3_data table for electrical measurements
import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// Get all socket3_data records
export const getAllLedNova = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            ORDER BY id DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved all LED Nova data'
        });
    } catch (error) {
        console.error('Error fetching LED Nova data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data',
            error: error.message
        });
    }
};

// Get the latest socket3_data record
export const getLatestLedNova = async (req, res) => {
    try {
        const latestLedNova = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            ORDER BY id DESC
            LIMIT 1
        `;

        if (!latestLedNova || latestLedNova.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No LED Nova records found'
            });
        }

        return res.status(200).json({
            success: true,
            data: latestLedNova[0],
            message: 'Successfully retrieved latest LED Nova data'
        });
    } catch (error) {
        console.error('Error fetching latest LED Nova data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest LED Nova data',
            error: error.message
        });
    }
};

// Add LED Nova data with warning check
export const addLedNova = async (req, res) => {
    try {
        const {
            voltage,
            current,
            power,
            frequency,
            power_factor,
            
            over_voltage,
            ,
            over_power,
            machine_state,
            under_voltage,
            socket_state
        } = req.body;

        // Insert new record using queryRaw to get the returned ID
        const result = await prisma.$queryRaw`
            INSERT INTO socket3_data (
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp
            ) VALUES (
                ${voltage}::real, 
                ${current}::real, 
                ${power}::real, 
                ${frequency}::real, 
                ${power_factor}::real, 
                ${operating_time || '0 seconds'}::interval,
                ${over_voltage || false},
                ${ || false},
                ${over_power || false},
                ${machine_state || false},
                ${under_voltage || false},
                ${socket_state || false},
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        // Check for warnings after inserting data
        await checkDeviceWarnings('socket3_data', {
            voltage,
            current,
            power,
            frequency,
            power_factor
        }, result[0].id);

        return res.status(201).json({
            success: true,
            message: 'LED Nova data added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        console.error('Error adding LED Nova data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add LED Nova data',
            error: error.message
        });
    }
};

// Get LED Nova data from the last 1 hour
export const getLedNova1Hour = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved LED Nova data from last 1 hour',
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data (1 hour):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data from last 1 hour',
            error: error.message
        });
    }
};

// Get LED Nova data from the last 6 hours
export const getLedNova6Hours = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= NOW() - INTERVAL '6 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved LED Nova data from last 6 hours',
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data (6 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data from last 6 hours',
            error: error.message
        });
    }
};

// Get LED Nova data from the last 24 hours
export const getLedNova24Hours = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved LED Nova data from last 24 hours',
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data (24 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data from last 24 hours',
            error: error.message
        });
    }
};

// Get LED Nova data from the last 7 days
export const getLedNova7Days = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved LED Nova data from last 7 days',
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data (7 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data from last 7 days',
            error: error.message
        });
    }
};

// Get LED Nova data from the last 30 days
export const getLedNova30Days = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: 'Successfully retrieved LED Nova data from last 30 days',
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data (30 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data from last 30 days',
            error: error.message
        });
    }
};

// Get LED Nova data by date range
export const getLedNovaByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate are required'
            });
        }

        const ledNovaData = await prisma.$queryRaw`
            SELECT 
                id, 
                voltage, 
                current, 
                power, 
                frequency, 
                power_factor, 
                
                over_voltage,
                ,
                over_power,
                machine_state,
                under_voltage,
                socket_state,\n                sensor_state,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket3_data
            WHERE timestamp >= ${startDate}::timestamp 
            AND timestamp <= ${endDate}::timestamp
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: ledNovaData,
            message: `Successfully retrieved LED Nova data from ${startDate} to ${endDate}`,
            count: ledNovaData.length
        });
    } catch (error) {
        console.error('Error fetching LED Nova data by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve LED Nova data by date range',
            error: error.message
        });
    }
};

// ==================== SOCKET 3 ALIASES ====================
// Tang 3 PKT Socket 3 endpoints (socket3_data table)
export const getAllSocket3 = getAllLedNova;
export const getLatestSocket3 = getLatestLedNova;
export const addSocket3 = addLedNova;
export const getSocket31Hour = getLedNova1Hour;
export const getSocket36Hours = getLedNova6Hours;
export const getSocket324Hours = getLedNova24Hours;
export const getSocket37Days = getLedNova7Days;
export const getSocket330Days = getLedNova30Days;
export const getSocket3ByDateRange = getLedNovaByDateRange;

