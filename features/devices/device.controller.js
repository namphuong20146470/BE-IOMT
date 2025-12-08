import { PrismaClient } from '@prisma/client';
import AuditLogger from '../../shared/services/AuditLogger.js';

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

// ✅ Helper function to ensure consistency between visibility and department_id
function validateVisibilityDepartmentConsistency(visibility, department_id) {
    const result = {
        visibility,
        department_id,
        warnings: []
    };

    // Business rules:
    // 1. Private devices should not have department_id
    if (visibility === 'private' && department_id) {
        result.department_id = null;
        result.warnings.push('Department assignment removed because device visibility is private');
    }

    // 2. Department visibility should ideally have a department_id (but not mandatory)
    if (visibility === 'department' && !department_id) {
        result.warnings.push('Device has department visibility but no department assignment');
    }

    return result;
}

export const getAllDevices = async (req, res) => {
    try {
        const { 
            organization_id, 
            department_id, 
            model_id, 
            status,
            assigned, // ✅ Add assigned filter
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
        const userPermissions = getUserPermissions(user);
        const isSuperAdmin = (userPermissions.includes('system.admin') ||
                            hasPermission(user, 'system.admin')) &&
                           !user?.organization_id &&
                           !user?.department_id;

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

            // Department filter - only when explicitly requested
            const userDeptId = user?.department_id;
            if (department_id) {
                if (userDeptId && department_id !== userDeptId) {
                    const hasPermissionToViewAllDepts = hasPermission(user, 'view_all_departments');
                    if (!hasPermissionToViewAllDepts) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Cannot access devices from different department'
                        });
                    }
                }
                whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
                params.push(department_id);
                paramIndex++;
            }

            // Visibility-based access control
            const canManageDevices = hasPermission(user, 'device.manage') ||
                                   hasPermission(user, 'organization.admin') ||
                                   hasPermission(user, 'department.manage');
            
            if (canManageDevices) {
                // Admin/Manager: see public + department devices (private devices only visible to superadmin)
                if (userDeptId && !department_id) {
                    whereConditions.push(`(
                        d.visibility = 'public' OR 
                        (d.visibility = 'department' AND d.department_id = $${paramIndex}::uuid)
                    )`);
                    params.push(userDeptId);
                    paramIndex++;
                } else if (!department_id) {
                    whereConditions.push(`d.visibility = 'public'`);
                }
            } else if (userDeptId && !department_id) {
                // Regular user has department: show public + their department devices
                whereConditions.push(`(
                    d.visibility = 'public' OR 
                    (d.visibility = 'department' AND d.department_id = $${paramIndex}::uuid)
                )`);
                params.push(userDeptId);
                paramIndex++;
            } else if (!department_id) {
                // Regular user has no department: show only public devices
                whereConditions.push(`d.visibility = 'public'`);
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

        // ✅ Filter by assignment status
        if (assigned !== undefined) {
            if (assigned === 'false' || assigned === false) {
                // Show only unassigned devices (no socket assignment)
                whereConditions.push(`NOT EXISTS (
                    SELECT 1 FROM sockets s 
                    WHERE s.device_id = d.id
                )`);
            } else if (assigned === 'true' || assigned === true) {
                // Show only assigned devices (has socket assignment)
                whereConditions.push(`EXISTS (
                    SELECT 1 FROM sockets s 
                    WHERE s.device_id = d.id
                )`);
            }
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        const devices = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status, d.visibility, d.location,
                d.created_at, d.updated_at,
                dm.name as model_name, m.name as manufacturer,
                dc.name as category_name,
                o.id as organization_id,
                o.name as organization_name,
                dept.id as department_id,
                dept.name as department_name
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
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

        // **SECURITY: Check user permissions**
        const user = req.user;
        const userOrgId = user?.organization_id;
        const userPermissions = getUserPermissions(user);
        const isSuperAdmin = (userPermissions.includes('system.admin') ||
                            hasPermission(user, 'system.admin')) &&
                           !user?.organization_id &&
                           !user?.department_id;

        if (!isSuperAdmin && !userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        let device;
        
        if (isSuperAdmin) {
            // Super admin can access any device
            device = await prisma.$queryRaw`
                SELECT 
                    d.id, d.serial_number, d.asset_tag, d.status, d.visibility,
                    d.purchase_date, d.installation_date, d.created_at, d.updated_at,
                    d.model_id, d.organization_id, d.department_id,
                    dm.name as model_name, m.name as manufacturer,
                    dm.specifications as model_specifications,
                    dc.name as category_name,
                    o.name as organization_name,
                    dept.name as department_name,
                    -- Warranty info
                    wi.warranty_start, wi.warranty_end, wi.provider as warranty_provider
                FROM device d
                LEFT JOIN device_models dm ON d.model_id = dm.id
                LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
                LEFT JOIN device_categories dc ON dm.category_id = dc.id
                LEFT JOIN organizations o ON d.organization_id = o.id
                LEFT JOIN departments dept ON d.department_id = dept.id
                LEFT JOIN warranty_info wi ON d.id = wi.device_id
                WHERE d.id = ${id}::uuid
            `;
        } else {
            // Regular user - filter by organization
            device = await prisma.$queryRaw`
                SELECT 
                    d.id, d.serial_number, d.asset_tag, d.status, d.visibility,
                    d.purchase_date, d.installation_date, d.created_at, d.updated_at,
                    d.model_id, d.organization_id, d.department_id,
                    dm.name as model_name, m.name as manufacturer,
                    dm.specifications as model_specifications,
                    dc.name as category_name,
                    o.name as organization_name,
                    dept.name as department_name,
                    -- Warranty info
                    wi.warranty_start, wi.warranty_end, wi.provider as warranty_provider
                FROM device d
                LEFT JOIN device_models dm ON d.model_id = dm.id
                LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
                LEFT JOIN device_categories dc ON dm.category_id = dc.id
                LEFT JOIN organizations o ON d.organization_id = o.id
                LEFT JOIN departments dept ON d.department_id = dept.id
                LEFT JOIN warranty_info wi ON d.id = wi.device_id
                WHERE d.id = ${id}::uuid 
                AND d.organization_id = ${userOrgId}::uuid
            `;
        }

        if (device.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        const deviceData = device[0];

        // **VISIBILITY & DEPARTMENT LEVEL CHECK** (consistent with getAllDevices)
        if (!isSuperAdmin) {
            const userDeptId = user?.department_id;
            const canManageDevices = hasPermission(user, 'device.manage') ||
                                   hasPermission(user, 'organization.admin') ||
                                   hasPermission(user, 'department.manage');

            // Check visibility access
            if (deviceData.visibility === 'private') {
                // Private devices only visible to superadmin
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Private device not accessible'
                });
            } else if (deviceData.visibility === 'department') {
                // Department devices need department match or special permissions
                if (userDeptId && deviceData.department_id && deviceData.department_id !== userDeptId) {
                    const hasPermissionToViewAllDepts = hasPermission(user, 'view_all_departments') || canManageDevices;
                    if (!hasPermissionToViewAllDepts) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Cannot access device from different department'
                        });
                    }
                } else if (!userDeptId && deviceData.department_id) {
                    // User has no department but device is department-specific
                    if (!canManageDevices) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Cannot access department-specific device'
                        });
                    }
                }
            }
            // Public devices are accessible to all organization members
        }

        res.status(200).json({
            success: true,
            data: deviceData,
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
        const user = req.user;
        const userOrgId = user?.organization_id;
        const userDeptId = user?.department_id;
        const userPermissions = getUserPermissions(user);
   
        // Check Super Admin (System Admin)
        const isSuperAdmin = (userPermissions.includes('system.admin') ||
                            hasPermission(user, 'system.admin')) &&
                           !user?.organization_id &&
                           !user?.department_id;

        if (!isSuperAdmin && !userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        // ====================================================================
        // 3. ORGANIZATION VALIDATION BASED ON USER ROLE
        // ====================================================================
        let finalOrganizationId;

        if (isSuperAdmin) {
            // Super Admin: requires organization_id in request
            if (!organization_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization ID is required for system admin'
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
        } else {
            // Regular user: use their organization
            finalOrganizationId = userOrgId;
            
            // Check if user is trying to create in different organization
            if (organization_id && organization_id !== userOrgId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Cannot create devices in different organization'
                });
            }
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
            `;
            
            if (deptExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Department not found in target organization'
                });
            }

            // Check if user can create in this department (skip for super admin)
            if (!isSuperAdmin && userDeptId && department_id !== userDeptId) {
                // User trying to create in different department
                const canCreateCrossDept = hasPermission(user, 'device.create.all_departments') ||
                                          hasPermission(user, 'department.manage') ||
                                          hasPermission(user, 'organization.admin');
                
                if (!canCreateCrossDept) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied: Cannot create devices in different department'
                    });
                }
            }

            finalDepartmentId = department_id;
        } else {
            // No department specified - auto-assign user's department if exists (not for super admin)
            if (!isSuperAdmin) {
                finalDepartmentId = userDeptId;
            }
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
        // 7. CREATE DEVICE
        // ====================================================================
        
        const purchaseDateValue = purchase_date ? new Date(purchase_date) : null;
        const installationDateValue = installation_date ? new Date(installation_date) : null;

        // Create device in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create device record
            // Determine visibility based on department assignment
            const deviceVisibility = finalDepartmentId ? 'department' : 'private';

            const newDevice = await tx.$queryRaw`
                INSERT INTO device (
                    model_id, 
                    organization_id, 
                    department_id, 
                    serial_number, 
                    asset_tag, 
                    status,
                    visibility,
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
                    ${deviceVisibility}::device_visibility,
                    ${purchaseDateValue}::date,
                    ${installationDateValue}::date,
                    ${getVietnamDate()}::timestamptz,
                    ${getVietnamDate()}::timestamptz
                )
                RETURNING id
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
                dc.name as category_name
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id  
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
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
                0::integer as online_devices,
                COUNT(CASE WHEN wi.warranty_end < CURRENT_DATE THEN 1 END)::integer as expired_warranties,
                COUNT(CASE WHEN wi.warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::integer as expiring_warranties
            FROM device d
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

// Validate asset tag uniqueness
// Validate serial number uniqueness
export const validateSerialNumber = async (req, res) => {
    try {
        const { serial_number, device_id } = req.query;

        if (!serial_number) {
            return res.status(400).json({
                success: false,
                message: 'Serial number is required'
            });
        }

        // Check if serial number exists (exclude current device if updating)
        let duplicateSerial;
        
        if (device_id) {
            // Validate device_id UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(device_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid device ID format'
                });
            }
            duplicateSerial = await prisma.$queryRaw`
                SELECT id, organization_id, asset_tag FROM device 
                WHERE serial_number = ${serial_number}
                AND id != ${device_id}::uuid
            `;
        } else {
            duplicateSerial = await prisma.$queryRaw`
                SELECT id, organization_id, asset_tag FROM device 
                WHERE serial_number = ${serial_number}
            `;
        }
        
        const isAvailable = duplicateSerial.length === 0;

        res.status(200).json({
            success: true,
            data: {
                serial_number,
                is_available: isAvailable,
                conflict: !isAvailable ? {
                    device_id: duplicateSerial[0].id,
                    organization_id: duplicateSerial[0].organization_id,
                    asset_tag: duplicateSerial[0].asset_tag
                } : null
            },
            message: isAvailable 
                ? 'Serial number is available' 
                : 'Serial number already exists'
        });

    } catch (error) {
        console.error('Error validating serial number:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate serial number',
            error: error.message
        });
    }
};

export const validateAssetTag = async (req, res) => {
    try {
        const { asset_tag, organization_id, device_id } = req.query;

        if (!asset_tag) {
            return res.status(400).json({
                success: false,
                message: 'Asset tag is required'
            });
        }

        if (!organization_id) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        // Validate UUID format for organization_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(organization_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid organization ID format'
            });
        }

        // Check if asset tag exists (exclude current device if updating)
        let duplicateAssetTag;
        
        if (device_id) {
            // Validate device_id UUID format if provided
            if (!uuidRegex.test(device_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid device ID format'
                });
            }
            duplicateAssetTag = await prisma.$queryRaw`
                SELECT id, serial_number FROM device 
                WHERE organization_id = ${organization_id}::uuid 
                AND asset_tag = ${asset_tag}
                AND id != ${device_id}::uuid
            `;
        } else {
            duplicateAssetTag = await prisma.$queryRaw`
                SELECT id, serial_number FROM device 
                WHERE organization_id = ${organization_id}::uuid 
                AND asset_tag = ${asset_tag}
            `;
        }
        
        const isAvailable = duplicateAssetTag.length === 0;

        res.status(200).json({
            success: true,
            data: {
                asset_tag,
                organization_id,
                is_available: isAvailable,
                conflict: !isAvailable ? {
                    device_id: duplicateAssetTag[0].id,
                    serial_number: duplicateAssetTag[0].serial_number
                } : null
            },
            message: isAvailable 
                ? 'Asset tag is available' 
                : 'Asset tag already exists in this organization'
        });

    } catch (error) {
        console.error('Error validating asset tag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate asset tag',
            error: error.message
        });
    }
};

// Change device visibility
export const changeDeviceVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { visibility } = req.body;

        // Validate visibility value
        const validVisibilities = ['public', 'department', 'private'];
        if (!validVisibilities.includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid visibility. Must be: public, department, or private'
            });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device ID format'
            });
        }

        // Get device info
        const device = await prisma.$queryRaw`
            SELECT d.id, d.organization_id, d.department_id, d.visibility
            FROM device d
            WHERE d.id = ${id}::uuid
        `;

        if (device.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        const currentDevice = device[0];

        // Permission checks
        const userOrgId = req.user?.organization_id;
        const isSystemAdmin = hasPermission(req.user, 'system.admin');
        
        if (!isSystemAdmin) {
            if (currentDevice.organization_id !== userOrgId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Cannot modify devices from different organization'
                });
            }

            // Check permission for setting public visibility
            if (visibility === 'public') {
                const canSetPublic = hasPermission(req.user, 'device.manage') ||
                                   hasPermission(req.user, 'organization.admin');
                if (!canSetPublic) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission denied: Cannot set device to public visibility'
                    });
                }
            }
        }

        // Store old values for audit
        const oldValues = {
            visibility: currentDevice.visibility,
            department_id: currentDevice.department_id
        };

        // Validate consistency between visibility and department
        const consistencyCheck = validateVisibilityDepartmentConsistency(visibility, currentDevice.department_id);
        
        let updateFields = {
            visibility: consistencyCheck.visibility,
            updated_at: getVietnamDate()
        };

        // If department_id needs to be cleared due to consistency rules
        if (consistencyCheck.department_id !== currentDevice.department_id) {
            updateFields.department_id = consistencyCheck.department_id;
        }

        // Update visibility and potentially department_id
        const updatedDevice = await prisma.$transaction(async (tx) => {
            const updated = await tx.device.update({
                where: { id },
                data: updateFields,
                select: {
                    id: true,
                    visibility: true,
                    department_id: true,
                    updated_at: true
                }
            });

            return updated;
        });

        // Create audit log
        await AuditLogger.logCRUD({
            req,
            action: 'update',
            resource_type: 'device',
            resource_id: id,
            old_values: oldValues,
            new_values: {
                visibility: consistencyCheck.visibility,
                department_id: consistencyCheck.department_id,
                consistency_warnings: consistencyCheck.warnings.length > 0 ? consistencyCheck.warnings : undefined
            },
            success: true
        });

        res.json({
            success: true,
            data: updatedDevice,
            warnings: consistencyCheck.warnings.length > 0 ? consistencyCheck.warnings : undefined,
            message: consistencyCheck.warnings.length > 0 
                ? `Device visibility updated with modifications: ${consistencyCheck.warnings.join('. ')}`
                : 'Device visibility updated successfully'
        });

    } catch (error) {
        console.error('Error changing device visibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change device visibility',
            error: error.message
        });
    }
};

// Get devices by visibility
export const getDevicesByVisibility = async (req, res) => {
    try {
        const { visibility } = req.params;
        const { organization_id, department_id, page = 1, limit = 50 } = req.query;

        // Validate visibility
        const validVisibilities = ['public', 'department', 'private', 'all'];
        if (!validVisibilities.includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid visibility. Must be: public, department, private, or all'
            });
        }

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // User access control
        const userOrgId = req.user?.organization_id;
        const isSystemAdmin = hasPermission(req.user, 'system.admin');

        if (!isSystemAdmin && !userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        // Organization filter
        if (isSystemAdmin && organization_id) {
            whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
            params.push(organization_id);
            paramIndex++;
        } else if (!isSystemAdmin) {
            whereConditions.push(`d.organization_id = $${paramIndex}::uuid`);
            params.push(userOrgId);
            paramIndex++;
        }

        // Visibility filter with permission check
        if (visibility !== 'all') {
            // Check permission for private devices
            if (visibility === 'private') {
                const canViewPrivate = isSystemAdmin || 
                                     hasPermission(req.user, 'device.manage') ||
                                     hasPermission(req.user, 'organization.admin') ||
                                     hasPermission(req.user, 'department.manage');
                
                if (!canViewPrivate) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission denied: Cannot view private devices',
                        code: 'PRIVATE_DEVICES_ACCESS_DENIED'
                    });
                }
            }
            
            whereConditions.push(`d.visibility = $${paramIndex}::device_visibility`);
            params.push(visibility);
            paramIndex++;
        }

        // Department filter
        if (department_id) {
            whereConditions.push(`d.department_id = $${paramIndex}::uuid`);
            params.push(department_id);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        const devices = await prisma.$queryRawUnsafe(`
            SELECT 
                d.id, d.serial_number, d.asset_tag, d.status, d.visibility,
                d.created_at, d.updated_at,
                dm.name as model_name,
                o.name as organization_name,
                dept.name as department_name,
                dc.name as category_name,
                CASE 
                    WHEN d.visibility = 'public' THEN 'Organization-wide'
                    WHEN d.visibility = 'department' AND d.department_id IS NOT NULL THEN dept.name || ' only'
                    WHEN d.visibility = 'department' AND d.department_id IS NULL THEN 'Unassigned department'
                    WHEN d.visibility = 'private' THEN 'Private'
                END as visibility_scope
            FROM device d
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
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
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            ${whereClause}
        `, ...countParams);

        const total = totalResult[0]?.total || 0;

        res.json({
            success: true,
            data: devices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            message: `Devices with ${visibility} visibility retrieved successfully`
        });

    } catch (error) {
        console.error('Error fetching devices by visibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch devices by visibility',
            error: error.message
        });
    }
};

/**
 * Assign device to a department
 */
export const assignDeviceToDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { department_id } = req.body;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Device ID is required'
            });
        }

        if (!department_id) {
            return res.status(400).json({
                success: false,
                message: 'Department ID is required'
            });
        }

        // Check if device exists and get its current data
        const device = await prisma.device.findUnique({
            where: { id },
            include: {
                organization: true,
                department: true
            }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Check if department exists and belongs to the same organization
        const department = await prisma.departments.findFirst({
            where: {
                id: department_id,
                organization_id: device.organization_id
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or does not belong to the same organization'
            });
        }

        // Check user permissions
        const user = req.user;
        const user_id = user.id;
        const user_organization_id = user.organization_id;
        const user_role = user.role;
        const user_department_id = user.department_id;

        // Permission check based on user role and organization
        const isSuperAdmin = user_role === 'system.admin' || 
                           (!user_organization_id && !user_department_id);

        if (!isSuperAdmin && user_organization_id !== device.organization_id) {
            return res.status(403).json({
                success: false,
                message: 'No permission to modify device from different organization'
            });
        }

        // Role-based permission check
        const hasUpdatePermission = 
            isSuperAdmin ||
            user_role === 'admin' ||
            (user_role === 'manager' && user_department_id === device.department_id) ||
            (user_role === 'manager' && user_department_id === department_id) ||
            hasPermission(user, 'device.update');

        if (!hasUpdatePermission) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to assign device to department'
            });
        }

        // Store old values for audit
        const oldValues = {
            department_id: device.department_id,
            visibility: device.visibility
        };

        // Determine new visibility based on current visibility
        let newVisibility = device.visibility;
        
        // When assigning to department, visibility should change to 'department'
        // unless it's explicitly public (organization-wide access intended)
        if (device.visibility === 'private') {
            newVisibility = 'department';
        } else if (device.visibility === 'public') {
            // Ask user or use business rule: should public devices become department-only?
            // For now, let's make it department-only when assigned to specific department
            newVisibility = 'department';
        }

        // Validate consistency between visibility and department assignment
        const consistencyCheck = validateVisibilityDepartmentConsistency(newVisibility, department_id);
        newVisibility = consistencyCheck.visibility;

        // Update device department using Prisma transaction
        const updatedDevice = await prisma.$transaction(async (tx) => {
            // Update the device
            const updated = await tx.device.update({
                where: { id },
                data: {
                    department_id: department_id,
                    visibility: newVisibility,
                    updated_at: new Date()
                },
                include: {
                    organization: true,
                    department: true,
                    model: true
                }
            });

            return updated;
        });

        // Create audit log using enhanced service
        await AuditLogger.logCRUD({
            req,
            action: 'update',
            resource_type: 'device',
            resource_id: id,
            old_values: oldValues,
            new_values: {
                department_id: department_id,
                visibility: newVisibility,
                department_name: department.name
            },
            success: true
        });

        res.json({
            success: true,
            data: {
                device: updatedDevice,
                department: department,
                message: `Device successfully assigned to department: ${department.name}`
            },
            message: 'Device assigned to department successfully'
        });

    } catch (error) {
        console.error('Error assigning device to department:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign device to department',
            error: error.message
        });
    }
};
