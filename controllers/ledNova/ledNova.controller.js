import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// Get all led_nova_100 records
export const getAllLedNova = async (req, res) => {
    try {
        const ledNovaData = await prisma.$queryRaw`
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
            FROM led_nova_100
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

// Get the latest led_nova_100 record
export const getLatestLedNova = async (req, res) => {
    try {
        const latestLedNova = await prisma.$queryRaw`
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
            FROM led_nova_100
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

        // Insert new record using queryRaw to get the returned ID
        const result = await prisma.$queryRaw`
            INSERT INTO led_nova_100 (
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
        await checkDeviceWarnings('led_nova_100', {
            voltage,
            current,
            power_operating,
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
            FROM led_nova_100
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
            FROM led_nova_100
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
            FROM led_nova_100
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
            FROM led_nova_100
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
            FROM led_nova_100
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
            FROM led_nova_100
            WHERE timestamp >= ${startDate}::timestamp 
            AND timestamp <= ${endDate}::timestamp + INTERVAL '1 day'
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