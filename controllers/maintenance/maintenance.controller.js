import prisma from '../../../config/db.js';
import { validationResult } from 'express-validator';

/**
 * Maintenance History Controller
 * Handles CRUD operations for maintenance history records
 */

// ==================== GET ALL MAINTENANCE HISTORY ====================

export const getAllMaintenanceHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            device_id,
            maintenance_type,
            status,
            severity,
            date_from,
            date_to,
            performed_by,
            search,
            sort_by = 'performed_date',
            sort_order = 'desc'
        } = req.query;

        // Validate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        // Build where conditions
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Organization filter for security
        whereConditions.push(`mh.organization_id = $${paramIndex}`);
        params.push(req.user.organizationId);
        paramIndex++;

        // Device filter
        if (device_id) {
            whereConditions.push(`mh.device_id = $${paramIndex}::uuid`);
            params.push(device_id);
            paramIndex++;
        }

        // Maintenance type filter
        if (maintenance_type) {
            whereConditions.push(`mh.maintenance_type = $${paramIndex}::maintenance_type`);
            params.push(maintenance_type);
            paramIndex++;
        }

        // Status filter
        if (status) {
            whereConditions.push(`mh.status = $${paramIndex}::maintenance_status`);
            params.push(status);
            paramIndex++;
        }

        // Severity filter
        if (severity) {
            whereConditions.push(`mh.severity = $${paramIndex}::maintenance_severity`);
            params.push(severity);
            paramIndex++;
        }

        // Date range filter
        if (date_from) {
            whereConditions.push(`mh.performed_date >= $${paramIndex}::date`);
            params.push(date_from);
            paramIndex++;
        }
        
        if (date_to) {
            whereConditions.push(`mh.performed_date <= $${paramIndex}::date`);
            params.push(date_to);
            paramIndex++;
        }

        // Performed by filter
        if (performed_by) {
            whereConditions.push(`mh.performed_by = $${paramIndex}::uuid`);
            params.push(performed_by);
            paramIndex++;
        }

        // Search filter
        if (search) {
            whereConditions.push(`(
                mh.title ILIKE $${paramIndex} OR 
                mh.description ILIKE $${paramIndex} OR
                mh.technician_name ILIKE $${paramIndex} OR
                d.serial_number ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Validate sort fields
        const allowedSortFields = [
            'performed_date', 'created_at', 'title', 'maintenance_type', 
            'status', 'severity', 'cost', 'duration_minutes'
        ];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'performed_date';
        const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Main query
        const query = `
            SELECT 
                mh.id,
                mh.device_id,
                mh.schedule_id,
                mh.maintenance_type,
                mh.title,
                mh.description,
                mh.performed_date,
                mh.duration_minutes,
                mh.performed_by,
                mh.technician_name,
                mh.cost,
                mh.currency,
                mh.status,
                mh.severity,
                mh.issues_found,
                mh.actions_taken,
                mh.recommendations,
                mh.device_condition,
                mh.performance_rating,
                mh.next_maintenance_date,
                mh.next_maintenance_type,
                mh.created_at,
                mh.updated_at,
                
                -- Device info
                d.serial_number as device_serial,
                dm.name as device_model_name,
                
                -- Performer info
                u.full_name as performer_name,
                u.username as performer_username,
                
                -- Department info
                dept.name as department_name,
                
                -- Parts count
                (SELECT COUNT(*) FROM maintenance_parts mp WHERE mp.maintenance_id = mh.id) as parts_count,
                
                -- Photos count
                CASE 
                    WHEN mh.photos IS NULL THEN 0
                    ELSE jsonb_array_length(mh.photos)
                END as photos_count
                
            FROM maintenance_history mh
            LEFT JOIN device d ON mh.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN users u ON mh.performed_by = u.id
            LEFT JOIN departments dept ON mh.department_id = dept.id
            ${whereClause}
            ORDER BY mh.${sortField} ${sortDirection}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM maintenance_history mh
            LEFT JOIN device d ON mh.device_id = d.id
            ${whereClause}
        `;

        params.push(limitNum, offset);

        const [maintenanceRecords, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(query, ...params),
            prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2))
        ]);

        const total = parseInt(countResult[0].total);
        const totalPages = Math.ceil(total / limitNum);

        return res.status(200).json({
            success: true,
            data: maintenanceRecords,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },
            filters: {
                device_id,
                maintenance_type,
                status,
                severity,
                date_from,
                date_to,
                search
            }
        });

    } catch (error) {
        console.error('Error fetching maintenance history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance history',
            error: error.message
        });
    }
};

// ==================== GET MAINTENANCE BY ID ====================

export const getMaintenanceById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                mh.*,
                
                -- Device details
                d.serial_number as device_serial,
                d.asset_tag as device_asset_tag,
                d.location as device_location,
                dm.name as device_model_name,
                dm.model_number,
                man.name as manufacturer_name,
                
                -- Performer details
                u.full_name as performer_name,
                u.username as performer_username,
                u.email as performer_email,
                
                -- Creator details  
                creator.full_name as creator_name,
                creator.username as creator_username,
                
                -- Department details
                dept.name as department_name,
                dept.code as department_code,
                
                -- Organization details
                org.name as organization_name
                
            FROM maintenance_history mh
            LEFT JOIN device d ON mh.device_id = d.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers man ON dm.manufacturer_id = man.id
            LEFT JOIN users u ON mh.performed_by = u.id
            LEFT JOIN users creator ON mh.created_by = creator.id
            LEFT JOIN departments dept ON mh.department_id = dept.id
            LEFT JOIN organizations org ON mh.organization_id = org.id
            WHERE mh.id = $1::uuid 
            AND mh.organization_id = $2::uuid
        `;

        const result = await prisma.$queryRawUnsafe(query, id, req.user.organizationId);
        
        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        const maintenanceRecord = result[0];

        // Get parts for this maintenance
        const partsQuery = `
            SELECT 
                id,
                part_name,
                part_number,
                quantity,
                unit_price,
                total_cost,
                supplier,
                warranty_months
            FROM maintenance_parts 
            WHERE maintenance_id = $1::uuid
            ORDER BY part_name
        `;

        const parts = await prisma.$queryRawUnsafe(partsQuery, id);

        return res.status(200).json({
            success: true,
            data: {
                ...maintenanceRecord,
                parts: parts || []
            }
        });

    } catch (error) {
        console.error('Error fetching maintenance record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance record',
            error: error.message
        });
    }
};

// ==================== CREATE MAINTENANCE RECORD ====================

export const createMaintenanceRecord = async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            device_id,
            schedule_id,
            maintenance_type,
            title,
            description,
            performed_date,
            duration_minutes,
            performed_by,
            technician_name,
            department_id,
            cost,
            currency = 'VND',
            parts_replaced = [],
            consumables_used = [],
            status = 'completed',
            severity = 'routine',
            issues_found,
            actions_taken,
            recommendations,
            device_condition,
            performance_rating,
            next_maintenance_date,
            next_maintenance_type,
            attachments = [],
            photos = [],
            parts = [] // Array of parts to be inserted
        } = req.body;

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create maintenance record
            const maintenance = await tx.$queryRaw`
                INSERT INTO maintenance_history (
                    device_id,
                    schedule_id,
                    maintenance_type,
                    title,
                    description,
                    performed_date,
                    duration_minutes,
                    performed_by,
                    technician_name,
                    department_id,
                    cost,
                    currency,
                    parts_replaced,
                    consumables_used,
                    status,
                    severity,
                    issues_found,
                    actions_taken,
                    recommendations,
                    device_condition,
                    performance_rating,
                    next_maintenance_date,
                    next_maintenance_type,
                    attachments,
                    photos,
                    organization_id,
                    created_by
                ) VALUES (
                    ${device_id}::uuid,
                    ${schedule_id ? `${schedule_id}::uuid` : 'NULL'},
                    ${maintenance_type}::maintenance_type,
                    ${title},
                    ${description},
                    ${performed_date}::timestamptz,
                    ${duration_minutes}::integer,
                    ${performed_by ? `${performed_by}::uuid` : 'NULL'},
                    ${technician_name},
                    ${department_id ? `${department_id}::uuid` : 'NULL'},
                    ${cost}::decimal,
                    ${currency},
                    ${JSON.stringify(parts_replaced)}::jsonb,
                    ${JSON.stringify(consumables_used)}::jsonb,
                    ${status}::maintenance_status,
                    ${severity}::maintenance_severity,
                    ${issues_found},
                    ${actions_taken},
                    ${recommendations},
                    ${device_condition ? `${device_condition}::device_condition` : 'NULL'},
                    ${performance_rating}::integer,
                    ${next_maintenance_date ? `${next_maintenance_date}::date` : 'NULL'},
                    ${next_maintenance_type ? `${next_maintenance_type}::maintenance_type` : 'NULL'},
                    ${JSON.stringify(attachments)}::jsonb,
                    ${JSON.stringify(photos)}::jsonb,
                    ${req.user.organizationId}::uuid,
                    ${req.user.id}::uuid
                ) RETURNING id
            `;

            const maintenanceId = maintenance[0].id;

            // Insert parts if provided
            if (parts && parts.length > 0) {
                for (const part of parts) {
                    await tx.$queryRaw`
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
                            ${part.total_cost || null}::decimal,
                            ${part.supplier || null},
                            ${part.warranty_months || null}::integer
                        )
                    `;
                }
            }

            // Update maintenance schedule status if linked
            if (schedule_id) {
                await tx.$queryRaw`
                    UPDATE maintenance_schedules 
                    SET 
                        status = 'completed'::schedule_status,
                        maintenance_history_id = ${maintenanceId}::uuid
                    WHERE id = ${schedule_id}::uuid
                `;
            }

            return { maintenanceId };
        });

        return res.status(201).json({
            success: true,
            message: 'Maintenance record created successfully',
            data: {
                id: result.maintenanceId,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error creating maintenance record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create maintenance record',
            error: error.message
        });
    }
};

// ==================== UPDATE MAINTENANCE RECORD ====================

export const updateMaintenanceRecord = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if maintenance record exists and belongs to user's organization
        const existingRecord = await prisma.$queryRaw`
            SELECT id FROM maintenance_history 
            WHERE id = ${id}::uuid 
            AND organization_id = ${req.user.organizationId}::uuid
        `;

        if (existingRecord.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        const updateFields = {};
        const allowedFields = [
            'title', 'description', 'performed_date', 'duration_minutes',
            'performed_by', 'technician_name', 'department_id', 'cost', 'currency',
            'parts_replaced', 'consumables_used', 'status', 'severity',
            'issues_found', 'actions_taken', 'recommendations', 'device_condition',
            'performance_rating', 'next_maintenance_date', 'next_maintenance_type',
            'attachments', 'photos'
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

        // Update record
        await prisma.maintenance_history.update({
            where: { id },
            data: {
                ...updateFields,
                updated_at: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Maintenance record updated successfully',
            data: {
                id,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error updating maintenance record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update maintenance record',
            error: error.message
        });
    }
};

// ==================== DELETE MAINTENANCE RECORD ====================

export const deleteMaintenanceRecord = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if record exists and belongs to user's organization
        const existingRecord = await prisma.$queryRaw`
            SELECT id FROM maintenance_history 
            WHERE id = ${id}::uuid 
            AND organization_id = ${req.user.organizationId}::uuid
        `;

        if (existingRecord.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        // Delete record (cascades to parts)
        await prisma.maintenance_history.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: 'Maintenance record deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting maintenance record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete maintenance record',
            error: error.message
        });
    }
};

// ==================== GET MAINTENANCE BY DEVICE ====================

export const getMaintenanceByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 20, page = 1 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const query = `
            SELECT 
                mh.id,
                mh.maintenance_type,
                mh.title,
                mh.performed_date,
                mh.duration_minutes,
                mh.technician_name,
                mh.cost,
                mh.status,
                mh.severity,
                mh.device_condition,
                mh.performance_rating,
                u.full_name as performer_name
            FROM maintenance_history mh
            LEFT JOIN users u ON mh.performed_by = u.id
            WHERE mh.device_id = $1::uuid 
            AND mh.organization_id = $2::uuid
            ORDER BY mh.performed_date DESC
            LIMIT $3 OFFSET $4
        `;

        const maintenanceRecords = await prisma.$queryRawUnsafe(
            query, 
            deviceId, 
            req.user.organizationId,
            parseInt(limit),
            offset
        );

        return res.status(200).json({
            success: true,
            data: maintenanceRecords
        });

    } catch (error) {
        console.error('Error fetching device maintenance history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device maintenance history',
            error: error.message
        });
    }
};