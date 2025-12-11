import { PrismaClient } from '@prisma/client';
// import dynamicMqttManager from '../../Database/mqtt.dynamic.js'; // REMOVED - no longer used
import crypto from 'crypto';

const prisma = new PrismaClient();

// ====================================================================
// MQTT DEVICE MANAGEMENT CONTROLLER (Socket-based Architecture)
// ====================================================================

/**
 * GET /mqtt/devices - Get all MQTT enabled devices (via socket configuration)
 */
export const getAllMqttDevices = async (req, res) => {
    try {
        const {
            organization_id,
            is_active,
            connection_status,
            broker_host,
            page = 1,
            limit = 50,
            search
        } = req.query;

        let whereConditions = ['s.mqtt_broker_host IS NOT NULL'];
        let params = [];
        let paramIndex = 1;

        if (organization_id) {
            whereConditions.push(`pdu.organization_id = $${paramIndex}::uuid`);
            params.push(organization_id);
            paramIndex++;
        }

        if (is_active !== undefined) {
            whereConditions.push(`s.is_enabled = $${paramIndex}::boolean`);
            params.push(is_active === 'true');
            paramIndex++;
        }

        if (broker_host) {
            whereConditions.push(`s.mqtt_broker_host ILIKE $${paramIndex}`);
            params.push(`%${broker_host}%`);
            paramIndex++;
        }

        if (search) {
            whereConditions.push(`(
                d.serial_number ILIKE $${paramIndex} OR 
                d.asset_tag ILIKE $${paramIndex} OR 
                dm.name ILIKE $${paramIndex} OR
                m.name ILIKE $${paramIndex} OR
                s.mqtt_topic_suffix ILIKE $${paramIndex} OR
                pdu.mqtt_base_topic ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const limitParamIndex = paramIndex;
        const offsetParamIndex = paramIndex + 1;
        params.push(parseInt(limit), offset);

        const devices = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id as device_id,
                d.serial_number,
                d.asset_tag,
                d.status as device_status,
                d.installation_date,
                d.purchase_date,
                d.location,
                s.id as socket_id,
                s.socket_number,
                s.name as socket_name,
                s.mqtt_broker_host,
                s.mqtt_broker_port,
                s.mqtt_credentials,
                s.mqtt_config,
                s.mqtt_topic_suffix,
                pdu.mqtt_base_topic,
                CONCAT(pdu.mqtt_base_topic, '/', s.mqtt_topic_suffix) as full_mqtt_topic,
                s.status as socket_status,
                s.is_enabled as socket_enabled,
                s.assigned_at,
                s.updated_at as socket_updated,
                dm.name as model_name,
                m.name as manufacturer,
                dcat.name as category_name,
                o.name as organization_name,
                pdu.name as pdu_name,
                pdu.location as pdu_location,
                wi.warranty_end as warranty_end_date,
                CASE 
                    WHEN s.status = 'error' THEN 'error'
                    WHEN s.status = 'inactive' OR NOT s.is_enabled THEN 'offline'
                    WHEN s.status = 'idle' THEN 'idle'
                    WHEN s.status = 'active' THEN 'online'
                    ELSE 'unknown'
                END as connection_status
            FROM device d
            JOIN sockets s ON d.id = s.device_id
            JOIN power_distribution_units pdu ON s.pdu_id = pdu.id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dcat ON dm.category_id = dcat.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            ${whereClause}
            ORDER BY s.updated_at DESC NULLS LAST, d.serial_number ASC
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
        `, ...params);

        // Apply connection status filter after query if specified
        let filteredDevices = devices;
        if (connection_status) {
            filteredDevices = devices.filter(device => 
                device.connection_status === connection_status
            );
        }

        // Get total count
        const countParams = params.slice(0, -2);
        const totalResult = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::integer as total
            FROM device d
            JOIN sockets s ON d.id = s.device_id
            JOIN power_distribution_units pdu ON s.pdu_id = pdu.id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            ${whereClause}
        `, ...countParams);

        const total = totalResult[0]?.total || 0;

        return res.status(200).json({
            success: true,
            data: filteredDevices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            metadata: {
                connection_statuses: ['online', 'idle', 'offline', 'error', 'unknown'],
                filters_applied: {
                    organization_id,
                    is_active,
                    connection_status,
                    broker_host,
                    search
                }
            }
        });

    } catch (error) {
        console.error('Error getting MQTT devices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve MQTT devices',
            error: error.message
        });
    }
};

/**
 * GET /mqtt/devices/:deviceId - Get specific MQTT device (via socket configuration)
 */
export const getMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const device = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id as device_id,
                d.serial_number,
                d.asset_tag,
                d.status as device_status,
                d.installation_date,
                d.purchase_date,
                d.location,
                d.notes,
                s.id as socket_id,
                s.socket_number,
                s.name as socket_name,
                s.mqtt_broker_host,
                s.mqtt_broker_port,
                s.mqtt_credentials,
                s.mqtt_config,
                s.mqtt_topic_suffix,
                pdu.mqtt_base_topic,
                CONCAT(pdu.mqtt_base_topic, '/', s.mqtt_topic_suffix) as full_mqtt_topic,
                s.status as socket_status,
                s.is_enabled as socket_enabled,
                s.assigned_at,
                s.created_at as socket_created,
                s.updated_at as socket_updated,
                dm.name as model_name,
                m.name as manufacturer,
                dm.description as model_description,
                dcat.name as category_name,
                o.name as organization_name,
                o.type as organization_type,
                pdu.name as pdu_name,
                pdu.type as pdu_type,
                pdu.location as pdu_location,
                wi.warranty_end as warranty_end_date,
                CASE 
                    WHEN s.status = 'error' THEN 'error'
                    WHEN s.status = 'inactive' OR NOT s.is_enabled THEN 'offline'
                    WHEN s.status = 'idle' THEN 'idle'
                    WHEN s.status = 'active' THEN 'online'
                    ELSE 'unknown'
                END as connection_status,
                -- Get recent data count
                (
                    SELECT COUNT(*)::integer
                    FROM device_data_logs ddl 
                    WHERE ddl.device_id = d.id 
                    AND ddl.timestamp > NOW() - INTERVAL '24 hours'
                ) as messages_24h
            FROM device d
            JOIN sockets s ON d.id = s.device_id
            JOIN power_distribution_units pdu ON s.pdu_id = pdu.id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dcat ON dm.category_id = dcat.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            WHERE d.id = $1::uuid
        `, deviceId);

        if (device.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found or not configured'
            });
        }

        const deviceData = device[0];
        
        // Get recent device data history
        const recentData = await prisma.$queryRawUnsafe(`
            SELECT 
                ddl.data_json,
                ddl.timestamp,
                s.socket_number
            FROM device_data_logs ddl
            JOIN sockets s ON ddl.socket_id = s.id
            WHERE ddl.device_id = $1::uuid
            ORDER BY ddl.timestamp DESC
            LIMIT 10
        `, deviceId);

        return res.status(200).json({
            success: true,
            data: {
                ...deviceData,
                recent_data: recentData,
                mqtt_configuration: {
                    broker_host: deviceData.mqtt_broker_host,
                    broker_port: deviceData.mqtt_broker_port,
                    full_topic: deviceData.full_mqtt_topic,
                    credentials: deviceData.mqtt_credentials,
                    config: deviceData.mqtt_config,
                    socket_info: {
                        socket_id: deviceData.socket_id,
                        socket_number: deviceData.socket_number,
                        socket_name: deviceData.socket_name
                    },
                    pdu_info: {
                        pdu_name: deviceData.pdu_name,
                        pdu_type: deviceData.pdu_type,
                        pdu_location: deviceData.pdu_location,
                        base_topic: deviceData.mqtt_base_topic
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error getting MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve MQTT device',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/devices - Create/Configure MQTT for existing device
 */
export const createMqttDevice = async (req, res) => {
    try {
        const { device_id, socket_id, mqtt_config } = req.body;

        // Validate required fields
        if (!device_id || !socket_id) {
            return res.status(400).json({
                success: false,
                message: 'Device ID and Socket ID are required'
            });
        }

        // Check if device exists and is not already assigned to a socket
        const existingDevice = await prisma.device.findUnique({
            where: { id: device_id },
            include: {
                socket: true
            }
        });

        if (!existingDevice) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (existingDevice.socket) {
            return res.status(400).json({
                success: false,
                message: 'Device is already assigned to a socket'
            });
        }

        // Check if socket exists and is available
        const socket = await prisma.sockets.findUnique({
            where: { id: socket_id },
            include: {
                pdu: true,
                device: true
            }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'Socket not found'
            });
        }

        if (socket.device_id) {
            return res.status(400).json({
                success: false,
                message: 'Socket is already assigned to another device'
            });
        }

        // Update socket with MQTT configuration and assign device
        const updatedSocket = await prisma.sockets.update({
            where: { id: socket_id },
            data: {
                device_id: device_id,
                assigned_at: new Date(),
                assigned_by: req.user?.id,
                mqtt_broker_host: mqtt_config?.broker_host || socket.mqtt_broker_host,
                mqtt_broker_port: mqtt_config?.broker_port || socket.mqtt_broker_port,
                mqtt_credentials: mqtt_config?.credentials || socket.mqtt_credentials,
                mqtt_config: mqtt_config?.config || socket.mqtt_config,
                is_enabled: true,
                status: 'active'
            },
            include: {
                device: {
                    include: {
                        model: true
                    }
                },
                pdu: true
            }
        });

        return res.status(201).json({
            success: true,
            message: 'MQTT device configured successfully',
            data: {
                device_id: updatedSocket.device_id,
                socket_id: updatedSocket.id,
                full_mqtt_topic: `${updatedSocket.pdu.mqtt_base_topic}/${updatedSocket.mqtt_topic_suffix}`,
                mqtt_configuration: {
                    broker_host: updatedSocket.mqtt_broker_host,
                    broker_port: updatedSocket.mqtt_broker_port,
                    credentials: updatedSocket.mqtt_credentials,
                    config: updatedSocket.mqtt_config
                }
            }
        });

    } catch (error) {
        console.error('Error creating MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to configure MQTT device',
            error: error.message
        });
    }
};

/**
 * PUT /mqtt/devices/:deviceId - Update MQTT device configuration
 */
export const updateMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { mqtt_config } = req.body;

        // Find the socket associated with this device
        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId },
            include: {
                pdu: true,
                device: true
            }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found or not configured'
            });
        }

        // Update socket MQTT configuration
        const updatedSocket = await prisma.sockets.update({
            where: { id: socket.id },
            data: {
                mqtt_broker_host: mqtt_config?.broker_host || socket.mqtt_broker_host,
                mqtt_broker_port: mqtt_config?.broker_port || socket.mqtt_broker_port,
                mqtt_credentials: mqtt_config?.credentials || socket.mqtt_credentials,
                mqtt_config: mqtt_config?.config || socket.mqtt_config,
                updated_at: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'MQTT device configuration updated successfully',
            data: {
                device_id: deviceId,
                socket_id: updatedSocket.id,
                full_mqtt_topic: `${socket.pdu.mqtt_base_topic}/${updatedSocket.mqtt_topic_suffix}`,
                mqtt_configuration: {
                    broker_host: updatedSocket.mqtt_broker_host,
                    broker_port: updatedSocket.mqtt_broker_port,
                    credentials: updatedSocket.mqtt_credentials,
                    config: updatedSocket.mqtt_config
                }
            }
        });

    } catch (error) {
        console.error('Error updating MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update MQTT device configuration',
            error: error.message
        });
    }
};

/**
 * DELETE /mqtt/devices/:deviceId - Remove MQTT configuration
 */
export const deleteMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Find the socket associated with this device
        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        // Unassign device from socket (keep socket, remove device assignment)
        await prisma.sockets.update({
            where: { id: socket.id },
            data: {
                device_id: null,
                assigned_at: null,
                assigned_by: null,
                status: 'inactive'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'MQTT device configuration removed successfully'
        });

    } catch (error) {
        console.error('Error deleting MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove MQTT device configuration',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/devices/:deviceId/activate - Activate MQTT device
 */
export const activateMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        await prisma.sockets.update({
            where: { id: socket.id },
            data: {
                is_enabled: true,
                status: 'active'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'MQTT device activated successfully'
        });

    } catch (error) {
        console.error('Error activating MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate MQTT device',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/devices/:deviceId/deactivate - Deactivate MQTT device
 */
export const deactivateMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        await prisma.sockets.update({
            where: { id: socket.id },
            data: {
                is_enabled: false,
                status: 'inactive'
            }
        });

        return res.status(200).json({
            success: true,
            message: 'MQTT device deactivated successfully'
        });

    } catch (error) {
        console.error('Error deactivating MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate MQTT device',
            error: error.message
        });
    }
};

/**
 * GET /mqtt/devices/:deviceId/data - Get device data history
 */
export const getMqttDeviceData = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, offset = 0, from, to } = req.query;

        let timeCondition = '';
        let timeParams = [];
        
        if (from) {
            timeCondition += ' AND ddl.timestamp >= $' + (timeParams.length + 2);
            timeParams.push(from);
        }
        
        if (to) {
            timeCondition += ' AND ddl.timestamp <= $' + (timeParams.length + 2);
            timeParams.push(to);
        }

        const data = await prisma.$queryRawUnsafe(`
            SELECT 
                ddl.data_json,
                ddl.timestamp,
                s.socket_number,
                s.name as socket_name
            FROM device_data_logs ddl
            JOIN sockets s ON ddl.socket_id = s.id
            WHERE ddl.device_id = $1::uuid ${timeCondition}
            ORDER BY ddl.timestamp DESC
            LIMIT $${timeParams.length + 2} OFFSET $${timeParams.length + 3}
        `, deviceId, ...timeParams, parseInt(limit), parseInt(offset));

        return res.status(200).json({
            success: true,
            data: data,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Error getting MQTT device data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve device data',
            error: error.message
        });
    }
};

/**
 * GET /mqtt/status - Get MQTT system status
 */
export const getMqttStatus = async (req, res) => {
    try {
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(DISTINCT d.id)::integer as total_mqtt_devices,
                COUNT(DISTINCT CASE WHEN s.is_enabled = true THEN d.id END)::integer as active_devices,
                COUNT(DISTINCT CASE WHEN s.status = 'active' THEN d.id END)::integer as online_devices,
                COUNT(DISTINCT s.mqtt_broker_host)::integer as unique_brokers,
                COUNT(DISTINCT pdu.id)::integer as total_pdus
            FROM device d
            JOIN sockets s ON d.id = s.device_id
            JOIN power_distribution_units pdu ON s.pdu_id = pdu.id
            WHERE s.mqtt_broker_host IS NOT NULL
        `;

        return res.status(200).json({
            success: true,
            data: stats[0],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting MQTT status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve MQTT status',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/test-publish - Test publish message to device
 */
export const testPublishMessage = async (req, res) => {
    try {
        const { device_id, message, qos = 0 } = req.body;

        // Find socket configuration for the device
        const socket = await prisma.sockets.findFirst({
            where: { device_id },
            include: {
                pdu: true
            }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        const fullTopic = `${socket.pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`;

        // Here you would integrate with your MQTT client to publish
        // For now, we'll just return the configuration that would be used
        
        return res.status(200).json({
            success: true,
            message: 'Test message configuration prepared',
            data: {
                device_id,
                socket_id: socket.id,
                topic: fullTopic,
                broker: {
                    host: socket.mqtt_broker_host,
                    port: socket.mqtt_broker_port,
                    credentials: socket.mqtt_credentials
                },
                message,
                qos,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error preparing test message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to prepare test message',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/devices/:deviceId/publish - Publish data to device
 */
export const publishToDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { message, qos = 0 } = req.body;

        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId },
            include: {
                pdu: true
            }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        const fullTopic = `${socket.pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`;

        // Here you would integrate with your MQTT client to publish
        // For now, we'll just return success with the configuration used
        
        return res.status(200).json({
            success: true,
            message: 'Message published successfully',
            data: {
                device_id: deviceId,
                topic: fullTopic,
                message,
                qos,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error publishing to device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish message',
            error: error.message
        });
    }
};

/**
 * PUT /mqtt/devices/:deviceId/heartbeat - Update last connected timestamp
 * Note: This is now handled via socket status updates
 */
export const updateLastConnected = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const socket = await prisma.sockets.findFirst({
            where: { device_id: deviceId }
        });

        if (!socket) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device not found'
            });
        }

        // Update socket status to indicate recent activity
        await prisma.sockets.update({
            where: { id: socket.id },
            data: {
                status: 'active',
                updated_at: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Device heartbeat updated successfully'
        });

    } catch (error) {
        console.error('Error updating heartbeat:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device heartbeat',
            error: error.message
        });
    }
};