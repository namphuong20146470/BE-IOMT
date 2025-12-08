// features/sockets/socket-data.service.js
import prisma from '../../config/db.js';
import { AppError } from '../../shared/utils/errorHandler.js';

/**
 * Socket Data Service - MVP Implementation
 * Hybrid approach: Use device_data (raw) + device_latest_data (processed)
 */
class SocketDataService {
    /**
     * Get latest socket data (optimized for real-time dashboard)
     */
    async getLatestSocketData(socketId) {
        try {
            // Try from latest_data table first (fastest)
            const latestData = await prisma.device_latest_data.findFirst({
                where: {
                    device: {
                        socket: { id: socketId }
                    }
                },
                include: {
                    device: {
                        select: {
                            id: true,
                            serial_number: true,
                            socket: {
                                select: {
                                    id: true,
                                    socket_number: true,
                                    name: true,
                                    status: true
                                }
                            }
                        }
                    },
                    measurements: {
                        select: { name: true, unit: true }
                    }
                }
            });

            // Fallback to raw data if no processed data available
            if (!latestData) {
                return this.getLatestRawSocketData(socketId);
            }

            return {
                success: true,
                data: {
                    socket_id: socketId,
                    device_id: latestData.device.id,
                    measurement: latestData.measurements.name,
                    value: latestData.latest_value,
                    unit: latestData.measurements.unit,
                    updated_at: latestData.updated_at,
                    socket_info: latestData.device.socket
                },
                message: "Latest socket data retrieved successfully"
            };
        } catch (error) {
            console.error('Error getting latest socket data:', error);
            throw new AppError('Failed to retrieve latest socket data', 500);
        }
    }

    /**
     * Get latest raw socket data (fallback method)
     */
    async getLatestRawSocketData(socketId) {
        try {
            const rawData = await prisma.device_data.findFirst({
                where: { socket_id: socketId },
                include: {
                    device: {
                        select: {
                            id: true,
                            serial_number: true,
                            socket: {
                                select: {
                                    id: true,
                                    socket_number: true,
                                    name: true,
                                    status: true
                                }
                            }
                        }
                    },
                    measurements: {
                        select: { name: true, unit: true }
                    }
                },
                orderBy: { timestamp: 'desc' }
            });

            if (!rawData) {
                throw new AppError('No data found for this socket', 404);
            }

            // Parse JSON payload for MVP (simple extraction)
            const parsedData = this.parseSocketDataPayload(rawData.data_payload);

            return {
                success: true,
                data: {
                    id: rawData.id,
                    socket_id: socketId,
                    device_id: rawData.device.id,
                    measurement: rawData.measurements.name,
                    ...parsedData,
                    timestamp: rawData.timestamp,
                    formatted_time: rawData.timestamp.toISOString().replace('T', ' ').substring(0, 19),
                    socket_info: rawData.device.socket
                },
                message: `Successfully retrieved latest Socket ${rawData.device.socket.socket_number} data`
            };
        } catch (error) {
            console.error('Error getting raw socket data:', error);
            throw new AppError(error.message || 'Failed to retrieve socket data', error.statusCode || 500);
        }
    }

    /**
     * Get historical socket data with pagination
     */
    async getSocketDataHistory(socketId, options = {}) {
        try {
            const { 
                limit = 100, 
                offset = 0, 
                dateFrom, 
                dateTo, 
                interval = 'raw' 
            } = options;

            const whereClause = { 
                socket_id: socketId,
                ...(dateFrom && dateTo && {
                    timestamp: {
                        gte: new Date(dateFrom),
                        lte: new Date(dateTo)
                    }
                })
            };

            // For MVP: Simple raw data query
            const [data, total] = await Promise.all([
                prisma.device_data.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        device_id: true,
                        data_payload: true,
                        timestamp: true,
                        measurements: {
                            select: { name: true, unit: true }
                        }
                    },
                    orderBy: { timestamp: 'desc' },
                    skip: parseInt(offset),
                    take: parseInt(limit)
                }),
                prisma.device_data.count({ where: whereClause })
            ]);

            // Parse data for response
            const parsedData = data.map(item => ({
                id: item.id,
                socket_id: socketId,
                device_id: item.device_id,
                measurement: item.measurements.name,
                ...this.parseSocketDataPayload(item.data_payload),
                timestamp: item.timestamp,
                socket_info: item.device.socket
            }));

            return {
                success: true,
                data: parsedData,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: (offset + limit) < total
                },
                message: "Socket data history retrieved successfully"
            };
        } catch (error) {
            console.error('Error getting socket data history:', error);
            throw new AppError('Failed to retrieve socket data history', 500);
        }
    }

    /**
     * Parse socket data payload (MVP implementation)
     * TODO: Make this more robust for production
     */
    parseSocketDataPayload(payload) {
        try {
            // Handle both JSON object and string
            const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
            
            return {
                voltage: data.voltage || 0,
                current: data.current || 0,
                power: data.power || 0,
                frequency: data.frequency || 0,
                power_factor: data.power_factor || 0,
                machine_state: data.machine_state || false,
                socket_state: data.socket_state || false,
                sensor_state: data.sensor_state || false,
                over_voltage: data.over_voltage || false,
                under_voltage: data.under_voltage || false
            };
        } catch (error) {
            console.warn('Failed to parse socket data payload:', error);
            // Return default values if parsing fails
            return {
                voltage: 0,
                current: 0,
                power: 0,
                frequency: 0,
                power_factor: 0,
                machine_state: false,
                socket_state: false,
                sensor_state: false,
                over_voltage: false,
                under_voltage: false
            };
        }
    }

    /**
     * Get socket statistics summary
     */
    async getSocketStatistics(socketId, timeframe = '24h') {
        try {
            let startTime;
            const now = new Date();
            
            switch (timeframe) {
                case '1h': startTime = new Date(now.getTime() - 60 * 60 * 1000); break;
                case '6h': startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
                case '24h': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
                case '7d': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                default: startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }

            // Basic statistics from raw data
            const data = await prisma.device_data.findMany({
                where: {
                    socket_id: socketId,
                    timestamp: { gte: startTime }
                },
                orderBy: { timestamp: 'desc' }
            });

            if (data.length === 0) {
                return {
                    success: true,
                    data: {
                        socket_id: socketId,
                        timeframe,
                        data_points: 0,
                        statistics: null
                    },
                    message: "No data available for statistics"
                };
            }

            // Calculate basic statistics
            const parsedData = data.map(item => this.parseSocketDataPayload(item.data_payload));
            const powers = parsedData.map(d => d.power).filter(p => p > 0);
            const voltages = parsedData.map(d => d.voltage).filter(v => v > 0);

            const stats = {
                power: powers.length > 0 ? {
                    min: Math.min(...powers),
                    max: Math.max(...powers),
                    avg: powers.reduce((a, b) => a + b, 0) / powers.length
                } : null,
                voltage: voltages.length > 0 ? {
                    min: Math.min(...voltages),
                    max: Math.max(...voltages),
                    avg: voltages.reduce((a, b) => a + b, 0) / voltages.length
                } : null,
                uptime_percentage: (parsedData.filter(d => d.socket_state).length / parsedData.length) * 100
            };

            return {
                success: true,
                data: {
                    socket_id: socketId,
                    timeframe,
                    data_points: data.length,
                    period: { start: startTime, end: now },
                    statistics: stats,
                    latest: parsedData[0]
                },
                message: "Socket statistics retrieved successfully"
            };
        } catch (error) {
            console.error('Error getting socket statistics:', error);
            throw new AppError('Failed to retrieve socket statistics', 500);
        }
    }

    /**
     * Insert new socket data (for MQTT ingestion)
     */
    async insertSocketData(socketId, deviceId, measurementId, payload) {
        try {
            console.log('🔍 insertSocketData called:', { socketId, deviceId, measurementId, payload });
            
            // Auto-resolve device and measurement if not provided
            if (!deviceId || !measurementId) {
                console.log('🔧 Auto-resolving device and measurement...');
                const resolved = await this.resolveSocketDeviceAndMeasurement(socketId);
                deviceId = deviceId || resolved.deviceId;
                measurementId = measurementId || resolved.measurementId;
                console.log('✅ Resolved:', { deviceId, measurementId });
            }

            // Insert raw data
            const newData = await prisma.device_data.create({
                data: {
                    device_id: deviceId,
                    measurement_id: measurementId,
                    socket_id: socketId,
                    data_payload: payload,
                    timestamp: new Date()
                }
            });

            // Parse payload data
            const parsedData = this.parseSocketDataPayload(payload);

            // Update latest data (for performance optimization)
            if (parsedData.power !== undefined) {
                await prisma.device_latest_data.upsert({
                    where: {
                        device_id_measurement_id: {
                            device_id: deviceId,
                            measurement_id: measurementId
                        }
                    },
                    update: {
                        latest_value: parsedData.power,
                        updated_at: new Date()
                    },
                    create: {
                        device_id: deviceId,
                        measurement_id: measurementId,
                        latest_value: parsedData.power,
                        updated_at: new Date()
                    }
                });
            }

            // Update device current state (real-time status)
            await prisma.device_current_state.upsert({
                where: { device_id: deviceId },
                update: {
                    socket_id: socketId,
                    active_power: parsedData.power || null,
                    apparent_power: parsedData.apparent_power || null,
                    voltage: parsedData.voltage || null,
                    current: parsedData.current || null,
                    power_factor: parsedData.power_factor || null,
                    frequency: parsedData.frequency || null,
                    is_connected: true,
                    last_seen_at: new Date(),
                    updated_at: new Date()
                },
                create: {
                    device_id: deviceId,
                    socket_id: socketId,
                    active_power: parsedData.power || null,
                    apparent_power: parsedData.apparent_power || null,
                    voltage: parsedData.voltage || null,
                    current: parsedData.current || null,
                    power_factor: parsedData.power_factor || null,
                    frequency: parsedData.frequency || null,
                    is_connected: true,
                    last_seen_at: new Date(),
                    updated_at: new Date()
                }
            });

            // Update socket status (connection/configuration only)
            await prisma.sockets.update({
                where: { id: socketId },
                data: {
                    status: parsedData.power > 0 ? 'active' : 'idle',
                    updated_at: new Date()
                }
            });

            return {
                success: true,
                data: { 
                    id: newData.id, 
                    timestamp: newData.timestamp,
                    power: parsedData.power,
                    voltage: parsedData.voltage,
                    current: parsedData.current
                },
                message: "Socket data inserted successfully"
            };
        } catch (error) {
            console.error('Error inserting socket data:', error);
            throw new AppError('Failed to insert socket data', 500);
        }
    }

    /**
     * Auto-resolve device and measurement for a socket
     */
    async resolveSocketDeviceAndMeasurement(socketId) {
        try {
            // Get socket and its device
            const socket = await prisma.sockets.findUnique({
                where: { id: socketId },
                include: {
                    device: { select: { id: true } }
                }
            });

            if (!socket) {
                throw new AppError('Socket not found', 404);
            }

            let deviceId = socket.device?.id;

            // Create default device if none exists
            if (!deviceId) {
                const defaultDevice = await this.createDefaultDeviceForSocket(socketId, socket.socket_number);
                deviceId = defaultDevice.id;

                // Link device to socket
                await prisma.sockets.update({
                    where: { id: socketId },
                    data: { device_id: deviceId }
                });
            }

            // Get or create default measurement type
            let measurement = await prisma.measurements.findFirst({
                where: { name: 'Power Consumption' }
            });

            if (!measurement) {
                measurement = await prisma.measurements.create({
                    data: {
                        name: 'Power Consumption',
                        unit: 'W',
                        data_type: 'numeric'
                    }
                });
            }

            return {
                deviceId,
                measurementId: measurement.id
            };
        } catch (error) {
            console.error('Error resolving socket device/measurement:', error);
            throw new AppError('Failed to resolve socket configuration', 500);
        }
    }

    /**
     * Create default device for socket
     */
    async createDefaultDeviceForSocket(socketId, socketNumber) {
        try {
            // Get or create device category
            let category = await prisma.device_categories.findFirst({
                where: { name: 'IoT Equipment' }
            });

            if (!category) {
                category = await prisma.device_categories.create({
                    data: {
                        name: 'IoT Equipment',
                        description: 'Internet of Things monitoring equipment'
                    }
                });
            }

            // Get or create device model  
            let model = await prisma.device_models.findFirst({
                where: { name: 'Socket Monitor Device' }
            });

            if (!model) {
                model = await prisma.device_models.create({
                    data: {
                        category_id: category.id,
                        name: 'Socket Monitor Device',
                        model_number: 'SM-001',
                        specifications: {
                            type: 'Power monitoring device',
                            auto_created: true
                        }
                    }
                });
            }

            // Get socket info to get organization
            const socketInfo = await prisma.sockets.findUnique({
                where: { id: socketId },
                include: {
                    pdu: {
                        select: { organization_id: true }
                    }
                }
            });

            const organizationId = socketInfo?.pdu?.organization_id;
            if (!organizationId) {
                throw new AppError('Cannot determine organization for socket', 400);
            }

            // Create device
            const device = await prisma.device.create({
                data: {
                    model_id: model.id,
                    organization_id: organizationId,
                    serial_number: `AUTO-DEVICE-SOCKET-${socketNumber}-${Date.now()}`,
                    status: 'active',
                    notes: `Auto-created device for Socket ${socketNumber}`,
                    visibility: 'private'
                }
            });

            return device;
        } catch (error) {
            console.error('Error creating default device:', error);
            throw new AppError('Failed to create default device', 500);
        }
    }
}

export default new SocketDataService();