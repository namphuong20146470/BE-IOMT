import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Get warranty info by device ID
export const getWarrantyByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const warranty = await prisma.$queryRaw`
            SELECT 
                wi.id, wi.device_id, wi.warranty_start, wi.warranty_end, wi.provider,
                d.serial_number, d.asset_tag,
                dm.name as model_name, dm.manufacturer,
                o.name as organization_name,
                CASE 
                    WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_3_months'
                    ELSE 'valid'
                END as warranty_status,
                (wi.warranty_end - CURRENT_DATE) as days_remaining
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            WHERE wi.device_id = ${deviceId}::uuid
        `;

        if (warranty.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Warranty information not found for this device'
            });
        }

        res.status(200).json({
            success: true,
            data: warranty[0],
            message: 'Warranty information retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching warranty info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch warranty information',
            error: error.message
        });
    }
};

// Get all warranties with filtering
export const getAllWarranties = async (req, res) => {
    try {
        const { 
            organization_id, 
            status, // expired, expiring_soon, expiring_3_months, valid
            provider,
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
        
        if (provider) {
            whereConditions.push(`wi.provider ILIKE $${paramIndex}`);
            params.push(`%${provider}%`);
            paramIndex++;
        }

        // Add status filter in HAVING clause since it's calculated
        let havingCondition = '';
        if (status) {
            havingCondition = `HAVING 
                CASE 
                    WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_3_months'
                    ELSE 'valid'
                END = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        const warranties = await prisma.$queryRawUnsafe(`
            SELECT 
                wi.id, wi.device_id, wi.warranty_start, wi.warranty_end, wi.provider,
                d.serial_number, d.asset_tag, d.status as device_status,
                dm.name as model_name, dm.manufacturer,
                o.name as organization_name,
                dept.dept_name as department_name,
                CASE 
                    WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_3_months'
                    ELSE 'valid'
                END as warranty_status,
                (wi.warranty_end - CURRENT_DATE) as days_remaining
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.dept_id
            ${whereClause}
            ${havingCondition}
            ORDER BY wi.warranty_end ASC
            LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
        `, ...params);

        // Get total count (simpler query without HAVING for count)
        const countParams = params.slice(0, -2);
        let countQuery = `
            SELECT COUNT(*)::integer as total
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            ${whereClause}
        `;

        if (status) {
            countQuery = `
                SELECT COUNT(*)::integer as total FROM (
                    SELECT wi.id,
                        CASE 
                            WHEN wi.warranty_end < CURRENT_DATE THEN 'expired'
                            WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                            WHEN wi.warranty_end < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_3_months'
                            ELSE 'valid'
                        END as warranty_status
                    FROM warranty_info wi
                    LEFT JOIN device d ON wi.device_id = d.id
                    ${whereClause}
                ) sub WHERE sub.warranty_status = $${countParams.length + 1}
            `;
            countParams.push(status);
        }

        const totalResult = await prisma.$queryRawUnsafe(countQuery, ...countParams);
        const total = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: warranties,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            message: 'Warranties retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching warranties:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch warranties',
            error: error.message
        });
    }
};

// Create warranty info
export const createWarranty = async (req, res) => {
    try {
        const {
            device_id,
            warranty_start,
            warranty_end,
            provider
        } = req.body;

        if (!device_id || !warranty_start || !warranty_end || !provider) {
            return res.status(400).json({
                success: false,
                message: 'Device ID, warranty start date, warranty end date, and provider are required'
            });
        }

        // Validate dates
        const startDate = new Date(warranty_start);
        const endDate = new Date(warranty_end);
        
        if (endDate <= startDate) {
            return res.status(400).json({
                success: false,
                message: 'Warranty end date must be after start date'
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

        // Check if warranty already exists for this device
        const existingWarranty = await prisma.$queryRaw`
            SELECT id FROM warranty_info WHERE device_id = ${device_id}::uuid
        `;
        if (existingWarranty.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Warranty information already exists for this device'
            });
        }

        const newWarranty = await prisma.$queryRaw`
            INSERT INTO warranty_info (device_id, warranty_start, warranty_end, provider)
            VALUES (${device_id}::uuid, ${warranty_start}::date, ${warranty_end}::date, ${provider})
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            data: newWarranty[0],
            message: 'Warranty information created successfully'
        });
    } catch (error) {
        console.error('Error creating warranty info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create warranty information',
            error: error.message
        });
    }
};

// Update warranty info
export const updateWarranty = async (req, res) => {
    try {
        const { id } = req.params;
        const { warranty_start, warranty_end, provider } = req.body;

        // Check if warranty exists
        const existingWarranty = await prisma.$queryRaw`
            SELECT * FROM warranty_info WHERE id = ${id}::uuid
        `;
        if (existingWarranty.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Warranty information not found'
            });
        }

        // Validate dates if both are provided
        if (warranty_start && warranty_end) {
            const startDate = new Date(warranty_start);
            const endDate = new Date(warranty_end);
            
            if (endDate <= startDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Warranty end date must be after start date'
                });
            }
        }

        // Build update query dynamically
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (warranty_start) {
            updateFields.push(`warranty_start = $${paramIndex}::date`);
            params.push(warranty_start);
            paramIndex++;
        }

        if (warranty_end) {
            updateFields.push(`warranty_end = $${paramIndex}::date`);
            params.push(warranty_end);
            paramIndex++;
        }

        if (provider) {
            updateFields.push(`provider = $${paramIndex}`);
            params.push(provider);
            paramIndex++;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        params.push(id);
        const updatedWarranty = await prisma.$queryRawUnsafe(`
            UPDATE warranty_info 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}::uuid
            RETURNING *
        `, ...params);

        res.status(200).json({
            success: true,
            data: updatedWarranty[0],
            message: 'Warranty information updated successfully'
        });
    } catch (error) {
        console.error('Error updating warranty info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update warranty information',
            error: error.message
        });
    }
};

// Delete warranty info
export const deleteWarranty = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.$queryRaw`
            DELETE FROM warranty_info WHERE id = ${id}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'Warranty information deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting warranty info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete warranty information',
            error: error.message
        });
    }
};

// Get warranty statistics
export const getWarrantyStatistics = async (req, res) => {
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
                COUNT(*)::integer as total_warranties,
                COUNT(CASE WHEN wi.warranty_end < CURRENT_DATE THEN 1 END)::integer as expired_warranties,
                COUNT(CASE WHEN wi.warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::integer as expiring_30_days,
                COUNT(CASE WHEN wi.warranty_end BETWEEN CURRENT_DATE + INTERVAL '30 days' AND CURRENT_DATE + INTERVAL '90 days' THEN 1 END)::integer as expiring_90_days,
                COUNT(CASE WHEN wi.warranty_end > CURRENT_DATE + INTERVAL '90 days' THEN 1 END)::integer as valid_long_term,
                COUNT(DISTINCT wi.provider)::integer as unique_providers
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            ${whereCondition}
        `, ...params);

        // Get provider breakdown
        const providerStats = await prisma.$queryRawUnsafe(`
            SELECT 
                wi.provider,
                COUNT(*)::integer as warranty_count,
                COUNT(CASE WHEN wi.warranty_end < CURRENT_DATE THEN 1 END)::integer as expired_count
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            ${whereCondition}
            GROUP BY wi.provider
            ORDER BY warranty_count DESC
        `, ...params);

        res.status(200).json({
            success: true,
            data: {
                summary: stats[0],
                by_provider: providerStats
            },
            message: 'Warranty statistics retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching warranty statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch warranty statistics',
            error: error.message
        });
    }
};

// Get expiring warranties (within specified days)
export const getExpiringWarranties = async (req, res) => {
    try {
        const { days = 30, organization_id } = req.query;

        let whereConditions = [`wi.warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${parseInt(days)} days'`];
        let params = [];

        if (organization_id) {
            whereConditions.push(`d.organization_id = $1::uuid`);
            params.push(organization_id);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const expiringWarranties = await prisma.$queryRawUnsafe(`
            SELECT 
                wi.id, wi.device_id, wi.warranty_start, wi.warranty_end, wi.provider,
                d.serial_number, d.asset_tag,
                dm.name as model_name, dm.manufacturer,
                o.name as organization_name,
                dept.dept_name as department_name,
                (wi.warranty_end - CURRENT_DATE) as days_remaining
            FROM warranty_info wi
            LEFT JOIN device d ON wi.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.dept_id
            ${whereClause}
            ORDER BY wi.warranty_end ASC
        `, ...params);

        res.status(200).json({
            success: true,
            data: expiringWarranties,
            count: expiringWarranties.length,
            message: `Warranties expiring within ${days} days retrieved successfully`
        });
    } catch (error) {
        console.error('Error fetching expiring warranties:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expiring warranties',
            error: error.message
        });
    }
};
