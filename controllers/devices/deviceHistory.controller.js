// controllers/devices/deviceHistory.controller.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get device sensor data history with time range filtering
 */
export const getDeviceHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            start_date, 
            end_date, 
            page = 1, 
            limit = 100, 
            data_type 
        } = req.query;

        // Validate required parameters
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'start_date and end_date parameters are required'
            });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        // Validate date range (max 30 days)
        const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 30) {
            return res.status(400).json({
                success: false,
                message: 'Date range cannot exceed 30 days'
            });
        }

        // Check if device exists and user has access
        const device = await prisma.device.findUnique({
            where: { id },
            select: { 
                id: true,
                deviceCode: true,
                organizationId: true,
                department: {
                    select: { name: true }
                }
            }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Check organization access
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Try to get data from multiple device data tables
        let sensorData = [];
        let total = 0;

        try {
            // Try AUO Display data first
            const auoData = await prisma.$queryRaw`
                SELECT 
                    id,
                    'socket1_data' as device_type,
                    voltage,
                    current,
                    power,
                    timestamp as data_timestamp,
                    created_at
                FROM socket1_data_data 
                WHERE device_id = ${id}
                    AND timestamp >= ${startDate}
                    AND timestamp <= ${endDate}
                ORDER BY timestamp DESC
                LIMIT ${parseInt(limit)} OFFSET ${skip}
            `;

            if (auoData.length > 0) {
                sensorData = auoData.map(record => ({
                    id: record.id,
                    device_id: id,
                    timestamp: record.data_timestamp,
                    data: {
                        voltage: record.voltage,
                        current: record.current,
                        power: record.power
                    },
                    status: 'normal', // Default status, could be enhanced with threshold checking
                    device_type: record.device_type
                }));

                const countResult = await prisma.$queryRaw`
                    SELECT COUNT(*) as total
                    FROM socket1_data_data 
                    WHERE device_id = ${id}
                        AND timestamp >= ${startDate}
                        AND timestamp <= ${endDate}
                `;
                total = parseInt(countResult[0].total);
            }
        } catch (auoError) {
            console.log('No AUO display data found, trying other sources...');
        }

        // If no AUO data, try Camera Control data
        if (sensorData.length === 0) {
            try {
                const cameraData = await prisma.$queryRaw`
                    SELECT 
                        id,
                        'camera_control' as device_type,
                        voltage,
                        current,
                        power,
                        timestamp as data_timestamp,
                        created_at
                    FROM camera_control_data 
                    WHERE device_id = ${id}
                        AND timestamp >= ${startDate}
                        AND timestamp <= ${endDate}
                    ORDER BY timestamp DESC
                    LIMIT ${parseInt(limit)} OFFSET ${skip}
                `;

                if (cameraData.length > 0) {
                    sensorData = cameraData.map(record => ({
                        id: record.id,
                        device_id: id,
                        timestamp: record.data_timestamp,
                        data: {
                            voltage: record.voltage,
                            current: record.current,
                            power: record.power
                        },
                        status: 'normal',
                        device_type: record.device_type
                    }));

                    const countResult = await prisma.$queryRaw`
                        SELECT COUNT(*) as total
                        FROM camera_control_data 
                        WHERE device_id = ${id}
                            AND timestamp >= ${startDate}
                            AND timestamp <= ${endDate}
                    `;
                    total = parseInt(countResult[0].total);
                }
            } catch (cameraError) {
                console.log('No Camera control data found, trying other sources...');
            }
        }

        // If no specific device data, try IoT Environment data
        if (sensorData.length === 0) {
            try {
                const iotEnvData = await prisma.$queryRaw`
                    SELECT 
                        id,
                        'iot_environment' as device_type,
                        temperature,
                        humidity,
                        pressure,
                        timestamp as data_timestamp,
                        created_at
                    FROM iot_env_data 
                    WHERE device_id = ${id}
                        AND timestamp >= ${startDate}
                        AND timestamp <= ${endDate}
                    ORDER BY timestamp DESC
                    LIMIT ${parseInt(limit)} OFFSET ${skip}
                `;

                if (iotEnvData.length > 0) {
                    sensorData = iotEnvData.map(record => ({
                        id: record.id,
                        device_id: id,
                        timestamp: record.data_timestamp,
                        data: {
                            temperature: record.temperature,
                            humidity: record.humidity,
                            pressure: record.pressure
                        },
                        status: 'normal',
                        device_type: record.device_type
                    }));

                    const countResult = await prisma.$queryRaw`
                        SELECT COUNT(*) as total
                        FROM iot_env_data 
                        WHERE device_id = ${id}
                            AND timestamp >= ${startDate}
                            AND timestamp <= ${endDate}
                    `;
                    total = parseInt(countResult[0].total);
                }
            } catch (iotError) {
                console.log('No IoT environment data found, trying other sources...');
            }
        }

        // If still no data found, return empty result
        if (sensorData.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    total_pages: 0
                },
                device_info: {
                    id: device.id,
                    device_code: device.deviceCode,
                    department: device.department?.name
                },
                message: 'No sensor data found for the specified time range'
            });
        }

        return res.status(200).json({
            success: true,
            data: sensorData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            },
            device_info: {
                id: device.id,
                device_code: device.deviceCode,
                department: device.department?.name
            },
            date_range: {
                start_date: startDate,
                end_date: endDate,
                days_requested: Math.ceil(daysDiff)
            }
        });
    } catch (error) {
        console.error('Error fetching device history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device history',
            error: error.message
        });
    }
};

/**
 * Get real-time device data (latest sensor reading)
 */
export const getDeviceRealtimeData = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if device exists and user has access
        const device = await prisma.device.findUnique({
            where: { id },
            select: { 
                id: true,
                deviceCode: true,
                organizationId: true,
                department: {
                    select: { name: true }
                }
            }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        // Try to get latest data from multiple sources
        let latestData = null;

        // Try AUO Display data first
        try {
            const auoLatest = await prisma.$queryRaw`
                SELECT 
                    id,
                    'socket1_data' as device_type,
                    voltage,
                    current,
                    power,
                    timestamp,
                    created_at
                FROM socket1_data_data 
                WHERE device_id = ${id}
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            if (auoLatest.length > 0) {
                const record = auoLatest[0];
                latestData = {
                    id: record.id,
                    device_id: id,
                    timestamp: record.timestamp,
                    data: {
                        voltage: record.voltage,
                        current: record.current,
                        power: record.power
                    },
                    status: 'normal',
                    device_type: record.device_type
                };
            }
        } catch (error) {
            console.log('No AUO display data found');
        }

        // Try Camera Control data if no AUO data
        if (!latestData) {
            try {
                const cameraLatest = await prisma.$queryRaw`
                    SELECT 
                        id,
                        'camera_control' as device_type,
                        voltage,
                        current,
                        power,
                        timestamp,
                        created_at
                    FROM camera_control_data 
                    WHERE device_id = ${id}
                    ORDER BY timestamp DESC
                    LIMIT 1
                `;

                if (cameraLatest.length > 0) {
                    const record = cameraLatest[0];
                    latestData = {
                        id: record.id,
                        device_id: id,
                        timestamp: record.timestamp,
                        data: {
                            voltage: record.voltage,
                            current: record.current,
                            power: record.power
                        },
                        status: 'normal',
                        device_type: record.device_type
                    };
                }
            } catch (error) {
                console.log('No Camera control data found');
            }
        }

        // Try IoT Environment data if no other data
        if (!latestData) {
            try {
                const iotLatest = await prisma.$queryRaw`
                    SELECT 
                        id,
                        'iot_environment' as device_type,
                        temperature,
                        humidity,
                        pressure,
                        timestamp,
                        created_at
                    FROM iot_env_data 
                    WHERE device_id = ${id}
                    ORDER BY timestamp DESC
                    LIMIT 1
                `;

                if (iotLatest.length > 0) {
                    const record = iotLatest[0];
                    latestData = {
                        id: record.id,
                        device_id: id,
                        timestamp: record.timestamp,
                        data: {
                            temperature: record.temperature,
                            humidity: record.humidity,
                            pressure: record.pressure
                        },
                        status: 'normal',
                        device_type: record.device_type
                    };
                }
            } catch (error) {
                console.log('No IoT environment data found');
            }
        }

        if (!latestData) {
            return res.status(404).json({
                success: false,
                message: 'No real-time data available for this device',
                device_info: {
                    id: device.id,
                    device_code: device.deviceCode,
                    department: device.department?.name
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: latestData,
            device_info: {
                id: device.id,
                device_code: device.deviceCode,
                department: device.department?.name
            }
        });
    } catch (error) {
        console.error('Error fetching real-time device data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch real-time device data',
            error: error.message
        });
    }
};

/**
 * Get device data summary/statistics for a time period
 */
export const getDeviceDataSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'start_date and end_date parameters are required'
            });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        // Check device access
        const device = await prisma.device.findUnique({
            where: { id },
            select: { organizationId: true }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        // Get summary statistics from available data sources
        let summary = null;

        // Try AUO Display data first
        try {
            const auoSummary = await prisma.$queryRaw`
                SELECT 
                    COUNT(*) as total_readings,
                    AVG(voltage) as avg_voltage,
                    MIN(voltage) as min_voltage,
                    MAX(voltage) as max_voltage,
                    AVG(current) as avg_current,
                    MIN(current) as min_current,
                    MAX(current) as max_current,
                    AVG(power) as avg_power,
                    MIN(power) as min_power,
                    MAX(power) as max_power,
                    MIN(timestamp) as earliest_reading,
                    MAX(timestamp) as latest_reading
                FROM socket1_data_data 
                WHERE device_id = ${id}
                    AND timestamp >= ${startDate}
                    AND timestamp <= ${endDate}
            `;

            if (auoSummary.length > 0 && parseInt(auoSummary[0].total_readings) > 0) {
                const stats = auoSummary[0];
                summary = {
                    device_type: 'socket1_data',
                    total_readings: parseInt(stats.total_readings),
                    date_range: {
                        start: startDate,
                        end: endDate,
                        earliest_reading: stats.earliest_reading,
                        latest_reading: stats.latest_reading
                    },
                    statistics: {
                        voltage: {
                            avg: parseFloat(stats.avg_voltage),
                            min: parseFloat(stats.min_voltage),
                            max: parseFloat(stats.max_voltage)
                        },
                        current: {
                            avg: parseFloat(stats.avg_current),
                            min: parseFloat(stats.min_current),
                            max: parseFloat(stats.max_current)
                        },
                        power: {
                            avg: parseFloat(stats.avg_power),
                            min: parseFloat(stats.min_power),
                            max: parseFloat(stats.max_power)
                        }
                    }
                };
            }
        } catch (error) {
            console.log('No AUO display data for summary');
        }

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: 'No sensor data available for summary in the specified time range'
            });
        }

        return res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error fetching device data summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device data summary',
            error: error.message
        });
    }
};
