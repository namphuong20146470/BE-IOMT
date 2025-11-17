import prisma from '../../../config/db.js';
import { validationResult } from 'express-validator';

/**
 * Maintenance Parts Controller
 * Handles CRUD operations for maintenance parts/components
 */

// ==================== GET ALL PARTS FOR MAINTENANCE ====================

export const getMaintenanceParts = async (req, res) => {
    try {
        const { maintenanceId } = req.params;
        
        // Verify maintenance belongs to user's organization
        const maintenanceExists = await prisma.$queryRaw`
            SELECT id FROM maintenance_history 
            WHERE id = ${maintenanceId}::uuid 
            AND organization_id = ${req.user.organizationId}::uuid
        `;

        if (maintenanceExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        const parts = await prisma.$queryRaw`
            SELECT 
                id,
                part_name,
                part_number,
                quantity,
                unit_price,
                total_cost,
                supplier,
                warranty_months,
                created_at
            FROM maintenance_parts
            WHERE maintenance_id = ${maintenanceId}::uuid
            ORDER BY part_name ASC
        `;

        // Calculate totals
        const totals = parts.reduce((acc, part) => {
            acc.total_parts += 1;
            acc.total_quantity += part.quantity || 0;
            acc.total_cost += parseFloat(part.total_cost || 0);
            return acc;
        }, {
            total_parts: 0,
            total_quantity: 0,
            total_cost: 0
        });

        return res.status(200).json({
            success: true,
            data: {
                maintenance_id: maintenanceId,
                parts,
                totals
            }
        });

    } catch (error) {
        console.error('Error fetching maintenance parts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance parts',
            error: error.message
        });
    }
};

// ==================== CREATE MAINTENANCE PART ====================

export const createMaintenancePart = async (req, res) => {
    try {
        const { maintenanceId } = req.params;
        
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Verify maintenance belongs to user's organization
        const maintenanceExists = await prisma.$queryRaw`
            SELECT id FROM maintenance_history 
            WHERE id = ${maintenanceId}::uuid 
            AND organization_id = ${req.user.organizationId}::uuid
        `;

        if (maintenanceExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        const {
            part_name,
            part_number,
            quantity = 1,
            unit_price,
            total_cost,
            supplier,
            warranty_months
        } = req.body;

        // Calculate total_cost if not provided
        let calculatedTotalCost = total_cost;
        if (!calculatedTotalCost && unit_price && quantity) {
            calculatedTotalCost = parseFloat(unit_price) * parseInt(quantity);
        }

        const result = await prisma.$queryRaw`
            INSERT INTO maintenance_parts (
                maintenance_id,
                part_name,
                part_number,
                quantity,
                unit_price,
                total_cost,
                supplier,
                warranty_months
            ) VALUES (
                ${maintenanceId}::uuid,
                ${part_name},
                ${part_number || null},
                ${quantity}::integer,
                ${unit_price || null}::decimal,
                ${calculatedTotalCost || null}::decimal,
                ${supplier || null},
                ${warranty_months || null}::integer
            ) RETURNING id
        `;

        const partId = result[0].id;

        return res.status(201).json({
            success: true,
            message: 'Maintenance part created successfully',
            data: {
                id: partId,
                maintenance_id: maintenanceId,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error creating maintenance part:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create maintenance part',
            error: error.message
        });
    }
};

// ==================== UPDATE MAINTENANCE PART ====================

export const updateMaintenancePart = async (req, res) => {
    try {
        const { maintenanceId, partId } = req.params;
        
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Verify part belongs to maintenance and user's organization
        const partExists = await prisma.$queryRaw`
            SELECT mp.id 
            FROM maintenance_parts mp
            JOIN maintenance_history mh ON mp.maintenance_id = mh.id
            WHERE mp.id = ${partId}::uuid 
            AND mp.maintenance_id = ${maintenanceId}::uuid
            AND mh.organization_id = ${req.user.organizationId}::uuid
        `;

        if (partExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance part not found'
            });
        }

        const updateFields = {};
        const allowedFields = [
            'part_name', 'part_number', 'quantity', 'unit_price', 
            'total_cost', 'supplier', 'warranty_months'
        ];

        // Build update fields dynamically
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateFields[field] = req.body[field];
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // Auto-calculate total_cost if quantity or unit_price changed
        if (updateFields.quantity || updateFields.unit_price) {
            // Get current values
            const currentPart = await prisma.$queryRaw`
                SELECT quantity, unit_price 
                FROM maintenance_parts 
                WHERE id = ${partId}::uuid
            `;
            
            if (currentPart.length > 0) {
                const newQuantity = updateFields.quantity || currentPart[0].quantity;
                const newUnitPrice = updateFields.unit_price || currentPart[0].unit_price;
                
                if (newQuantity && newUnitPrice && !updateFields.total_cost) {
                    updateFields.total_cost = parseFloat(newUnitPrice) * parseInt(newQuantity);
                }
            }
        }

        // Build update query dynamically
        const setFields = Object.keys(updateFields).map((field, index) => {
            const value = updateFields[field];
            if (field === 'quantity' || field === 'warranty_months') {
                return `${field} = $${index + 2}::integer`;
            } else if (field === 'unit_price' || field === 'total_cost') {
                return `${field} = $${index + 2}::decimal`;
            } else {
                return `${field} = $${index + 2}`;
            }
        }).join(', ');

        const values = [partId, ...Object.values(updateFields)];

        await prisma.$queryRawUnsafe(`
            UPDATE maintenance_parts 
            SET ${setFields}
            WHERE id = $1::uuid
        `, ...values);

        return res.status(200).json({
            success: true,
            message: 'Maintenance part updated successfully',
            data: {
                id: partId,
                maintenance_id: maintenanceId,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error updating maintenance part:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update maintenance part',
            error: error.message
        });
    }
};

// ==================== DELETE MAINTENANCE PART ====================

export const deleteMaintenancePart = async (req, res) => {
    try {
        const { maintenanceId, partId } = req.params;

        // Verify part belongs to maintenance and user's organization
        const partExists = await prisma.$queryRaw`
            SELECT mp.id 
            FROM maintenance_parts mp
            JOIN maintenance_history mh ON mp.maintenance_id = mh.id
            WHERE mp.id = ${partId}::uuid 
            AND mp.maintenance_id = ${maintenanceId}::uuid
            AND mh.organization_id = ${req.user.organizationId}::uuid
        `;

        if (partExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance part not found'
            });
        }

        await prisma.$queryRaw`
            DELETE FROM maintenance_parts 
            WHERE id = ${partId}::uuid
        `;

        return res.status(200).json({
            success: true,
            message: 'Maintenance part deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting maintenance part:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete maintenance part',
            error: error.message
        });
    }
};

// ==================== BULK CREATE PARTS ====================

export const bulkCreateParts = async (req, res) => {
    try {
        const { maintenanceId } = req.params;
        const { parts } = req.body;

        if (!Array.isArray(parts) || parts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Parts array is required'
            });
        }

        // Verify maintenance belongs to user's organization
        const maintenanceExists = await prisma.$queryRaw`
            SELECT id FROM maintenance_history 
            WHERE id = ${maintenanceId}::uuid 
            AND organization_id = ${req.user.organizationId}::uuid
        `;

        if (maintenanceExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        const results = await prisma.$transaction(async (tx) => {
            const createdParts = [];
            const errors = [];

            for (let i = 0; i < parts.length; i++) {
                try {
                    const part = parts[i];
                    
                    // Validate required fields
                    if (!part.part_name) {
                        errors.push({
                            index: i,
                            error: 'Part name is required'
                        });
                        continue;
                    }

                    // Calculate total_cost if not provided
                    let totalCost = part.total_cost;
                    if (!totalCost && part.unit_price && part.quantity) {
                        totalCost = parseFloat(part.unit_price) * parseInt(part.quantity);
                    }

                    const result = await tx.$queryRaw`
                        INSERT INTO maintenance_parts (
                            maintenance_id,
                            part_name,
                            part_number,
                            quantity,
                            unit_price,
                            total_cost,
                            supplier,
                            warranty_months
                        ) VALUES (
                            ${maintenanceId}::uuid,
                            ${part.part_name},
                            ${part.part_number || null},
                            ${part.quantity || 1}::integer,
                            ${part.unit_price || null}::decimal,
                            ${totalCost || null}::decimal,
                            ${part.supplier || null},
                            ${part.warranty_months || null}::integer
                        ) RETURNING id
                    `;

                    createdParts.push({
                        index: i,
                        id: result[0].id,
                        success: true
                    });

                } catch (error) {
                    errors.push({
                        index: i,
                        error: error.message
                    });
                }
            }

            return { createdParts, errors };
        });

        return res.status(201).json({
            success: true,
            message: `Successfully created ${results.createdParts.length} parts`,
            data: {
                maintenance_id: maintenanceId,
                created: results.createdParts,
                errors: results.errors,
                summary: {
                    total_requested: parts.length,
                    successful: results.createdParts.length,
                    failed: results.errors.length
                }
            }
        });

    } catch (error) {
        console.error('Error bulk creating parts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create parts',
            error: error.message
        });
    }
};

// ==================== GET PARTS SUMMARY ====================

export const getPartsSummary = async (req, res) => {
    try {
        const { 
            period = '90',
            part_name,
            supplier 
        } = req.query;
        
        const orgId = req.user.organizationId;
        const periodDays = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        let whereConditions = ['mh.organization_id = $1::uuid', 'mh.performed_date >= $2::date'];
        let params = [orgId, startDate.toISOString().split('T')[0]];
        let paramIndex = 3;

        if (part_name) {
            whereConditions.push(`mp.part_name ILIKE $${paramIndex}`);
            params.push(`%${part_name}%`);
            paramIndex++;
        }

        if (supplier) {
            whereConditions.push(`mp.supplier ILIKE $${paramIndex}`);
            params.push(`%${supplier}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const summaryQuery = `
            WITH parts_summary AS (
                SELECT 
                    mp.part_name,
                    mp.supplier,
                    COUNT(*) as usage_count,
                    SUM(mp.quantity) as total_quantity,
                    COALESCE(SUM(mp.total_cost), 0) as total_cost,
                    COALESCE(AVG(mp.unit_price), 0) as avg_unit_price,
                    COUNT(DISTINCT mh.device_id) as devices_count,
                    MAX(mh.performed_date) as last_used
                FROM maintenance_parts mp
                JOIN maintenance_history mh ON mp.maintenance_id = mh.id
                WHERE ${whereClause}
                GROUP BY mp.part_name, mp.supplier
            ),
            top_parts AS (
                SELECT * FROM parts_summary
                ORDER BY usage_count DESC
                LIMIT 20
            ),
            top_suppliers AS (
                SELECT 
                    supplier,
                    COUNT(DISTINCT part_name) as parts_variety,
                    SUM(usage_count) as total_usage,
                    SUM(total_cost) as total_spent
                FROM parts_summary
                WHERE supplier IS NOT NULL
                GROUP BY supplier
                ORDER BY total_spent DESC
                LIMIT 10
            ),
            cost_analysis AS (
                SELECT 
                    SUM(total_cost) as total_parts_cost,
                    AVG(total_cost) as avg_cost_per_part,
                    COUNT(DISTINCT part_name) as unique_parts_count,
                    COUNT(*) as total_usage_instances
                FROM parts_summary
            )
            SELECT 
                (SELECT json_agg(top_parts) FROM top_parts) as top_parts,
                (SELECT json_agg(top_suppliers) FROM top_suppliers) as top_suppliers,
                (SELECT row_to_json(cost_analysis) FROM cost_analysis) as cost_analysis
        `;

        const result = await prisma.$queryRawUnsafe(summaryQuery, ...params);
        const summary = result[0];

        return res.status(200).json({
            success: true,
            data: {
                period: {
                    days: periodDays,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                filters: {
                    part_name,
                    supplier
                },
                top_parts: summary.top_parts || [],
                top_suppliers: summary.top_suppliers || [],
                cost_analysis: summary.cost_analysis || {
                    total_parts_cost: 0,
                    avg_cost_per_part: 0,
                    unique_parts_count: 0,
                    total_usage_instances: 0
                }
            }
        });

    } catch (error) {
        console.error('Error fetching parts summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch parts summary',
            error: error.message
        });
    }
};