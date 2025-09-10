import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Encrypt MQTT password
const encryptPassword = (password) => {
    const algorithm = 'aes-256-cbc';
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

// Decrypt MQTT password
const decryptPassword = (encryptedPassword) => {
    try {
        const algorithm = 'aes-256-cbc';
        const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!';
        const parts = encryptedPassword.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipher(algorithm, key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        return null; // Return null if decryption fails
    }
};

// Get device connectivity by device ID
export const getDeviceConnectivity = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const connectivity = await prisma.$queryRaw`
            SELECT 
                dc.id, dc.device_id, dc.mqtt_user, dc.mqtt_topic,
                dc.broker_host, dc.broker_port, dc.ssl_enabled,
                dc.heartbeat_interval, dc.last_connected, dc.is_active,
                dc.created_at, dc.updated_at,
                d.serial_number, d.asset_tag,
                dm.name as model_name, dm.manufacturer
            FROM device_connectivity dc
            LEFT JOIN device d ON dc.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            WHERE dc.device_id = ${deviceId}::uuid
        `;

        if (connectivity.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device connectivity configuration not found'
            });
        }

        // Don't return encrypted password in response
        const result = connectivity[0];
        delete result.mqtt_pass;

        res.status(200).json({
            success: true,
            data: result,
            message: 'Device connectivity retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device connectivity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device connectivity',
            error: error.message
        });
    }
};

// Get all device connectivities with filtering
export const getAllDeviceConnectivities = async (req, res) => {
    try {
        const { 
            organization_id, 
            is_active, 
            broker_host,
            page = 1, 
            limit = 50 
        } = req.query;

        let whereConditions = [];
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

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        const connectivities = await prisma.$queryRawUnsafe(`
            SELECT 
                dc.id, dc.device_id, dc.mqtt_user, dc.mqtt_topic,
                dc.broker_host, dc.broker_port, dc.ssl_enabled,
                dc.heartbeat_interval, dc.last_connected, dc.is_active,
                dc.created_at, dc.updated_at,
                d.serial_number, d.asset_tag, d.status as device_status,
                dm.name as model_name, dm.manufacturer,
                o.org_name as organization_name,
                CASE 
                    WHEN dc.last_connected IS NULL THEN 'never_connected'
                    WHEN dc.last_connected < NOW() - INTERVAL '1 hour' THEN 'offline'
                    ELSE 'online'
                END as connection_status
            FROM device_connectivity dc
            LEFT JOIN device d ON dc.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN organizations o ON d.organization_id = o.org_id
            ${whereClause}
            ORDER BY dc.last_connected DESC NULLS LAST
            LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
        `, ...params);

        // Get total count
        const countParams = params.slice(0, -2);
        const totalResult = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::integer as total
            FROM device_connectivity dc
            LEFT JOIN device d ON dc.device_id = d.id
            LEFT JOIN organizations o ON d.organization_id = o.org_id
            ${whereClause}
        `, ...countParams);

        const total = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: connectivities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            message: 'Device connectivities retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device connectivities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device connectivities',
            error: error.message
        });
    }
};

// Create device connectivity
export const createDeviceConnectivity = async (req, res) => {
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

        if (!device_id) {
            return res.status(400).json({
                success: false,
                message: 'Device ID is required'
            });
        }

        // Check if device exists
        const deviceExists = await prisma.$queryRaw`
            SELECT id FROM device WHERE id = ${device_id}::uuid
        `;
        if (deviceExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Check if connectivity already exists for this device
        const existingConn = await prisma.$queryRaw`
            SELECT id FROM device_connectivity WHERE device_id = ${device_id}::uuid
        `;
        if (existingConn.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Connectivity configuration already exists for this device'
            });
        }

        // Encrypt password if provided
        const encryptedPass = mqtt_pass ? encryptPassword(mqtt_pass) : null;

        const newConnectivity = await prisma.$queryRaw`
            INSERT INTO device_connectivity (
                device_id, mqtt_user, mqtt_pass, mqtt_topic,
                broker_host, broker_port, ssl_enabled, heartbeat_interval,
                is_active, created_at, updated_at
            )
            VALUES (
                ${device_id}::uuid, ${mqtt_user || null}, ${encryptedPass},
                ${mqtt_topic || null}, ${broker_host}, ${broker_port}::integer,
                ${ssl_enabled}::boolean, ${heartbeat_interval}::integer,
                ${is_active}::boolean, ${getVietnamDate()}::timestamptz,
                ${getVietnamDate()}::timestamptz
            )
            RETURNING id, device_id, mqtt_user, mqtt_topic, broker_host, 
                     broker_port, ssl_enabled, heartbeat_interval, is_active,
                     created_at, updated_at
        `;

        res.status(201).json({
            success: true,
            data: newConnectivity[0],
            message: 'Device connectivity created successfully'
        });
    } catch (error) {
        console.error('Error creating device connectivity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create device connectivity',
            error: error.message
        });
    }
};

// Update device connectivity
export const updateDeviceConnectivity = async (req, res) => {
    try {
        const { id } = req.params;
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

        // Check if connectivity exists
        const existingConn = await prisma.$queryRaw`
            SELECT * FROM device_connectivity WHERE id = ${id}::uuid
        `;
        if (existingConn.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device connectivity not found'
            });
        }

        // Build update query dynamically
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

        updateFields.push(`updated_at = $${paramIndex}::timestamptz`);
        params.push(getVietnamDate());
        paramIndex++;

        params.push(id);
        const updatedConnectivity = await prisma.$queryRawUnsafe(`
            UPDATE device_connectivity 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}::uuid
            RETURNING id, device_id, mqtt_user, mqtt_topic, broker_host, 
                     broker_port, ssl_enabled, heartbeat_interval, is_active,
                     created_at, updated_at
        `, ...params);

        res.status(200).json({
            success: true,
            data: updatedConnectivity[0],
            message: 'Device connectivity updated successfully'
        });
    } catch (error) {
        console.error('Error updating device connectivity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device connectivity',
            error: error.message
        });
    }
};

// Update last connected timestamp
export const updateLastConnected = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const updated = await prisma.$queryRaw`
            UPDATE device_connectivity 
            SET last_connected = ${getVietnamDate()}::timestamptz,
                updated_at = ${getVietnamDate()}::timestamptz
            WHERE device_id = ${deviceId}::uuid
            RETURNING id, device_id, last_connected
        `;

        if (updated.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device connectivity not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updated[0],
            message: 'Last connected timestamp updated successfully'
        });
    } catch (error) {
        console.error('Error updating last connected:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update last connected timestamp',
            error: error.message
        });
    }
};

// Delete device connectivity
export const deleteDeviceConnectivity = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.$queryRaw`
            DELETE FROM device_connectivity WHERE id = ${id}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'Device connectivity deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device connectivity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete device connectivity',
            error: error.message
        });
    }
};

// Get connectivity statistics
export const getConnectivityStatistics = async (req, res) => {
    try {
        const { organization_id } = req.query;

        let whereCondition = '';
        let params = [];
        
        if (organization_id) {
            whereCondition = 'WHERE d.organization_id = $1::uuid';
            params.push(organization_id);
        }

        const stats = await prisma.$queryRawUnsafe(`
            SELECT 
                COUNT(*)::integer as total_devices,
                COUNT(CASE WHEN dc.is_active = true THEN 1 END)::integer as active_configs,
                COUNT(CASE WHEN dc.last_connected > NOW() - INTERVAL '1 hour' THEN 1 END)::integer as online_now,
                COUNT(CASE WHEN dc.last_connected > NOW() - INTERVAL '1 day' THEN 1 END)::integer as online_24h,
                COUNT(CASE WHEN dc.last_connected IS NULL THEN 1 END)::integer as never_connected,
                COUNT(CASE WHEN dc.ssl_enabled = true THEN 1 END)::integer as ssl_enabled_count
            FROM device_connectivity dc
            LEFT JOIN device d ON dc.device_id = d.id
            ${whereCondition}
        `, ...params);

        res.status(200).json({
            success: true,
            data: stats[0],
            message: 'Connectivity statistics retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching connectivity statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch connectivity statistics',
            error: error.message
        });
    }
};
