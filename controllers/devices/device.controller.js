import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// ✅ Helper function to safely get user permissions
function getUserPermissions(user) {
    return Array.isArray(user?.permissions) ? user.permissions : [];
}

// ✅ Helper function to check permission safely
function hasPermission(user, permission) {
    const permissions = getUserPermissions(user);
    return permissions.includes(permission);
}

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

        // Check Super Admin (System Admin)
        const user = req.user;
        const isSuperAdmin = user?.role === 'system.admin' || 
        (!user?.organization_id && !user?.department_id);

        if (!isSuperAdmin) {
            // Normal user / org admin
            const userOrgId = user?.organization_id;
            if (!userOrgId) {
                return res.status(403).json({
                    success: false,
                    message: 'User organization not found'
                });
            }

            // Force organization filter
            whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
            params.push(userOrgId);
            paramIndex++;

            // Validate organization filter in query
            if (organization_id && organization_id !== userOrgId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Cannot access devices from different organization'
                });
            }

            // Department filter
            const userDeptId = user?.department_id;
            if (userDeptId) {
                if (department_id && department_id !== userDeptId) {
                    const hasPermissionToViewAllDepts = hasPermission(user, 'view_all_departments');
                    if (!hasPermissionToViewAllDepts) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Cannot access devices from different department'
                        });
                    }
                }
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(department_id || userDeptId);
                paramIndex++;
            } else if (department_id) {
                const hasPermissionToViewAllDepts = hasPermission(user, 'view_all_departments');
                if (!hasPermissionToViewAllDepts) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied: No permission to filter by department'
                    });
                }
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(department_id);
                paramIndex++;
            }
        } else {
            // Super Admin: allow filter any org/dep if passed
            if (organization_id) {
                whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
                params.push(organization_id);
                paramIndex++;
            }
            if (department_id) {
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(department_id);
                paramIndex++;
            }
        }

        // Other filters
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
        params.push(parseInt(limit), offset);

        const devices = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status,
                d.purchase_date, d.installation_date, d.created_at, d.updated_at,
                d.model_id, d.organization_id, d.department_id,
                dm.name as model_name, m.name as manufacturer,
                dc.name as category_name,
                o.id as organization_id_ref, o.name as organization_name,
                dept.id as department_id_ref, dept.name as department_name,
                wi.warranty_end,
                CASE 
                    WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    ELSE 'valid'
                END as warranty_status,
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
            LIMIT $${paramIndex} OFFSET $${paramIndex+1}
        `, ...params);

        // Total count
        const countParams = params.slice(0, -2);
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
                dm.name as model_name, m.name as manufacturer,
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
            const hasPermissionToViewAllDepts = hasPermission(req.user, 'view_all_departments');
            if (!hasPermissionToViewAllDepts) {
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
            organization_id,  // Optional - sẽ được validate
            department_id,    // Optional - sẽ được validate  
            serial_number,
            asset_tag,
            status = 'active',
            purchase_date,
            installation_date
        } = req.body;

        // ====================================================================
        // 1. BASIC VALIDATION
        // ====================================================================
        if (!model_id || !serial_number) {
            return res.status(400).json({
                success: false,
                message: 'Model ID and serial number are required'
            });
        }

        // ====================================================================
        // 2. USER ORGANIZATION & DEPARTMENT VALIDATION
        // ====================================================================
        const userOrgId = req.user?.organization_id;
        const userDeptId = req.user?.department_id;
        const userPermissions = getUserPermissions(req.user);

        if (!userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        // ====================================================================
        // 3. ORGANIZATION VALIDATION BASED ON USER ROLE
        // ====================================================================
        let finalOrganizationId = userOrgId; // Default to user's org

        // Check if user is trying to create in different organization
        if (organization_id && organization_id !== userOrgId) {
            // Only System Admin can create in different orgs
            const isSystemAdmin = hasPermission(req.user, 'system.admin');

            if (!isSystemAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Only System Admin can create devices in different organization'
                });
            }

            // Validate target organization exists
            const orgExists = await prisma.$queryRaw`
                SELECT id, name FROM organizations WHERE id = ${organization_id}::uuid AND is_active = true
            `;
            if (orgExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Target organization not found or inactive'
                });
            }

            finalOrganizationId = organization_id;
        }

        // ====================================================================
        // 4. DEPARTMENT VALIDATION BASED ON USER ROLE  
        // ====================================================================
        let finalDepartmentId = null;

        if (department_id) {
            // Check if department belongs to target organization
            const deptExists = await prisma.$queryRaw`
                SELECT id, name FROM departments 
                WHERE id = ${department_id}::uuid 
                AND organization_id = ${finalOrganizationId}::uuid 
                AND is_active = true
            `;
            
            if (deptExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Department not found in target organization or inactive'
                });
            }

            // Check if user can create in this department
            if (userDeptId && department_id !== userDeptId) {
                // User trying to create in different department
                const canCreateCrossDept = hasPermission(req.user, 'device.create.all_departments') ||
                                          hasPermission(req.user, 'department.manage') ||
                                          hasPermission(req.user, 'organization.admin');
                
                if (!canCreateCrossDept) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied: Cannot create devices in different department'
                    });
                }
            }

            finalDepartmentId = department_id;
        } else {
            // No department specified - auto-assign user's department if exists
            finalDepartmentId = userDeptId;
        }

        // ====================================================================
        // 5. MODEL VALIDATION
        // ====================================================================
        const modelExists = await prisma.$queryRaw`
            SELECT dm.id, dm.name, dc.name as category_name
            FROM device_models dm
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            WHERE dm.id = ${model_id}::uuid
        `;
        
        if (modelExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Device model not found or inactive'
            });
        }

        // ====================================================================
        // 6. DUPLICATE CHECKS
        // ====================================================================
        
        // Check serial number globally unique
        const duplicateSerial = await prisma.$queryRaw`
            SELECT id, organization_id FROM device WHERE serial_number = ${serial_number}
        `;
        if (duplicateSerial.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Device with this serial number already exists',
                conflict: {
                    field: 'serial_number',
                    value: serial_number,
                    existing_device_id: duplicateSerial[0].id
                }
            });
        }

        // Check asset tag unique within organization
        if (asset_tag) {
            const duplicateAssetTag = await prisma.$queryRaw`
                SELECT id FROM device 
                WHERE organization_id = ${finalOrganizationId}::uuid 
                AND asset_tag = ${asset_tag}
            `;
            if (duplicateAssetTag.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Asset tag already exists in this organization',
                    conflict: {
                        field: 'asset_tag',
                        value: asset_tag,
                        organization_id: finalOrganizationId
                    }
                });
            }
        }

        // ====================================================================
        // 7. CREATE DEVICE WITH CONNECTIVITY
        // ====================================================================
        
        const purchaseDateValue = purchase_date ? new Date(purchase_date) : null;
        const installationDateValue = installation_date ? new Date(installation_date) : null;

        // Use transaction to create both device and device_connectivity
        const result = await prisma.$transaction(async (tx) => {
            // Create device record
            const newDevice = await tx.$queryRaw`
                INSERT INTO device (
                    model_id, 
                    organization_id, 
                    department_id, 
                    serial_number, 
                    asset_tag, 
                    status, 
                    purchase_date, 
                    installation_date,
                    created_at, 
                    updated_at
                )
                VALUES (
                    ${model_id}::uuid, 
                    ${finalOrganizationId}::uuid, 
                    ${finalDepartmentId}::uuid,
                    ${serial_number}, 
                    ${asset_tag || null}, 
                    ${status}::device_status,
                    ${purchaseDateValue}::date,
                    ${installationDateValue}::date,
                    ${getVietnamDate()}::timestamptz,
                    ${getVietnamDate()}::timestamptz
                )
                RETURNING id
            `;

            const deviceId = newDevice[0].id;

            // Create device_connectivity record (this table has is_active)
            await tx.$queryRaw`
                INSERT INTO device_connectivity (
                    device_id,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${deviceId}::uuid,
                    true,
                    ${getVietnamDate()}::timestamptz,
                    ${getVietnamDate()}::timestamptz
                )
            `;

            return newDevice[0];
        });

        // ====================================================================
        // 8. GET CREATED DEVICE WITH FULL INFO
        // ====================================================================
        const createdDeviceInfo = await prisma.$queryRaw`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status,
                d.created_at, d.organization_id, d.department_id,
                dm.name as model_name,
                o.name as organization_name,
                dept.name as department_name,
                dc.name as category_name,
                conn.is_active as connectivity_active
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id  
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN device_connectivity conn ON d.id = conn.device_id
            WHERE d.id = ${result.id}::uuid
        `;

        res.status(201).json({
            success: true,
            data: createdDeviceInfo[0],
            message: 'Device created successfully',
            created_by: {
                user_id: req.user.id,
                username: req.user.username,
                organization_id: req.user.organization_id,
                department_id: req.user.department_id
            }
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
