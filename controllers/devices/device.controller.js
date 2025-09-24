import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Get all devices with filtering
export const getAllDevices = async (req, res) => {
    try {
        const { 
            organization_id, 
            department_id, 
            model_id, 
            status, 
            manufacturer,
            category_id,
            page = 1, 
            limit = 50 
        } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // **SECURITY: Always filter by user's organization**
        const userOrgId = req.user?.organization_id;
        if (!userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        // Force organization filter based on user's organization
        whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
        params.push(userOrgId);
        paramIndex++;

        // Additional organization filter from query (must match user's org)
        if (organization_id && organization_id !== userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot access devices from different organization'
            });
        }

        // **DEPARTMENT FILTER: Only show user's department devices if user has department**
        const userDeptId = req.user?.department_id;
        if (userDeptId) {
            // If user has department, only show devices from their department (unless they request specific dept)
            if (department_id) {
                // Validate user can access requested department
                if (department_id !== userDeptId) {
                    // Check if user has permission to view other departments
                    const hasPermission = req.user?.permissions?.includes('view_all_departments') || false;
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Cannot access devices from different department'
                        });
                    }
                }
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(department_id);
                paramIndex++;
            } else {
                // Auto-filter by user's department if no specific department requested
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(userDeptId);
                paramIndex++;
            }
        } else if (department_id) {
            // User has no department but requests specific department - check permission
            const hasPermission = req.user?.permissions?.includes('view_all_departments') || false;
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: No permission to filter by department'
                });
            }
            whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
            params.push(department_id);
            paramIndex++;
        }
        
        if (department_id) {
            whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
            params.push(department_id);
            paramIndex++;
        }
        
        if (model_id) {
            whereConditions.push(`d.model_id = $${paramIndex}::uuid`);
            params.push(model_id);
            paramIndex++;
        }
        
        if (status) {
            whereConditions.push(`d.status = $${paramIndex}::device_status`);
            params.push(status);
            paramIndex++;
        }

        if (manufacturer) {
            whereConditions.push(`m.name ILIKE $${paramIndex}`);
            params.push(`%${manufacturer}%`);
            paramIndex++;
        }

        if (category_id) {
            whereConditions.push(`dc.id = $${paramIndex}::uuid`);
            params.push(category_id);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Add limit and offset parameters
        const limitParamIndex = paramIndex;
        const offsetParamIndex = paramIndex + 1;
        params.push(parseInt(limit), offset);

        const devices = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status,
                d.purchase_date, d.installation_date, d.created_at, d.updated_at,
                d.model_id, d.organization_id, d.department_id,
                dm.name as model_name, m.name as manufacturer, dm.specifications,
                dc.name as category_name,
                o.id as organization_id_ref, o.name as organization_name,
                dept.id as department_id_ref, dept.name as department_name,
                -- Warranty info
                wi.warranty_end,
                CASE 
                    WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    ELSE 'valid'
                END as warranty_status,
                -- Connectivity status
                conn.last_connected,
                conn.is_active as connectivity_active,
                CASE 
                    WHEN conn.last_connected IS NULL THEN 'never_connected'
                    WHEN conn.last_connected < NOW() - INTERVAL '1 hour' THEN 'offline'
                    ELSE 'online'
                END as connection_status
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            LEFT JOIN device_connectivity conn ON d.id = conn.device_id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
        `, ...params);

        // Get total count
        const countParams = params.slice(0, -2); // Remove limit and offset
        const totalResult = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::integer as total
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            ${whereClause}
        `, ...countParams);

        const total = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: devices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            message: 'Devices retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch devices',
            error: error.message
        });
    }
};

// Get device by ID with full details
export const getDeviceById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID format. Must be a valid UUID.'
            });
        }

        // **SECURITY: Filter by user's organization**
        const userOrgId = req.user?.organization_id;
        if (!userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        const device = await prisma.$queryRaw`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status,
                d.purchase_date, d.installation_date, d.created_at, d.updated_at,
                d.model_id, d.organization_id, d.department_id,
                dm.name as model_name, m.name as manufacturer, dm.specifications,
                dc.name as category_name, dc.description as category_description,
                o.name as organization_name,
                dept.name as department_name,
                -- Warranty info
                wi.warranty_start, wi.warranty_end, wi.provider as warranty_provider,
                -- Connectivity info
                conn.mqtt_user, conn.mqtt_topic, conn.broker_host, conn.broker_port,
                conn.ssl_enabled, conn.heartbeat_interval, conn.last_connected, conn.is_active
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            LEFT JOIN device_connectivity conn ON d.id = conn.device_id
            WHERE d.id = ${id}::uuid 
            AND d.organization_id = ${userOrgId}::uuid
        `;

        if (device.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        // **DEPARTMENT LEVEL CHECK**
        const userDeptId = req.user?.department_id;
        if (userDeptId && device[0].department_id && device[0].department_id !== userDeptId) {
            // Check if user has permission to view other departments
            const hasPermission = req.user?.permissions?.includes('view_all_departments') || false;
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Cannot access device from different department'
                });
            }
        }

        res.status(200).json({
            success: true,
            data: device[0],
            message: 'Device retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device',
            error: error.message
        });
    }
};

// Create device
export const createDevice = async (req, res) => {
    try {
        const {
            model_id,
            organization_id,
            department_id,
            serial_number,
            asset_tag,
            status = 'active',
            purchase_date,
            installation_date
        } = req.body;

        if (!model_id || !organization_id || !serial_number) {
            return res.status(400).json({
                success: false,
                message: 'Model ID, organization ID, and serial number are required'
            });
        }

        // Check if model exists
        const modelExists = await prisma.$queryRaw`
            SELECT id FROM device_models WHERE id = ${model_id}::uuid
        `;
        if (modelExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Device model not found'
            });
        }

        // Check if organization exists
        const orgExists = await prisma.$queryRaw`
            SELECT id FROM organizations WHERE id = ${organization_id}::uuid
        `;
        if (orgExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check if department exists (if provided)
        if (department_id) {
            const deptExists = await prisma.$queryRaw`
                SELECT id FROM departments WHERE id = ${department_id}::uuid
            `;
            if (deptExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Department not found'
                });
            }
        }

        // Check for duplicate serial number
        const duplicateSerial = await prisma.$queryRaw`
            SELECT id FROM device WHERE serial_number = ${serial_number}
        `;
        if (duplicateSerial.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Device with this serial number already exists'
            });
        }

        // Check for duplicate asset tag within organization
        if (asset_tag) {
            const duplicateAssetTag = await prisma.$queryRaw`
                SELECT id FROM device 
                WHERE organization_id = ${organization_id}::uuid 
                AND asset_tag = ${asset_tag}
            `;
            if (duplicateAssetTag.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Asset tag already exists in this organization'
                });
            }
        }

        // Handle optional date fields
        const purchaseDateValue = purchase_date ? new Date(purchase_date) : null;
        const installationDateValue = installation_date ? new Date(installation_date) : null;
        const departmentIdValue = department_id || null;

        const newDevice = await prisma.$queryRaw`
            INSERT INTO device (
                model_id, organization_id, department_id, serial_number, 
                asset_tag, status, purchase_date, installation_date,
                created_at, updated_at
            )
            VALUES (
                ${model_id}::uuid, 
                ${organization_id}::uuid, 
                ${departmentIdValue}::uuid,
                ${serial_number}, 
                ${asset_tag || null}, 
                ${status}::device_status,
                ${purchaseDateValue}::date,
                ${installationDateValue}::date,
                ${getVietnamDate()}::timestamptz,
                ${getVietnamDate()}::timestamptz
            )
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            data: newDevice[0],
            message: 'Device created successfully'
        });
    } catch (error) {
        console.error('Error creating device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create device',
            error: error.message
        });
    }
};

// Update device
export const updateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            model_id,
            organization_id,
            department_id,
            serial_number,
            asset_tag,
            status,
            purchase_date,
            installation_date
        } = req.body;

        // Check if device exists
        const existingDevice = await prisma.$queryRaw`
            SELECT * FROM device WHERE id = ${id}::uuid
        `;
        if (existingDevice.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Build update query dynamically
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (model_id) {
            // Check model exists
            const modelExists = await prisma.$queryRaw`
                SELECT id FROM device_models WHERE id = ${model_id}::uuid
            `;
            if (modelExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Device model not found'
                });
            }
            updateFields.push(`model_id = $${paramIndex}::uuid`);
            params.push(model_id);
            paramIndex++;
        }

        if (organization_id) {
            updateFields.push(`organization_id = $${paramIndex}::uuid`);
            params.push(organization_id);
            paramIndex++;
        }

        if (department_id !== undefined) {
            updateFields.push(`department_id = $${paramIndex}::uuid`);
            params.push(department_id);
            paramIndex++;
        }

        if (serial_number) {
            updateFields.push(`serial_number = $${paramIndex}`);
            params.push(serial_number);
            paramIndex++;
        }

        if (asset_tag !== undefined) {
            updateFields.push(`asset_tag = $${paramIndex}`);
            params.push(asset_tag);
            paramIndex++;
        }

        if (status) {
            updateFields.push(`status = $${paramIndex}::device_status`);
            params.push(status);
            paramIndex++;
        }

        if (purchase_date !== undefined) {
            updateFields.push(`purchase_date = $${paramIndex}::date`);
            params.push(purchase_date);
            paramIndex++;
        }

        if (installation_date !== undefined) {
            updateFields.push(`installation_date = $${paramIndex}::date`);
            params.push(installation_date);
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
        const updatedDevice = await prisma.$queryRawUnsafe(`
            UPDATE device 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}::uuid
            RETURNING *
        `, ...params);

        res.status(200).json({
            success: true,
            data: updatedDevice[0],
            message: 'Device updated successfully'
        });
    } catch (error) {
        console.error('Error updating device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device',
            error: error.message
        });
    }
};

// Delete device
export const deleteDevice = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if device exists
        const existingDevice = await prisma.$queryRaw`
            SELECT id FROM device WHERE id = ${id}::uuid
        `;
        if (existingDevice.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Delete device (cascades will handle related records)
        await prisma.$queryRaw`
            DELETE FROM device WHERE id = ${id}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'Device deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete device',
            error: error.message
        });
    }
};

// Get device statistics
export const getDeviceStatistics = async (req, res) => {
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
                COUNT(CASE WHEN d.status = 'active' THEN 1 END)::integer as active_devices,
                COUNT(CASE WHEN d.status = 'inactive' THEN 1 END)::integer as inactive_devices,
                COUNT(CASE WHEN d.status = 'maintenance' THEN 1 END)::integer as maintenance_devices,
                COUNT(CASE WHEN d.status = 'decommissioned' THEN 1 END)::integer as decommissioned_devices,
                COUNT(CASE WHEN conn.last_connected > NOW() - INTERVAL '1 hour' THEN 1 END)::integer as online_devices,
                COUNT(CASE WHEN wi.warranty_end < CURRENT_DATE THEN 1 END)::integer as expired_warranties,
                COUNT(CASE WHEN wi.warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::integer as expiring_warranties
            FROM device d
            LEFT JOIN device_connectivity conn ON d.id = conn.device_id
            LEFT JOIN warranty_info wi ON d.id = wi.device_id
            ${whereCondition}
        `, ...params);

        res.status(200).json({
            success: true,
            data: stats[0],
            message: 'Device statistics retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device statistics',
            error: error.message
        });
    }
};
