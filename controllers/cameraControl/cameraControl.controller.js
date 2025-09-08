import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';

const prisma = new PrismaClient();

// For getAllCameraControl
export const getAllCameraControl = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
                timestamp
            FROM camera_control_unit
            ORDER BY id DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            message: 'Successfully retrieved all camera control unit data'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data',
            error: error.message
        });
    }
};

// For getLatestCameraControl
export const getLatestCameraControl = async (req, res) => {
    try {
        const latestCameraControl = await prisma.$queryRaw`
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
            FROM camera_control_unit
            ORDER BY id DESC
            LIMIT 1
        `;

        if (!latestCameraControl || latestCameraControl.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No Camera Control Unit records found'
            });
        }

        return res.status(200).json({
            success: true,
            data: latestCameraControl[0],
            message: 'Successfully retrieved latest Camera Control Unit data'
        });
    } catch (error) {
        console.error('Error fetching latest Camera Control Unit data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest Camera Control Unit data',
            error: error.message
        });
    }
};

// Get camera control data for last 7 days
export const getCameraControl7Days = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= (
                SELECT MAX(timestamp) - INTERVAL '7 days'
                FROM camera_control_unit
            )
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            message: 'Successfully retrieved camera control unit data for last 7 days from latest timestamp'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data for 7 days:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data for 7 days',
            error: error.message
        });
    }
};

// Get camera control data for last 30 days
export const getCameraControl30Days = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= (
                SELECT MAX(timestamp) - INTERVAL '30 days'
                FROM camera_control_unit
            )
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            message: 'Successfully retrieved camera control unit data for last 30 days from latest timestamp'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data for 30 days:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data for 30 days',
            error: error.message
        });
    }
};

// Get camera control data for last 1 hour
export const getCameraControl1Hour = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= (
                SELECT DATE_TRUNC('hour', MAX(timestamp)) 
                FROM camera_control_unit
            )
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            message: 'Successfully retrieved camera control unit data for current hour'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data for current hour:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data for current hour',
            error: error.message
        });
    }
};

// Get camera control data for last 6 hours
export const getCameraControl6Hours = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= (
                SELECT MAX(timestamp) - INTERVAL '6 hours'
                FROM camera_control_unit
            )
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            message: 'Successfully retrieved camera control unit data for last 6 hours from latest timestamp'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data for 6 hours:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data for 6 hours',
            error: error.message
        });
    }
};

// Get camera control data for last 24 hours
export const getCameraControl24Hours = async (req, res) => {
    try {
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= (
                SELECT MAX(timestamp) - INTERVAL '24 hours'
                FROM camera_control_unit
            )
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            message: 'Successfully retrieved camera control unit data for last 24 hours from latest timestamp'
        });
    } catch (error) {
        console.error('Error fetching camera control unit data for 24 hours:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data for 24 hours',
            error: error.message
        });
    }
};

// Get camera control data with flexible filtering and grouping
// Get camera control data with flexible filtering and grouping
export const getCameraControlByDateRange = async (req, res) => {
    try {
        const { startDate, endDate, groupBy } = req.query;

        // Validate required parameters
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: startDate and endDate are required',
                example: '/iot/camera-control/range?startDate=2025-08-05&endDate=2025-08-06&groupBy=hour'
            });
        }

        // Get raw data within date range
        const cameraControlData = await prisma.$queryRaw`
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
            FROM camera_control_unit
            WHERE timestamp >= ${startDate}::timestamp 
            AND timestamp <= ${endDate}::timestamp + INTERVAL '1 day'
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: cameraControlData,
            count: cameraControlData.length,
            date_range: {
                startDate: startDate,
                endDate: endDate,
                groupBy: groupBy || 'none'
            },
            message: `Successfully retrieved camera control unit data from ${startDate} to ${endDate}`
        });

    } catch (error) {
        console.error('Error fetching camera control unit data by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera control unit data by date range',
            error: error.message
        });
    }
};

// Updated addCameraControl function with timestamp
export const addCameraControl = async (req, res) => {
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
            INSERT INTO camera_control_unit (
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
        await checkDeviceWarnings('camera_control_unit', {
            voltage,
            current,
            power_operating,
            frequency,
            power_factor
        }, result[0].id);

        return res.status(201).json({
            success: true,
            message: 'Camera Control Unit data added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        console.error('Error adding Camera Control Unit data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add Camera Control Unit data',
            error: error.message
        });
    }
};