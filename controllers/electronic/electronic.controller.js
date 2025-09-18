import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// For getAllElectronic
export const getAllElectronic = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            ORDER BY id DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved all electronic endoflator data'
        });
    } catch (error) {
        console.error('Error fetching electronic endoflator data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve electronic endoflator data',
            error: error.message
        });
    }
};

// For getLatestElectronic
export const getLatestElectronic = async (req, res) => {
    try {
        const latestElectronic = await prisma.$queryRaw`
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

            FROM electronic_endoflator
            ORDER BY id DESC
            LIMIT 1
        `;

        if (!latestElectronic || latestElectronic.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No Electronic Endoflator records found'
            });
        }

        return res.status(200).json({
            success: true,
            data: latestElectronic[0],
            message: 'Successfully retrieved latest Electronic Endoflator data'
        });
    } catch (error) {
        console.error('Error fetching latest Electronic Endoflator data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest Electronic Endoflator data',
            error: error.message
        });
    }
};

// Complete addElectronic function with timestamp
export const addElectronic = async (req, res) => {
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
            INSERT INTO electronic_endoflator (
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
        await checkDeviceWarnings('electronic_endoflator', {
            voltage,
            current,
            power_operating,
            frequency,
            power_factor
        }, result[0].id);

        return res.status(201).json({
            success: true,
            message: 'Electronic Endoflator data added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        console.error('Error adding Electronic Endoflator data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add Electronic Endoflator data',
            error: error.message
        });
    }
};

// Get Electronic data from the last 1 hour
export const getElectronic1Hour = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved Electronic Endoflator data from last 1 hour',
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data (1 hour):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data from last 1 hour',
            error: error.message
        });
    }
};

// Get Electronic data from the last 6 hours
export const getElectronic6Hours = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= NOW() - INTERVAL '6 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved Electronic Endoflator data from last 6 hours',
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data (6 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data from last 6 hours',
            error: error.message
        });
    }
};

// Get Electronic data from the last 24 hours
export const getElectronic24Hours = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved Electronic Endoflator data from last 24 hours',
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data (24 hours):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data from last 24 hours',
            error: error.message
        });
    }
};

// Get Electronic data from the last 7 days
export const getElectronic7Days = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved Electronic Endoflator data from last 7 days',
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data (7 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data from last 7 days',
            error: error.message
        });
    }
};

// Get Electronic data from the last 30 days
export const getElectronic30Days = async (req, res) => {
    try {
        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: 'Successfully retrieved Electronic Endoflator data from last 30 days',
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data (30 days):', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data from last 30 days',
            error: error.message
        });
    }
};

// Get Electronic data by date range
export const getElectronicByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate are required'
            });
        }

        const electronicData = await prisma.$queryRaw`
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
            FROM electronic_endoflator
            WHERE timestamp >= ${startDate}::timestamp 
            AND timestamp <= ${endDate}::timestamp 
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: electronicData,
            message: `Successfully retrieved Electronic Endoflator data from ${startDate} to ${endDate}`,
            count: electronicData.length
        });
    } catch (error) {
        console.error('Error fetching Electronic Endoflator data by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Electronic Endoflator data by date range',
            error: error.message
        });
    }
};