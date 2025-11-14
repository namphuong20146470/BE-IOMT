import { PrismaClient } from '@prisma/client';
import dynamicMqttManager from '../../Database/mqtt.dynamic.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ====================================================================
// MQTT DEVICE MANAGEMENT CONTROLLER
// ====================================================================

/**
 * GET /mqtt/devices - Get all MQTT enabled devices
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

        let whereConditions = ['dc.mqtt_topic IS NOT NULL'];
        let params = [];
        let paramIndex = 1;

        if (organization_id) {
            whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
            params.push(organization_id);
            paramIndex++;
        }

        if (is_active !== undefined) {
            whereConditions.push(`dc.is_active = $${paramIndex}::boolean`);
            params.push(is_active === 'true');
            paramIndex++;
        }

        if (broker_host) {
            whereConditions.push(`dc.broker_host ILIKE $${paramIndex}`);
            params.push(`%${broker_host}%`);
            paramIndex++;
        }

        if (search) {
            whereConditions.push(`(
                d.serial_number ILIKE $${paramIndex} OR 
                d.asset_tag ILIKE $${paramIndex} OR 
                dm.name ILIKE $${paramIndex} OR
                m.name ILIKE $${paramIndex} OR
                dc.mqtt_topic ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Add limit and offset parameters
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
                dc.id as connectivity_id,
                dc.mqtt_user,
                dc.mqtt_topic,
                dc.broker_host,
                dc.broker_port,
                dc.ssl_enabled,
                dc.heartbeat_interval,
                dc.last_connected,
                dc.is_active,
                dc.created_at as connectivity_created,
                dc.updated_at as connectivity_updated,
                dm.name as model_name,
                m.name as manufacturer,
                dcat.name as category_name,
                o.name as organization_name,
                wi.warranty_end as warranty_end_date,
                CASE 
                    WHEN dc.last_connected IS NULL THEN 'never_connected'
                    WHEN dc.last_connected < NOW() - INTERVAL '5 minutes' THEN 'offline'
                    WHEN dc.last_connected < NOW() - INTERVAL '1 minute' THEN 'idle'
                    ELSE 'online'
                END as connection_status
            FROM device d
            JOIN device_connectivity dc ON d.id = dc.device_id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dcat ON dm.category_id = dcat.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            ${whereClause}
            ORDER BY dc.last_connected DESC NULLS LAST, d.serial_number ASC
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
            JOIN device_connectivity dc ON d.id = dc.device_id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            ${whereClause}
        `, ...countParams);

        const total = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            message: 'MQTT devices retrieved successfully',
            data: {
                devices: filteredDevices,
                pagination: {
                    current_page: parseInt(page),
                    per_page: parseInt(limit),
                    total_items: total,
                    total_pages: Math.ceil(total / parseInt(limit)),
                    has_next: parseInt(page) < Math.ceil(total / parseInt(limit)),
                    has_prev: parseInt(page) > 1
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
 * GET /mqtt/devices/:deviceId - Get specific MQTT device
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
                dc.id as connectivity_id,
                dc.mqtt_user,
                dc.mqtt_topic,
                dc.broker_host,
                dc.broker_port,
                dc.ssl_enabled,
                dc.heartbeat_interval,
                dc.last_connected,
                dc.is_active,
                dc.created_at as connectivity_created,
                dc.updated_at as connectivity_updated,
                dm.name as model_name,
                m.name as manufacturer,
                dm.description as model_description,
                dcat.name as category_name,
                o.name as organization_name,
                o.type as organization_type,
                wi.warranty_end as warranty_end_date,
                CASE 
                    WHEN dc.last_connected IS NULL THEN 'never_connected'
                    WHEN dc.last_connected < NOW() - INTERVAL '5 minutes' THEN 'offline'
                    WHEN dc.last_connected < NOW() - INTERVAL '1 minute' THEN 'idle'
                    ELSE 'online'
                END as connection_status,
                -- Get recent data count
                (
                    SELECT COUNT(*)::integer
                    FROM device_data_logs ddl 
                    WHERE ddl.device_id = d.id 
                    AND ddl.timestamp > NOW() - INTERVAL '24 hours'
                ) as messages_24h
            FROM device d
            JOIN device_connectivity dc ON d.id = dc.device_id
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
                message: 'MQTT device not found'
            });
        }

        // Get recent data samples
        const recentData = await prisma.$queryRawUnsafe(`
            SELECT 
                data_json,
                timestamp
            FROM device_data_logs 
            WHERE device_id = $1::uuid
            ORDER BY timestamp DESC 
            LIMIT 5
        `, deviceId);

        const result = {
            ...device[0],
            recent_data: recentData
        };

        res.status(200).json({
            success: true,
            message: 'MQTT device retrieved successfully',
            data: result
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
        const {
            device_id,
            mqtt_user,
            mqtt_pass,
            mqtt_topic,
            broker_host = 'localhost',
            broker_port = 1883,
            ssl_enabled = false,
            heartbeat_interval = 300,
            is_active = true
        } = req.body;

        // Validation
        if (!device_id) {
            return res.status(400).json({
                success: false,
                message: 'Device ID is required'
            });
        }

        if (!mqtt_topic) {
            return res.status(400).json({
                success: false,
                message: 'MQTT topic is required'
            });
        }

        // Check if device exists
        const deviceExists = await prisma.$queryRaw`
            SELECT id, serial_number, status 
            FROM device 
            WHERE id = ${device_id}::uuid
        `;

        if (deviceExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Check if MQTT configuration already exists
        const existingConn = await prisma.$queryRaw`
            SELECT id FROM device_connectivity WHERE device_id = ${device_id}::uuid
        `;

        if (existingConn.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'MQTT configuration already exists for this device. Use PUT to update.'
            });
        }

        // Check if topic is already in use
        const topicExists = await prisma.$queryRaw`
            SELECT device_id FROM device_connectivity WHERE mqtt_topic = ${mqtt_topic}
        `;

        if (topicExists.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'MQTT topic is already in use by another device'
            });
        }

        // Encrypt password if provided
        const encryptedPass = mqtt_pass ? encryptPassword(mqtt_pass) : null;

        // Create MQTT connectivity configuration
        const connectivity = await prisma.$queryRaw`
            INSERT INTO device_connectivity (
                device_id, mqtt_user, mqtt_pass, mqtt_topic,
                broker_host, broker_port, ssl_enabled, heartbeat_interval,
                is_active
            ) VALUES (
                ${device_id}::uuid, 
                ${mqtt_user || null}, 
                ${encryptedPass}, 
                ${mqtt_topic},
                ${broker_host}, 
                ${broker_port}::integer, 
                ${ssl_enabled}::boolean, 
                ${heartbeat_interval}::integer,
                ${is_active}::boolean
            )
            RETURNING id, device_id, mqtt_user, mqtt_topic, broker_host, 
                     broker_port, ssl_enabled, heartbeat_interval, is_active,
                     created_at, updated_at
        `;

        // Add device to dynamic MQTT manager if active
        if (is_active) {
            try {
                await dynamicMqttManager.addDevice(device_id);
                console.log(`✅ Added device ${device_id} to dynamic MQTT manager`);
            } catch (mqttError) {
                console.error('Error adding device to MQTT manager:', mqttError);
                // Don't fail the request, just log the error
            }
        }

        res.status(201).json({
            success: true,
            message: 'MQTT device configuration created successfully',
            data: connectivity[0]
        });

    } catch (error) {
        console.error('Error creating MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create MQTT device configuration',
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
        const {
            mqtt_user,
            mqtt_pass,
            mqtt_topic,
            broker_host,
            broker_port,
            ssl_enabled,
            heartbeat_interval,
            is_active
        } = req.body;

        // Check if device connectivity exists
        const existingConn = await prisma.$queryRaw`
            SELECT * FROM device_connectivity WHERE device_id = ${deviceId}::uuid
        `;

        if (existingConn.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device configuration not found'
            });
        }

        const currentConfig = existingConn[0];

        // Check if new topic conflicts with another device
        if (mqtt_topic && mqtt_topic !== currentConfig.mqtt_topic) {
            const topicExists = await prisma.$queryRaw`
                SELECT device_id FROM device_connectivity 
                WHERE mqtt_topic = ${mqtt_topic} AND device_id != ${deviceId}::uuid
            `;

            if (topicExists.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'MQTT topic is already in use by another device'
                });
            }
        }

        // Build dynamic update query
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (mqtt_user !== undefined) {
            updateFields.push(`mqtt_user = $${paramIndex}`);
            params.push(mqtt_user);
            paramIndex++;
        }

        if (mqtt_pass !== undefined) {
            const encryptedPass = mqtt_pass ? encryptPassword(mqtt_pass) : null;
            updateFields.push(`mqtt_pass = $${paramIndex}`);
            params.push(encryptedPass);
            paramIndex++;
        }

        if (mqtt_topic !== undefined) {
            updateFields.push(`mqtt_topic = $${paramIndex}`);
            params.push(mqtt_topic);
            paramIndex++;
        }

        if (broker_host !== undefined) {
            updateFields.push(`broker_host = $${paramIndex}`);
            params.push(broker_host);
            paramIndex++;
        }

        if (broker_port !== undefined) {
            updateFields.push(`broker_port = $${paramIndex}::integer`);
            params.push(broker_port);
            paramIndex++;
        }

        if (ssl_enabled !== undefined) {
            updateFields.push(`ssl_enabled = $${paramIndex}::boolean`);
            params.push(ssl_enabled);
            paramIndex++;
        }

        if (heartbeat_interval !== undefined) {
            updateFields.push(`heartbeat_interval = $${paramIndex}::integer`);
            params.push(heartbeat_interval);
            paramIndex++;
        }

        if (is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex}::boolean`);
            params.push(is_active);
            paramIndex++;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(deviceId);

        const updatedConfig = await prisma.$queryRawUnsafe(`
            UPDATE device_connectivity 
            SET ${updateFields.join(', ')}
            WHERE device_id = $${paramIndex}::uuid
            RETURNING id, device_id, mqtt_user, mqtt_topic, broker_host, 
                     broker_port, ssl_enabled, heartbeat_interval, is_active,
                     created_at, updated_at
        `, ...params);

        // Update dynamic MQTT manager
        try {
            if (currentConfig.mqtt_topic !== mqtt_topic) {
                // Remove old topic
                dynamicMqttManager.removeDevice(currentConfig.mqtt_topic);
            }

            if (is_active !== false) {
                // Add/update device in manager
                await dynamicMqttManager.addDevice(deviceId);
            } else {
                // Remove from manager if deactivated
                dynamicMqttManager.removeDevice(mqtt_topic || currentConfig.mqtt_topic);
            }
        } catch (mqttError) {
            console.error('Error updating device in MQTT manager:', mqttError);
        }

        res.status(200).json({
            success: true,
            message: 'MQTT device configuration updated successfully',
            data: updatedConfig[0]
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
 * DELETE /mqtt/devices/:deviceId - Remove MQTT configuration from device
 */
export const deleteMqttDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Get current configuration
        const currentConfig = await prisma.$queryRaw`
            SELECT mqtt_topic FROM device_connectivity WHERE device_id = ${deviceId}::uuid
        `;

        if (currentConfig.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device configuration not found'
            });
        }

        // Remove from dynamic MQTT manager first
        try {
            dynamicMqttManager.removeDevice(currentConfig[0].mqtt_topic);
        } catch (mqttError) {
            console.error('Error removing device from MQTT manager:', mqttError);
        }

        // Delete configuration
        await prisma.$queryRaw`
            DELETE FROM device_connectivity WHERE device_id = ${deviceId}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'MQTT device configuration deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting MQTT device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete MQTT device configuration',
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

        const updated = await prisma.$queryRaw`
            UPDATE device_connectivity 
            SET is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE device_id = ${deviceId}::uuid
            RETURNING id, mqtt_topic
        `;

        if (updated.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device configuration not found'
            });
        }

        // Add to dynamic MQTT manager
        try {
            await dynamicMqttManager.addDevice(deviceId);
        } catch (mqttError) {
            console.error('Error activating device in MQTT manager:', mqttError);
        }

        res.status(200).json({
            success: true,
            message: 'MQTT device activated successfully',
            data: { device_id: deviceId, is_active: true }
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

        const currentConfig = await prisma.$queryRaw`
            SELECT mqtt_topic FROM device_connectivity WHERE device_id = ${deviceId}::uuid
        `;

        if (currentConfig.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'MQTT device configuration not found'
            });
        }

        // Update to inactive
        await prisma.$queryRaw`
            UPDATE device_connectivity 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE device_id = ${deviceId}::uuid
        `;

        // Remove from dynamic MQTT manager
        try {
            dynamicMqttManager.removeDevice(currentConfig[0].mqtt_topic);
        } catch (mqttError) {
            console.error('Error deactivating device in MQTT manager:', mqttError);
        }

        res.status(200).json({
            success: true,
            message: 'MQTT device deactivated successfully',
            data: { device_id: deviceId, is_active: false }
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
        const {
            hours = 24,
            limit = 100,
            page = 1
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const data = await prisma.$queryRawUnsafe(`
            SELECT 
                data_json,
                timestamp,
                timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' as local_time
            FROM device_data_logs 
            WHERE device_id = $1::uuid
            AND timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, deviceId, parseInt(limit), offset);

        // Get total count
        const totalResult = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::integer as total
            FROM device_data_logs 
            WHERE device_id = $1::uuid
            AND timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
        `, deviceId);

        const total = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            message: 'Device data retrieved successfully',
            data: {
                records: data,
                pagination: {
                    current_page: parseInt(page),
                    per_page: parseInt(limit),
                    total_items: total,
                    total_pages: Math.ceil(total / parseInt(limit))
                },
                period: `${hours} hours`
            }
        });

    } catch (error) {
        console.error('Error getting device data:', error);
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
        const status = dynamicMqttManager.getConnectionStatus();
        const activeTopics = dynamicMqttManager.getActiveTopics();

        // Get database statistics
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*)::integer as total_devices,
                COUNT(CASE WHEN dc.is_active = true THEN 1 END)::integer as active_devices,
                COUNT(CASE WHEN dc.last_connected > NOW() - INTERVAL '5 minutes' THEN 1 END)::integer as online_devices,
                COUNT(CASE WHEN dc.last_connected IS NULL THEN 1 END)::integer as never_connected,
                COUNT(DISTINCT dc.broker_host)::integer as unique_brokers
            FROM device_connectivity dc
            WHERE dc.mqtt_topic IS NOT NULL
        `;

        res.status(200).json({
            success: true,
            message: 'MQTT status retrieved successfully',
            data: {
                manager_status: status,
                active_topics: activeTopics,
                database_stats: stats[0],
                system_info: {
                    uptime: process.uptime(),
                    node_version: process.version,
                    memory_usage: process.memoryUsage()
                }
            }
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
 * POST /mqtt/test-publish - Test publish message to device topic
 */
export const testPublishMessage = async (req, res) => {
    try {
        const { device_id, message, topic_override } = req.body;

        if (!device_id && !topic_override) {
            return res.status(400).json({
                success: false,
                message: 'Device ID or topic override is required'
            });
        }

        let targetTopic = topic_override;

        if (device_id && !topic_override) {
            const deviceConn = await prisma.$queryRaw`
                SELECT mqtt_topic FROM device_connectivity 
                WHERE device_id = ${device_id}::uuid AND is_active = true
            `;

            if (deviceConn.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Active MQTT device not found'
                });
            }

            targetTopic = deviceConn[0].mqtt_topic;
        }

        // For testing, we'll just simulate the message handling
        // In a real implementation, you'd publish to the broker
        const testMessage = message || {
            test: true,
            timestamp: new Date().toISOString(),
            value: Math.random() * 100
        };

        await dynamicMqttManager.handleMessage(targetTopic, Buffer.from(JSON.stringify(testMessage)));

        res.status(200).json({
            success: true,
            message: 'Test message processed successfully',
            data: {
                topic: targetTopic,
                message: testMessage,
                processed_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error testing publish:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test publish message',
            error: error.message
        });
    }
};

/**
 * POST /mqtt/devices/:deviceId/publish - Publish data to specific device
 */
export const publishToDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const messageData = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Device ID is required'
            });
        }

        // Get device MQTT configuration
        const deviceConn = await prisma.$queryRaw`
            SELECT dc.mqtt_topic, dc.is_active, d.serial_number, d.asset_tag
            FROM device_connectivity dc
            JOIN device d ON dc.device_id = d.id
            WHERE dc.device_id = ${deviceId}::uuid AND dc.is_active = true
        `;

        if (deviceConn.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Active MQTT device not found'
            });
        }

        const device = deviceConn[0];
        const targetTopic = device.mqtt_topic;

        // Add metadata to message
        const messageWithMetadata = {
            ...messageData,
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            serial_number: device.serial_number,
            asset_tag: device.asset_tag
        };

        // Process message through dynamic MQTT manager
        await dynamicMqttManager.handleMessage(targetTopic, Buffer.from(JSON.stringify(messageWithMetadata)));

        res.status(200).json({
            success: true,
            message: 'Data published successfully',
            data: {
                device_id: deviceId,
                topic: targetTopic,
                message: messageWithMetadata,
                processed_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error publishing to device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish data to device',
            error: error.message
        });
    }
};

// Helper function to encrypt passwords
const encryptPassword = (password) => {
    const algorithm = 'aes-256-cbc';
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};