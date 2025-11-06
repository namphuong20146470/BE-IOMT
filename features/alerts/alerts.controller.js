// features/alerts/alerts.controller.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping between existing warning system and new alerts API
const ALERT_TYPE_MAPPING = {
    'voltage_high': 'threshold',
    'voltage_low': 'threshold', 
    'current_high': 'threshold',
    'power_high': 'threshold',
    'connection_lost': 'offline',
    'maintenance_due': 'maintenance'
};

const SEVERITY_MAPPING = {
    'critical': 'critical',
    'major': 'high', 
    'moderate': 'medium',
    'minor': 'low'
};

/**
 * Get all alerts with filtering and pagination
 * Maps from existing device_warning_logs table
 */
export const getAllAlerts = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            severity, 
            alert_type,
            device_id,
            organization_id,
            start_date,
            end_date 
        } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause for SQL query
        let whereConditions = [];
        let params = [];

        // Organization filter based on user permissions
        if (!req.user.permissions?.includes('system.admin')) {
            whereConditions.push('d.organization_id = $' + (params.length + 1));
            params.push(req.user.organizationId);
        } else if (organization_id) {
            whereConditions.push('d.organization_id = $' + (params.length + 1));
            params.push(organization_id);
        }

        // Status filter
        if (status) {
            whereConditions.push('w.status = $' + (params.length + 1));
            params.push(status);
        }

        // Severity filter (map from new to old format)
        if (severity) {
            const oldSeverityValues = Object.entries(SEVERITY_MAPPING)
                .filter(([old, newSev]) => newSev === severity)
                .map(([old, newSev]) => old);
            
            if (oldSeverityValues.length > 0) {
                whereConditions.push(`w.warning_severity IN (${oldSeverityValues.map((_, i) => '$' + (params.length + i + 1)).join(', ')})`);
                params.push(...oldSeverityValues);
            }
        }

        // Alert type filter
        if (alert_type) {
            const oldTypeValues = Object.entries(ALERT_TYPE_MAPPING)
                .filter(([old, newType]) => newType === alert_type)
                .map(([old, newType]) => old);
            
            if (oldTypeValues.length > 0) {
                whereConditions.push(`w.warning_type IN (${oldTypeValues.map((_, i) => '$' + (params.length + i + 1)).join(', ')})`);
                params.push(...oldTypeValues);
            }
        }

        // Device filter
        if (device_id) {
            whereConditions.push('w.device_id = $' + (params.length + 1));
            params.push(device_id);
        }

        // Date range filter
        if (start_date) {
            whereConditions.push('w.created_at >= $' + (params.length + 1));
            params.push(new Date(start_date));
        }
        if (end_date) {
            whereConditions.push('w.created_at <= $' + (params.length + 1));
            params.push(new Date(end_date));
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get alerts with device information
        const alertsQuery = `
            SELECT 
                w.id,
                w.device_id,
                w.device_type,
                w.warning_type as original_alert_type,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                w.warning_severity as original_severity,
                CASE 
                    ${Object.entries(SEVERITY_MAPPING).map(([old, newSev]) => 
                        `WHEN w.warning_severity = '${old}' THEN '${newSev}'`
                    ).join('\n                    ')}
                    ELSE 'medium'
                END as severity,
                w.warning_message as message,
                w.status,
                w.measured_value as current_value,
                w.threshold_value,
                w.created_at,
                w.acknowledged_at,
                w.resolved_at,
                w.resolution_notes,
                d.device_code,
                d.serial_number,
                d.location,
                o.name as organization_name,
                dept.name as department_name
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            ${whereClause}
            ORDER BY w.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            ${whereClause}
        `;

        params.push(parseInt(limit), skip);

        const [alerts, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(alertsQuery, ...params),
            prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2))
        ]);

        const total = parseInt(countResult[0].total);

        // Format alerts for API response
        const formattedAlerts = alerts.map(alert => ({
            id: alert.id,
            device_id: alert.device_id,
            alert_type: alert.alert_type,
            severity: alert.severity,
            message: alert.message,
            status: alert.status,
            current_value: alert.current_value,
            threshold_value: alert.threshold_value,
            created_at: alert.created_at,
            acknowledged_at: alert.acknowledged_at,
            resolved_at: alert.resolved_at,
            resolution_notes: alert.resolution_notes,
            device: {
                device_code: alert.device_code,
                serial_number: alert.serial_number,
                location: alert.location,
                type: alert.device_type,
                organization: alert.organization_name,
                department: alert.department_name
            }
        }));

        return res.status(200).json({
            success: true,
            data: formattedAlerts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch alerts',
            error: error.message
        });
    }
};

/**
 * Get alert by ID
 */
export const getAlertById = async (req, res) => {
    try {
        const { id } = req.params;

        const alertQuery = `
            SELECT 
                w.id,
                w.device_id,
                w.device_type,
                w.warning_type as original_alert_type,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                w.warning_severity as original_severity,
                CASE 
                    ${Object.entries(SEVERITY_MAPPING).map(([old, newSev]) => 
                        `WHEN w.warning_severity = '${old}' THEN '${newSev}'`
                    ).join('\n                    ')}
                    ELSE 'medium'
                END as severity,
                w.warning_message as message,
                w.status,
                w.measured_value as current_value,
                w.threshold_value,
                w.created_at,
                w.acknowledged_at,
                w.resolved_at,
                w.resolution_notes,
                d.device_code,
                d.serial_number,
                d.location,
                d.status as device_status,
                o.name as organization_name,
                dept.name as department_name,
                dm.name as device_model_name
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN device_models dm ON d.model_id = dm.id
            WHERE w.id = $1
        `;

        const alerts = await prisma.$queryRawUnsafe(alertQuery, parseInt(id));

        if (alerts.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        const alert = alerts[0];

        // Check organization access
        if (!req.user.permissions?.includes('system.admin')) {
            const device = await prisma.device.findUnique({
                where: { id: alert.device_id },
                select: { organizationId: true }
            });

            if (!device || device.organizationId !== req.user.organizationId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Alert belongs to different organization'
                });
            }
        }

        const formattedAlert = {
            id: alert.id,
            device_id: alert.device_id,
            alert_type: alert.alert_type,
            severity: alert.severity,
            message: alert.message,
            status: alert.status,
            current_value: alert.current_value,
            threshold_value: alert.threshold_value,
            created_at: alert.created_at,
            acknowledged_at: alert.acknowledged_at,
            resolved_at: alert.resolved_at,
            resolution_notes: alert.resolution_notes,
            device: {
                device_code: alert.device_code,
                serial_number: alert.serial_number,
                location: alert.location,
                status: alert.device_status,
                type: alert.device_type,
                model_name: alert.device_model_name,
                organization: alert.organization_name,
                department: alert.department_name
            }
        };

        return res.status(200).json({
            success: true,
            data: formattedAlert
        });
    } catch (error) {
        console.error('Error fetching alert:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch alert',
            error: error.message
        });
    }
};

/**
 * Get alerts for specific device
 */
export const getAlertsByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { page = 1, limit = 10, status, severity } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check device access
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { organizationId: true }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            device.organizationId !== req.user.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        let whereConditions = ['w.device_id = $1'];
        let params = [deviceId];

        if (status) {
            whereConditions.push('w.status = $' + (params.length + 1));
            params.push(status);
        }

        if (severity) {
            const oldSeverityValues = Object.entries(SEVERITY_MAPPING)
                .filter(([old, newSev]) => newSev === severity)
                .map(([old, newSev]) => old);
            
            if (oldSeverityValues.length > 0) {
                whereConditions.push(`w.warning_severity IN (${oldSeverityValues.map((_, i) => '$' + (params.length + i + 1)).join(', ')})`);
                params.push(...oldSeverityValues);
            }
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        const alertsQuery = `
            SELECT 
                w.id,
                w.device_id,
                w.warning_type as original_alert_type,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                CASE 
                    ${Object.entries(SEVERITY_MAPPING).map(([old, newSev]) => 
                        `WHEN w.warning_severity = '${old}' THEN '${newSev}'`
                    ).join('\n                    ')}
                    ELSE 'medium'
                END as severity,
                w.warning_message as message,
                w.status,
                w.measured_value as current_value,
                w.threshold_value,
                w.created_at,
                w.acknowledged_at,
                w.resolved_at
            FROM device_warning_logs w
            ${whereClause}
            ORDER BY w.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM device_warning_logs w
            ${whereClause}
        `;

        params.push(parseInt(limit), skip);

        const [alerts, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(alertsQuery, ...params),
            prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2))
        ]);

        const total = parseInt(countResult[0].total);

        return res.status(200).json({
            success: true,
            data: alerts.map(alert => ({
                id: alert.id,
                device_id: alert.device_id,
                alert_type: alert.alert_type,
                severity: alert.severity,
                message: alert.message,
                status: alert.status,
                current_value: alert.current_value,
                threshold_value: alert.threshold_value,
                created_at: alert.created_at,
                acknowledged_at: alert.acknowledged_at,
                resolved_at: alert.resolved_at
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching device alerts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device alerts',
            error: error.message
        });
    }
};

/**
 * Get active alerts (status = 'active' or 'new')
 */
export const getActiveAlerts = async (req, res) => {
    try {
        const { limit = 20, severity } = req.query;

        let whereConditions = [`w.status IN ('active', 'new')`];
        let params = [];

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            whereConditions.push('d.organization_id = $' + (params.length + 1));
            params.push(req.user.organizationId);
        }

        // Severity filter
        if (severity) {
            const oldSeverityValues = Object.entries(SEVERITY_MAPPING)
                .filter(([old, newSev]) => newSev === severity)
                .map(([old, newSev]) => old);
            
            if (oldSeverityValues.length > 0) {
                whereConditions.push(`w.warning_severity IN (${oldSeverityValues.map((_, i) => '$' + (params.length + i + 1)).join(', ')})`);
                params.push(...oldSeverityValues);
            }
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        const alertsQuery = `
            SELECT 
                w.id,
                w.device_id,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                CASE 
                    ${Object.entries(SEVERITY_MAPPING).map(([old, newSev]) => 
                        `WHEN w.warning_severity = '${old}' THEN '${newSev}'`
                    ).join('\n                    ')}
                    ELSE 'medium'
                END as severity,
                w.warning_message as message,
                w.status,
                w.created_at,
                d.device_code,
                d.location
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            ${whereClause}
            ORDER BY 
                CASE w.warning_severity 
                    WHEN 'critical' THEN 1
                    WHEN 'major' THEN 2
                    WHEN 'moderate' THEN 3
                    WHEN 'minor' THEN 4
                    ELSE 5
                END,
                w.created_at DESC
            LIMIT $${params.length + 1}
        `;

        params.push(parseInt(limit));

        const alerts = await prisma.$queryRawUnsafe(alertsQuery, ...params);

        return res.status(200).json({
            success: true,
            data: alerts.map(alert => ({
                id: alert.id,
                device_id: alert.device_id,
                alert_type: alert.alert_type,
                severity: alert.severity,
                message: alert.message,
                status: alert.status,
                created_at: alert.created_at,
                device: {
                    device_code: alert.device_code,
                    location: alert.location
                }
            })),
            count: alerts.length
        });
    } catch (error) {
        console.error('Error fetching active alerts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch active alerts',
            error: error.message
        });
    }
};

/**
 * Get alerts statistics
 */
export const getAlertsStatistics = async (req, res) => {
    try {
        const { organization_id, period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let orgFilter = '';
        let params = [startDate];

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            orgFilter = 'AND d.organization_id = $2';
            params.push(req.user.organizationId);
        } else if (organization_id) {
            orgFilter = 'AND d.organization_id = $2';
            params.push(organization_id);
        }

        const statisticsQuery = `
            SELECT 
                COUNT(*) as total_alerts,
                COUNT(CASE WHEN w.status = 'active' THEN 1 END) as active_alerts,
                COUNT(CASE WHEN w.status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
                COUNT(CASE WHEN w.status = 'resolved' THEN 1 END) as resolved_alerts,
                COUNT(CASE WHEN w.warning_severity = 'critical' THEN 1 END) as critical_alerts,
                COUNT(CASE WHEN w.warning_severity = 'major' THEN 1 END) as high_alerts,
                COUNT(CASE WHEN w.warning_severity = 'moderate' THEN 1 END) as medium_alerts,
                COUNT(CASE WHEN w.warning_severity = 'minor' THEN 1 END) as low_alerts
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            WHERE w.created_at >= $1 ${orgFilter}
        `;

        const alertsByTypeQuery = `
            SELECT 
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                COUNT(*) as count
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            WHERE w.created_at >= $1 ${orgFilter}
            GROUP BY alert_type
        `;

        const alertsByDayQuery = `
            SELECT 
                DATE(w.created_at) as date,
                COUNT(*) as count
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            WHERE w.created_at >= $1 ${orgFilter}
            GROUP BY DATE(w.created_at)
            ORDER BY date DESC
            LIMIT 30
        `;

        const [statistics, alertsByType, alertsByDay] = await Promise.all([
            prisma.$queryRawUnsafe(statisticsQuery, ...params),
            prisma.$queryRawUnsafe(alertsByTypeQuery, ...params),
            prisma.$queryRawUnsafe(alertsByDayQuery, ...params)
        ]);

        const stats = statistics[0];

        return res.status(200).json({
            success: true,
            data: {
                period: {
                    days,
                    start_date: startDate,
                    end_date: new Date()
                },
                summary: {
                    total: parseInt(stats.total_alerts),
                    active: parseInt(stats.active_alerts),
                    acknowledged: parseInt(stats.acknowledged_alerts),
                    resolved: parseInt(stats.resolved_alerts)
                },
                by_severity: {
                    critical: parseInt(stats.critical_alerts),
                    high: parseInt(stats.high_alerts),
                    medium: parseInt(stats.medium_alerts),
                    low: parseInt(stats.low_alerts)
                },
                by_type: alertsByType.map(item => ({
                    type: item.alert_type,
                    count: parseInt(item.count)
                })),
                daily_trends: alertsByDay.map(item => ({
                    date: item.date,
                    count: parseInt(item.count)
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching alerts statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch alerts statistics',
            error: error.message
        });
    }
};

/**
 * Update alert status
 */
export const updateAlertStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_notes } = req.body;

        // Check if alert exists and user has access
        const alert = await prisma.$queryRaw`
            SELECT w.*, d.organization_id
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            WHERE w.id = ${parseInt(id)}
        `;

        if (alert.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        const alertData = alert[0];

        if (!req.user.permissions?.includes('system.admin') && 
            alertData.organization_id !== req.user.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Alert belongs to different organization'
            });
        }

        // Update alert
        const updateData = { status };
        
        if (status === 'acknowledged' && !alertData.acknowledged_at) {
            updateData.acknowledged_at = new Date();
        }
        
        if (status === 'resolved') {
            updateData.resolved_at = new Date();
            if (resolution_notes) {
                updateData.resolution_notes = resolution_notes;
            }
        }

        await prisma.$queryRaw`
            UPDATE device_warning_logs 
            SET 
                status = ${status},
                acknowledged_at = ${updateData.acknowledged_at || null},
                resolved_at = ${updateData.resolved_at || null},
                resolution_notes = ${updateData.resolution_notes || null}
            WHERE id = ${parseInt(id)}
        `;

        return res.status(200).json({
            success: true,
            message: `Alert ${status} successfully`,
            data: {
                id: parseInt(id),
                status,
                acknowledged_at: updateData.acknowledged_at,
                resolved_at: updateData.resolved_at,
                resolution_notes: updateData.resolution_notes
            }
        });
    } catch (error) {
        console.error('Error updating alert status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update alert status',
            error: error.message
        });
    }
};

/**
 * Acknowledge alert (shorthand endpoint)
 */
export const acknowledgeAlert = async (req, res) => {
    req.body = { status: 'acknowledged' };
    return updateAlertStatus(req, res);
};

/**
 * Resolve alert (shorthand endpoint)
 */
export const resolveAlert = async (req, res) => {
    const { resolution_notes } = req.body;
    req.body = { status: 'resolved', resolution_notes };
    return updateAlertStatus(req, res);
};

/**
 * Delete alert
 */
export const deleteAlert = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if alert exists and user has access
        const alert = await prisma.$queryRaw`
            SELECT w.*, d.organization_id
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            WHERE w.id = ${parseInt(id)}
        `;

        if (alert.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        const alertData = alert[0];

        if (!req.user.permissions?.includes('system.admin') && 
            alertData.organization_id !== req.user.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Alert belongs to different organization'
            });
        }

        await prisma.$queryRaw`DELETE FROM device_warning_logs WHERE id = ${parseInt(id)}`;

        return res.status(200).json({
            success: true,
            message: 'Alert deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting alert:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete alert',
            error: error.message
        });
    }
};

/**
 * Get alerts dashboard data
 */
export const getAlertsDashboard = async (req, res) => {
    try {
        let orgFilter = '';
        let params = [];

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            orgFilter = 'WHERE d.organization_id = $1';
            params.push(req.user.organizationId);
        }

        const dashboardQuery = `
            SELECT 
                COUNT(*) as total_alerts,
                COUNT(CASE WHEN w.status = 'active' THEN 1 END) as active_alerts,
                COUNT(CASE WHEN w.warning_severity = 'critical' AND w.status = 'active' THEN 1 END) as critical_active,
                COUNT(CASE WHEN w.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_last_24h,
                COUNT(CASE WHEN w.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as alerts_last_7d
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            ${orgFilter}
        `;

        const recentAlertsQuery = `
            SELECT 
                w.id,
                w.device_id,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                CASE 
                    ${Object.entries(SEVERITY_MAPPING).map(([old, newSev]) => 
                        `WHEN w.warning_severity = '${old}' THEN '${newSev}'`
                    ).join('\n                    ')}
                    ELSE 'medium'
                END as severity,
                w.warning_message as message,
                w.status,
                w.created_at,
                d.device_code,
                d.location
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            ${orgFilter ? orgFilter : ''}
            ORDER BY w.created_at DESC
            LIMIT 10
        `;

        const [dashboard, recentAlerts] = await Promise.all([
            prisma.$queryRawUnsafe(dashboardQuery, ...params),
            prisma.$queryRawUnsafe(recentAlertsQuery, ...params)
        ]);

        const dashboardData = dashboard[0];

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    total_alerts: parseInt(dashboardData.total_alerts),
                    active_alerts: parseInt(dashboardData.active_alerts),
                    critical_active: parseInt(dashboardData.critical_active),
                    alerts_last_24h: parseInt(dashboardData.alerts_last_24h),
                    alerts_last_7d: parseInt(dashboardData.alerts_last_7d)
                },
                recent_alerts: recentAlerts.map(alert => ({
                    id: alert.id,
                    device_id: alert.device_id,
                    alert_type: alert.alert_type,
                    severity: alert.severity,
                    message: alert.message,
                    status: alert.status,
                    created_at: alert.created_at,
                    device: {
                        device_code: alert.device_code,
                        location: alert.location
                    }
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching alerts dashboard:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch alerts dashboard',
            error: error.message
        });
    }
};

/**
 * Get critical alerts requiring immediate attention
 */
export const getCriticalAlerts = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        let orgFilter = '';
        let params = [];

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            orgFilter = 'AND d.organization_id = $' + (params.length + 1);
            params.push(req.user.organizationId);
        }

        const criticalAlertsQuery = `
            SELECT 
                w.id,
                w.device_id,
                CASE 
                    ${Object.entries(ALERT_TYPE_MAPPING).map(([old, newType]) => 
                        `WHEN w.warning_type = '${old}' THEN '${newType}'`
                    ).join('\n                    ')}
                    ELSE 'threshold'
                END as alert_type,
                w.warning_message as message,
                w.status,
                w.created_at,
                d.device_code,
                d.location,
                o.name as organization_name
            FROM device_warning_logs w
            LEFT JOIN devices d ON w.device_id = d.id
            LEFT JOIN organizations o ON d.organization_id = o.id
            WHERE w.warning_severity = 'critical' 
                AND w.status IN ('active', 'new')
                ${orgFilter}
            ORDER BY w.created_at DESC
            LIMIT $${params.length + 1}
        `;

        params.push(parseInt(limit));

        const criticalAlerts = await prisma.$queryRawUnsafe(criticalAlertsQuery, ...params);

        return res.status(200).json({
            success: true,
            data: criticalAlerts.map(alert => ({
                id: alert.id,
                device_id: alert.device_id,
                alert_type: alert.alert_type,
                severity: 'critical',
                message: alert.message,
                status: alert.status,
                created_at: alert.created_at,
                device: {
                    device_code: alert.device_code,
                    location: alert.location
                },
                organization: alert.organization_name
            })),
            count: criticalAlerts.length
        });
    } catch (error) {
        console.error('Error fetching critical alerts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch critical alerts',
            error: error.message
        });
    }
};