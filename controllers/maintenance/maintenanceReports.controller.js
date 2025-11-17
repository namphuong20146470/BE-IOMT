import prisma from '../../../config/db.js';

/**
 * Maintenance Reports & Analytics Controller
 * Handles dashboard, statistics, and reporting for maintenance
 */

// ==================== MAINTENANCE DASHBOARD ====================

export const getMaintenanceDashboard = async (req, res) => {
    try {
        const { period = '30' } = req.query; // Days
        const orgId = req.user.organizationId;
        
        const periodDays = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const dashboardQuery = `
            WITH maintenance_summary AS (
                SELECT 
                    COUNT(*) as total_maintenances,
                    COUNT(CASE WHEN performed_date >= $2::date THEN 1 END) as recent_maintenances,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_maintenances,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_maintenances,
                    COALESCE(SUM(cost), 0) as total_cost,
                    COALESCE(AVG(cost), 0) as avg_cost,
                    COALESCE(AVG(duration_minutes), 0) as avg_duration,
                    COUNT(CASE WHEN severity = 'emergency' THEN 1 END) as emergency_maintenances
                FROM maintenance_history 
                WHERE organization_id = $1::uuid
            ),
            maintenance_by_type AS (
                SELECT 
                    maintenance_type,
                    COUNT(*) as count,
                    COALESCE(SUM(cost), 0) as total_cost
                FROM maintenance_history 
                WHERE organization_id = $1::uuid
                AND performed_date >= $2::date
                GROUP BY maintenance_type
            ),
            device_performance AS (
                SELECT 
                    d.id,
                    d.serial_number,
                    dm.name as model_name,
                    COUNT(mh.id) as maintenance_count,
                    COALESCE(SUM(mh.cost), 0) as total_cost,
                    AVG(mh.performance_rating) as avg_rating,
                    MAX(mh.performed_date) as last_maintenance
                FROM device d
                LEFT JOIN maintenance_history mh ON d.id = mh.device_id 
                LEFT JOIN device_models dm ON d.model_id = dm.id
                WHERE d.organization_id = $1::uuid
                AND (mh.performed_date >= $2::date OR mh.id IS NULL)
                GROUP BY d.id, d.serial_number, dm.name
                ORDER BY maintenance_count DESC
                LIMIT 10
            ),
            upcoming_schedules AS (
                SELECT 
                    ms.id,
                    ms.due_date,
                    ms.schedule_type,
                    d.serial_number,
                    dm.name as model_name,
                    CASE 
                        WHEN ms.due_date < CURRENT_DATE THEN 'overdue'
                        WHEN ms.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
                        ELSE 'scheduled'
                    END as urgency
                FROM maintenance_schedules ms
                JOIN device d ON ms.device_id = d.id
                JOIN device_models dm ON d.model_id = dm.id
                WHERE d.organization_id = $1::uuid
                AND ms.status = 'pending'
                ORDER BY ms.due_date ASC
                LIMIT 10
            )
            SELECT 
                (SELECT row_to_json(maintenance_summary) FROM maintenance_summary) as summary,
                (SELECT json_agg(maintenance_by_type) FROM maintenance_by_type) as by_type,
                (SELECT json_agg(device_performance) FROM device_performance) as device_performance,
                (SELECT json_agg(upcoming_schedules) FROM upcoming_schedules) as upcoming_schedules
        `;

        const result = await prisma.$queryRawUnsafe(dashboardQuery, orgId, startDate.toISOString().split('T')[0]);
        
        const dashboardData = result[0];

        return res.status(200).json({
            success: true,
            data: {
                period: {
                    days: periodDays,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                summary: dashboardData.summary || {
                    total_maintenances: 0,
                    recent_maintenances: 0,
                    completed_maintenances: 0,
                    failed_maintenances: 0,
                    total_cost: 0,
                    avg_cost: 0,
                    avg_duration: 0,
                    emergency_maintenances: 0
                },
                by_type: dashboardData.by_type || [],
                device_performance: dashboardData.device_performance || [],
                upcoming_schedules: dashboardData.upcoming_schedules || []
            }
        });

    } catch (error) {
        console.error('Error fetching maintenance dashboard:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance dashboard',
            error: error.message
        });
    }
};

// ==================== MAINTENANCE STATISTICS ====================

export const getMaintenanceStatistics = async (req, res) => {
    try {
        const { 
            period = '90',
            group_by = 'month',
            device_id,
            maintenance_type 
        } = req.query;
        
        const orgId = req.user.organizationId;
        const periodDays = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        // Determine grouping interval
        const intervalMap = {
            'day': 'day',
            'week': 'week', 
            'month': 'month',
            'quarter': 'quarter',
            'year': 'year'
        };
        const interval = intervalMap[group_by] || 'month';

        let whereConditions = ['mh.organization_id = $1::uuid', 'mh.performed_date >= $2::date'];
        let params = [orgId, startDate.toISOString().split('T')[0]];
        let paramIndex = 3;

        if (device_id) {
            whereConditions.push(`mh.device_id = $${paramIndex}::uuid`);
            params.push(device_id);
            paramIndex++;
        }

        if (maintenance_type) {
            whereConditions.push(`mh.maintenance_type = $${paramIndex}::maintenance_type`);
            params.push(maintenance_type);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const statisticsQuery = `
            WITH time_series AS (
                SELECT 
                    date_trunc('${interval}', mh.performed_date) as period,
                    COUNT(*) as maintenance_count,
                    COUNT(CASE WHEN mh.status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN mh.status = 'failed' THEN 1 END) as failed_count,
                    COUNT(CASE WHEN mh.severity = 'emergency' THEN 1 END) as emergency_count,
                    COALESCE(SUM(mh.cost), 0) as total_cost,
                    COALESCE(AVG(mh.cost), 0) as avg_cost,
                    COALESCE(AVG(mh.duration_minutes), 0) as avg_duration,
                    COALESCE(AVG(mh.performance_rating), 0) as avg_performance_rating
                FROM maintenance_history mh
                WHERE ${whereClause}
                GROUP BY date_trunc('${interval}', mh.performed_date)
                ORDER BY period DESC
            ),
            maintenance_trends AS (
                SELECT 
                    mh.maintenance_type,
                    COUNT(*) as count,
                    COALESCE(SUM(mh.cost), 0) as total_cost,
                    COALESCE(AVG(mh.duration_minutes), 0) as avg_duration,
                    COUNT(CASE WHEN mh.status = 'completed' THEN 1 END) as success_count,
                    ROUND(
                        COUNT(CASE WHEN mh.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2
                    ) as success_rate
                FROM maintenance_history mh
                WHERE ${whereClause}
                GROUP BY mh.maintenance_type
            ),
            top_devices AS (
                SELECT 
                    d.serial_number,
                    dm.name as model_name,
                    COUNT(mh.id) as maintenance_count,
                    COALESCE(SUM(mh.cost), 0) as total_cost,
                    COALESCE(AVG(mh.performance_rating), 0) as avg_performance
                FROM maintenance_history mh
                JOIN device d ON mh.device_id = d.id
                JOIN device_models dm ON d.model_id = dm.id
                WHERE ${whereClause}
                GROUP BY d.serial_number, dm.name
                ORDER BY maintenance_count DESC
                LIMIT 10
            ),
            technician_performance AS (
                SELECT 
                    COALESCE(u.full_name, mh.technician_name, 'Unknown') as technician_name,
                    COUNT(*) as maintenance_count,
                    COALESCE(AVG(mh.duration_minutes), 0) as avg_duration,
                    COUNT(CASE WHEN mh.status = 'completed' THEN 1 END) as completed_count,
                    ROUND(
                        COUNT(CASE WHEN mh.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2
                    ) as completion_rate
                FROM maintenance_history mh
                LEFT JOIN users u ON mh.performed_by = u.id
                WHERE ${whereClause}
                GROUP BY COALESCE(u.full_name, mh.technician_name, 'Unknown')
                HAVING COUNT(*) >= 3
                ORDER BY completion_rate DESC, maintenance_count DESC
                LIMIT 10
            )
            SELECT 
                (SELECT json_agg(time_series ORDER BY period) FROM time_series) as time_series,
                (SELECT json_agg(maintenance_trends) FROM maintenance_trends) as trends,
                (SELECT json_agg(top_devices) FROM top_devices) as top_devices,
                (SELECT json_agg(technician_performance) FROM technician_performance) as technician_performance
        `;

        const result = await prisma.$queryRawUnsafe(statisticsQuery, ...params);
        const statistics = result[0];

        return res.status(200).json({
            success: true,
            data: {
                period: {
                    days: periodDays,
                    group_by,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                filters: {
                    device_id,
                    maintenance_type
                },
                time_series: statistics.time_series || [],
                trends: statistics.trends || [],
                top_devices: statistics.top_devices || [],
                technician_performance: statistics.technician_performance || []
            }
        });

    } catch (error) {
        console.error('Error fetching maintenance statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance statistics',
            error: error.message
        });
    }
};

// ==================== UPCOMING MAINTENANCE ====================

export const getUpcomingMaintenance = async (req, res) => {
    try {
        const { 
            days_ahead = 30,
            include_overdue = true,
            device_id,
            maintenance_type 
        } = req.query;
        
        const orgId = req.user.organizationId;
        const daysAhead = parseInt(days_ahead);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        let whereConditions = ['d.organization_id = $1::uuid'];
        let params = [orgId];
        let paramIndex = 2;

        if (include_overdue === 'true') {
            whereConditions.push(`ms.due_date <= $${paramIndex}::date`);
        } else {
            whereConditions.push(`ms.due_date BETWEEN CURRENT_DATE AND $${paramIndex}::date`);
        }
        params.push(futureDate.toISOString().split('T')[0]);
        paramIndex++;

        if (device_id) {
            whereConditions.push(`d.id = $${paramIndex}::uuid`);
            params.push(device_id);
            paramIndex++;
        }

        if (maintenance_type) {
            whereConditions.push(`ms.schedule_type = $${paramIndex}::maintenance_type`);
            params.push(maintenance_type);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const upcomingQuery = `
            SELECT 
                ms.id as schedule_id,
                ms.due_date,
                ms.schedule_type,
                ms.status as schedule_status,
                
                d.id as device_id,
                d.serial_number,
                d.asset_tag,
                d.location,
                d.status as device_status,
                
                dm.name as model_name,
                dm.model_number,
                man.name as manufacturer_name,
                
                -- Calculate urgency
                CASE 
                    WHEN ms.due_date < CURRENT_DATE THEN 'overdue'
                    WHEN ms.due_date = CURRENT_DATE THEN 'due_today'
                    WHEN ms.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
                    WHEN ms.due_date <= CURRENT_DATE + INTERVAL '14 days' THEN 'due_medium'
                    ELSE 'due_later'
                END as urgency,
                
                -- Days until due (negative for overdue)
                ms.due_date - CURRENT_DATE as days_until_due,
                
                -- Last maintenance info
                lm.performed_date as last_maintenance_date,
                lm.maintenance_type as last_maintenance_type,
                lm.status as last_maintenance_status,
                lm.device_condition as last_device_condition,
                
                -- Department info
                dept.name as department_name,
                dept.code as department_code
                
            FROM maintenance_schedules ms
            JOIN device d ON ms.device_id = d.id
            JOIN device_models dm ON d.model_id = dm.id
            LEFT JOIN manufacturers man ON dm.manufacturer_id = man.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN LATERAL (
                SELECT 
                    mh.performed_date,
                    mh.maintenance_type,
                    mh.status,
                    mh.device_condition
                FROM maintenance_history mh
                WHERE mh.device_id = d.id
                ORDER BY mh.performed_date DESC
                LIMIT 1
            ) lm ON true
            WHERE ${whereClause}
            AND ms.status = 'pending'
            ORDER BY 
                CASE 
                    WHEN ms.due_date < CURRENT_DATE THEN 1  -- Overdue first
                    WHEN ms.due_date = CURRENT_DATE THEN 2  -- Due today second
                    ELSE 3                                  -- Future dates last
                END,
                ms.due_date ASC
        `;

        const upcomingMaintenance = await prisma.$queryRawUnsafe(upcomingQuery, ...params);

        // Group by urgency for better organization
        const groupedByUrgency = upcomingMaintenance.reduce((acc, item) => {
            const urgency = item.urgency;
            if (!acc[urgency]) {
                acc[urgency] = [];
            }
            acc[urgency].push(item);
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            data: {
                period: {
                    days_ahead: daysAhead,
                    include_overdue: include_overdue === 'true',
                    end_date: futureDate.toISOString().split('T')[0]
                },
                filters: {
                    device_id,
                    maintenance_type
                },
                summary: {
                    total: upcomingMaintenance.length,
                    overdue: groupedByUrgency.overdue?.length || 0,
                    due_today: groupedByUrgency.due_today?.length || 0,
                    due_soon: groupedByUrgency.due_soon?.length || 0,
                    due_medium: groupedByUrgency.due_medium?.length || 0,
                    due_later: groupedByUrgency.due_later?.length || 0
                },
                by_urgency: groupedByUrgency,
                all_upcoming: upcomingMaintenance
            }
        });

    } catch (error) {
        console.error('Error fetching upcoming maintenance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming maintenance',
            error: error.message
        });
    }
};

// ==================== BULK CREATE MAINTENANCE ====================

export const bulkCreateMaintenance = async (req, res) => {
    try {
        const { maintenances } = req.body;
        
        if (!Array.isArray(maintenances) || maintenances.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Maintenances array is required'
            });
        }

        if (maintenances.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 50 maintenance records can be created at once'
            });
        }

        const results = await prisma.$transaction(async (tx) => {
            const createdRecords = [];
            const errors = [];

            for (let i = 0; i < maintenances.length; i++) {
                try {
                    const maintenance = maintenances[i];
                    
                    // Validate required fields
                    if (!maintenance.device_id || !maintenance.maintenance_type || !maintenance.title) {
                        errors.push({
                            index: i,
                            error: 'Missing required fields: device_id, maintenance_type, title'
                        });
                        continue;
                    }

                    const result = await tx.$queryRaw`
                        INSERT INTO maintenance_history (
                            device_id,
                            maintenance_type,
                            title,
                            description,
                            performed_date,
                            duration_minutes,
                            technician_name,
                            cost,
                            status,
                            severity,
                            organization_id,
                            created_by
                        ) VALUES (
                            ${maintenance.device_id}::uuid,
                            ${maintenance.maintenance_type}::maintenance_type,
                            ${maintenance.title},
                            ${maintenance.description || null},
                            ${maintenance.performed_date || new Date()}::timestamptz,
                            ${maintenance.duration_minutes || null}::integer,
                            ${maintenance.technician_name || null},
                            ${maintenance.cost || null}::decimal,
                            ${maintenance.status || 'completed'}::maintenance_status,
                            ${maintenance.severity || 'routine'}::maintenance_severity,
                            ${req.user.organizationId}::uuid,
                            ${req.user.id}::uuid
                        ) RETURNING id
                    `;

                    createdRecords.push({
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

            return { createdRecords, errors };
        });

        return res.status(201).json({
            success: true,
            message: `Successfully created ${results.createdRecords.length} maintenance records`,
            data: {
                created: results.createdRecords,
                errors: results.errors,
                summary: {
                    total_requested: maintenances.length,
                    successful: results.createdRecords.length,
                    failed: results.errors.length
                }
            }
        });

    } catch (error) {
        console.error('Error bulk creating maintenance records:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create maintenance records',
            error: error.message
        });
    }
};

// ==================== EXPORT MAINTENANCE REPORT ====================

export const exportMaintenanceReport = async (req, res) => {
    try {
        const {
            format = 'excel',
            date_from,
            date_to,
            device_id,
            maintenance_type,
            status
        } = req.query;

        // This is a placeholder - actual implementation would need
        // libraries like exceljs, pdfkit, or csv-writer
        
        return res.status(501).json({
            success: false,
            message: 'Export functionality not yet implemented',
            requested_format: format,
            filters: {
                date_from,
                date_to,
                device_id,
                maintenance_type,
                status
            }
        });

    } catch (error) {
        console.error('Error exporting maintenance report:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export maintenance report',
            error: error.message
        });
    }
};