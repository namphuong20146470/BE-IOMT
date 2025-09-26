import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createOrganization = async (req, res) => {
    try {
        const { name, type, address, phone, email, license_number } = req.body;

        // Validate organization type
        const validTypes = ['hospital', 'factory', 'school', 'office', 'laboratory'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid organization type'
            });
        }

        const organization = await prisma.$queryRaw`
            INSERT INTO organizations (name, type, address, phone, email, license_number)
            VALUES (${name}, ${type}::organization_type, ${address}, ${phone}, ${email}, ${license_number})
            RETURNING id, name, type, address, phone, email, license_number, is_active, created_at, updated_at
        `;

        res.status(201).json({
            success: true,
            data: organization[0],
            message: 'Organization created successfully'
        });
    } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create organization',
            error: error.message || 'Unknown error'
        });
    }
};

export const getAllOrganizations = async (req, res) => {
    try {
        // ====================================================================
        // SCOPE DATA FILTERING - Logic phân quyền thông minh
        // (Permission check đã được handle bởi requirePermission middleware)
        // ====================================================================
        const userOrgId = req.user?.organization_id;
        const userRoles = req.user?.roles || [];
        
        // Lấy thông tin Super Admin từ middleware (đã tính toán sẵn)
        const isSuperAdmin = req.user?.is_super_admin || false;
        const hasFullAccess = req.user?.has_full_org_access || false;
        
        let organizations;
        
        // CASE 1: User có full organization access (Super Admin hoặc System Admin)
        if (hasFullAccess) {
            const accessType = isSuperAdmin ? 'Super Admin' : 'System Admin';
            console.log(`👑 ${accessType} access - returning ALL organizations (override org scope)`);
            organizations = await prisma.$queryRaw`
                SELECT id, name, type, address, phone, email, 
                       license_number, is_active, created_at, updated_at,
                       (SELECT COUNT(*)::integer FROM users WHERE organization_id = organizations.id) as user_count,
                       (SELECT COUNT(*)::integer FROM device WHERE organization_id = organizations.id) as device_count
                FROM organizations
                WHERE is_active = true
                ORDER BY created_at DESC
            `;
        } 
        // CASE 2: Regular user/admin với organization_id → Scoped access
        else {
            console.log(`🔒 Organization scoped access - filtering by org_id: ${userOrgId}`);
            organizations = await prisma.$queryRaw`
                SELECT id, name, type, address, phone, email, 
                       license_number, is_active, created_at, updated_at,
                       (SELECT COUNT(*)::integer FROM users WHERE organization_id = organizations.id) as user_count,
                       (SELECT COUNT(*)::integer FROM device WHERE organization_id = organizations.id) as device_count
                FROM organizations
                WHERE id = ${userOrgId}::uuid AND is_active = true
                ORDER BY created_at DESC
            `;
        }

        // Determine access scope for response
        const accessScope = hasFullAccess ? 
            (isSuperAdmin ? 'super_admin_full_access' : 'system_admin_full_access') : 
            'organization_scoped';

        res.status(200).json({
            success: true,
            data: organizations,
            count: organizations.length,
            scope: accessScope,
            user_organization_id: userOrgId,
            is_super_admin: isSuperAdmin,
            user_roles: userRoles.map(r => r.name),
            message: 'Organizations retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve organizations',
            error: error.message || 'Unknown error'
        });
    }
};

export const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;

        const organization = await prisma.$queryRaw`
            SELECT id, name, type, address, phone, email, 
                   license_number, is_active, created_at, updated_at
            FROM organizations
            WHERE id = ${id}::uuid AND is_active = true
        `;

        if (organization.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        res.status(200).json({
            success: true,
            data: organization[0],
            message: 'Organization retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching organization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve organization',
            error: error.message || 'Unknown error'
        });
    }
};

export const updateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, address, phone, email, license_number } = req.body;

        const organization = await prisma.$queryRaw`
            UPDATE organizations 
            SET name = COALESCE(${name}, name),
                type = COALESCE(${type}::organization_type, type),
                address = COALESCE(${address}, address),
                phone = COALESCE(${phone}, phone),
                email = COALESCE(${email}, email),
                license_number = COALESCE(${license_number}, license_number),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}::uuid AND is_active = true
            RETURNING id, name, type, address, phone, email, license_number, updated_at
        `;

        if (organization.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        res.status(200).json({
            success: true,
            data: organization[0],
            message: 'Organization updated successfully'
        });
    } catch (error) {
        console.error('Error updating organization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update organization',
            error: error.message || 'Unknown error'
        });
    }
};
