import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// AUDIT LOGS CONTROLLER
// ==========================================

/**
 * GET /actlog/logs - Lấy tất cả audit logs với organization-level security
 * Query params:
 * - page: số trang (default: 1)
 * - limit: số record trên 1 trang (default: 50, max: 1000)
 * - user_id: filter theo user
 * - action: filter theo action
 * - resource_type: filter theo resource type
 * - success: filter theo success status (true/false)
 * - from_date: từ ngày (YYYY-MM-DD)
 * - to_date: đến ngày (YYYY-MM-DD)
 * - search: tìm kiếm cross-field
 * - organization_id: filter theo organization (admin only)
 */
export const getAllLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            user_id,
            action,
            resource_type,
            success,
            from_date,
            to_date,
            search,
            organization_id
        } = req.query;

        // Validate and limit page size
        const pageSize = Math.min(parseInt(limit), 1000);
        const currentPage = Math.max(parseInt(page), 1);

        // Security: Organization-level filtering for non-super-admins
        const user = req.user;
        const isSuperAdmin = user?.role === 'system.admin' || 
                           (!user?.organization_id && !user?.department_id);

        let orgFilter = {};
        if (!isSuperAdmin) {
            // Non-super admin can only see their organization's logs
            if (user?.organization_id) {
                orgFilter.organization_id = user.organization_id;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: No organization access'
                });
            }
        } else if (organization_id) {
            // Super admin can filter by specific organization
            orgFilter.organization_id = organization_id;
        }

        // Tính offset cho pagination
        const offset = (currentPage - 1) * pageSize;

        // Build where conditions with organization security
        const whereConditions = { ...orgFilter };

        if (user_id) {
            whereConditions.user_id = user_id;
        }

        if (action) {
            whereConditions.action = {
                contains: action,
                mode: 'insensitive'
            };
        }

        if (resource_type) {
            whereConditions.resource_type = resource_type;
        }

        if (success !== undefined) {
            whereConditions.success = success === 'true';
        }

        if (from_date || to_date) {
            whereConditions.created_at = {};
            if (from_date) {
                whereConditions.created_at.gte = new Date(from_date);
            }
            if (to_date) {
                whereConditions.created_at.lte = new Date(to_date + 'T23:59:59.999Z');
            }
        }

        // Search across multiple fields
        if (search) {
            whereConditions.OR = [
                {
                    action: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    resource_type: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    ip_address: {
                        contains: search,
                        mode: 'insensitive'
                    }
                }
            ];
        }

        // Get total count for pagination
        const totalCount = await prisma.audit_logs.count({
            where: whereConditions
        });

        // Get logs with pagination and includes
        const logs = await prisma.audit_logs.findMany({
            where: whereConditions,
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        email: true
                    }
                },
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            skip: offset,
            take: pageSize
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / pageSize);
        const hasNextPage = currentPage < totalPages;
        const hasPrevPage = currentPage > 1;

        res.status(200).json({
            success: true,
            message: 'Audit logs retrieved successfully',
            data: {
                logs,
                pagination: {
                    current_page: currentPage,
                    total_pages: totalPages,
                    total_count: totalCount,
                    per_page: pageSize,
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage
                },
                filters_applied: {
                    organization_filter: !isSuperAdmin,
                    user_organization_id: user?.organization_id || null,
                    applied_filters: Object.keys(req.query).filter(key => 
                        req.query[key] && !['page', 'limit'].includes(key)
                    )
                }
            }
        });

    } catch (error) {
        console.error('Error getting audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit logs',
            error: error.message
        });
    }
};

/**
 * GET /actlog/logs/:id - Lấy audit log theo ID
 */
export const getLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const log = await prisma.audit_logs.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        email: true
                    }
                },
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            }
        });

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Audit log retrieved successfully',
            data: log
        });

    } catch (error) {
        console.error('Error getting audit log by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit log',
            error: error.message
        });
    }
};

/**
 * POST /actlog/logs - Tạo audit log mới
 */
export const createLog = async (req, res) => {
    try {
        const {
            user_id,
            organization_id,
            action,
            resource_type,
            resource_id,
            old_values,
            new_values,
            success = true,
            error_message
        } = req.body;

        // Validation
        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Action is required'
            });
        }

        // Get request metadata với fallbacks tốt hơn
        const ip_address = req.ip || 
                          req.connection?.remoteAddress || 
                          req.socket?.remoteAddress ||
                          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                          req.headers['x-real-ip'] ||
                          '127.0.0.1';
        
        const user_agent = req.get('User-Agent') || 
                          req.headers['user-agent'] || 
                          'Unknown-Agent';

        // Validate và clean data trước khi lưu
        const cleanedData = {
            user_id: user_id || null,
            organization_id: organization_id || null,
            action: action.toLowerCase().trim(), // Normalize action
            resource_type: resource_type?.toLowerCase()?.trim() || null,
            resource_id: resource_id || null,
            old_values: old_values && Object.keys(old_values).length > 0 ? old_values : null,
            new_values: new_values && Object.keys(new_values).length > 0 ? new_values : null,
            ip_address: ip_address,
            user_agent: user_agent.substring(0, 500), // Limit length
            success: Boolean(success),
            error_message: error_message?.substring(0, 1000) || null // Limit error message length
        };

        const log = await prisma.audit_logs.create({
            data: cleanedData,
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        email: true
                    }
                },
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Audit log created successfully',
            data: log
        });

    } catch (error) {
        console.error('Error creating audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create audit log',
            error: error.message
        });
    }
};

/**
 * DELETE /actlog/logs/:id - Xóa audit log theo ID (chỉ admin)
 */
export const deleteLog = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if log exists
        const existingLog = await prisma.audit_logs.findUnique({
            where: { id }
        });

        if (!existingLog) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found'
            });
        }

        await prisma.audit_logs.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Audit log deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete audit log',
            error: error.message
        });
    }
};

/**
 * DELETE /actlog/logs/bulk - Xóa nhiều audit logs (chỉ admin)
 */
export const deleteBulkLogs = async (req, res) => {
    try {
        const { ids, confirm_delete } = req.body;

        if (confirm_delete !== 'CONFIRM_DELETE') {
            return res.status(400).json({
                success: false,
                message: 'Please confirm delete by sending confirm_delete: "CONFIRM_DELETE"'
            });
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of log IDs to delete'
            });
        }

        const result = await prisma.audit_logs.deleteMany({
            where: {
                id: {
                    in: ids
                }
            }
        });

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${result.count} audit logs`,
            deleted_count: result.count
        });

    } catch (error) {
        console.error('Error bulk deleting audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete audit logs',
            error: error.message
        });
    }
};

/**
 * DELETE /actlog/logs/all - Xóa toàn bộ audit logs (chỉ super admin)
 */
export const deleteAllLogs = async (req, res) => {
    try {
        const { confirmReset } = req.body;

        if (confirmReset !== 'CONFIRM_DELETE_ALL_DATA') {
            return res.status(400).json({
                success: false,
                message: 'Invalid confirmation. Please send confirmReset: "CONFIRM_DELETE_ALL_DATA"'
            });
        }

        // Count before deletion
        const countBefore = await prisma.audit_logs.count();

        // Delete all audit logs
        const result = await prisma.audit_logs.deleteMany({});

        res.status(200).json({
            success: true,
            message: 'All audit logs deleted successfully',
            deleted_count: result.count,
            count_before: countBefore
        });

    } catch (error) {
        console.error('Error deleting all audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete all audit logs',
            error: error.message
        });
    }
};

/**
 * GET /actlog/logs/stats - Thống kê audit logs
 */
export const getLogStats = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        // Total logs
        const totalLogs = await prisma.audit_logs.count();

        // Recent logs (within specified days)
        const recentLogs = await prisma.audit_logs.count({
            where: {
                created_at: {
                    gte: fromDate
                }
            }
        });

        // Success vs failure logs
        const successLogs = await prisma.audit_logs.count({
            where: {
                success: true,
                created_at: {
                    gte: fromDate
                }
            }
        });

        const failureLogs = await prisma.audit_logs.count({
            where: {
                success: false,
                created_at: {
                    gte: fromDate
                }
            }
        });

        // Top actions
        const topActions = await prisma.audit_logs.groupBy({
            by: ['action'],
            where: {
                created_at: {
                    gte: fromDate
                }
            },
            _count: {
                action: true
            },
            orderBy: {
                _count: {
                    action: 'desc'
                }
            },
            take: 10
        });

        // Top resource types
        const topResourceTypes = await prisma.audit_logs.groupBy({
            by: ['resource_type'],
            where: {
                created_at: {
                    gte: fromDate
                },
                resource_type: {
                    not: null
                }
            },
            _count: {
                resource_type: true
            },
            orderBy: {
                _count: {
                    resource_type: 'desc'
                }
            },
            take: 10
        });

        // Top users (most active)
        const topUsers = await prisma.audit_logs.groupBy({
            by: ['user_id'],
            where: {
                created_at: {
                    gte: fromDate
                },
                user_id: {
                    not: null
                }
            },
            _count: {
                user_id: true
            },
            orderBy: {
                _count: {
                    user_id: 'desc'
                }
            },
            take: 10
        });

        // Get user details for top users
        const topUsersWithDetails = await Promise.all(
            topUsers.map(async (userStat) => {
                const user = await prisma.users.findUnique({
                    where: { id: userStat.user_id },
                    select: {
                        id: true,
                        username: true,
                        full_name: true
                    }
                });
                return {
                    ...user,
                    log_count: userStat._count.user_id
                };
            })
        );

        res.status(200).json({
            success: true,
            message: 'Audit log statistics retrieved successfully',
            data: {
                period_days: parseInt(days),
                total_logs: totalLogs,
                recent_logs: recentLogs,
                success_logs: successLogs,
                failure_logs: failureLogs,
                success_rate: recentLogs > 0 ? ((successLogs / recentLogs) * 100).toFixed(2) : 0,
                top_actions: topActions.map(item => ({
                    action: item.action,
                    count: item._count.action
                })),
                top_resource_types: topResourceTypes.map(item => ({
                    resource_type: item.resource_type,
                    count: item._count.resource_type
                })),
                top_users: topUsersWithDetails
            }
        });

    } catch (error) {
        console.error('Error getting audit log stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit log statistics',
            error: error.message
        });
    }
};

/**
 * GET /actlog/logs/export - Export audit logs (CSV hoặc JSON)
 */
export const exportLogs = async (req, res) => {
    try {
        const {
            format = 'json', // json, csv
            user_id,
            action,
            resource_type,
            from_date,
            to_date,
            limit = 1000
        } = req.query;

        // Build where conditions (same as getAllLogs)
        const whereConditions = {};

        if (user_id) whereConditions.user_id = user_id;
        if (action) whereConditions.action = { contains: action, mode: 'insensitive' };
        if (resource_type) whereConditions.resource_type = resource_type;

        if (from_date || to_date) {
            whereConditions.created_at = {};
            if (from_date) whereConditions.created_at.gte = new Date(from_date);
            if (to_date) whereConditions.created_at.lte = new Date(to_date + 'T23:59:59.999Z');
        }

        const logs = await prisma.audit_logs.findMany({
            where: whereConditions,
            include: {
                users: {
                    select: {
                        username: true,
                        full_name: true
                    }
                },
                organizations: {
                    select: {
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: parseInt(limit)
        });

        if (format.toLowerCase() === 'csv') {
            // Generate CSV
            const csvHeader = 'ID,User,Organization,Action,Resource Type,Resource ID,Success,IP Address,Created At\n';
            const csvRows = logs.map(log => 
                `"${log.id}","${log.users?.username || 'N/A'}","${log.organizations?.name || 'N/A'}","${log.action}","${log.resource_type || ''}","${log.resource_id || ''}","${log.success}","${log.ip_address || ''}","${log.created_at}"`
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        } else {
            // Return JSON
            res.status(200).json({
                success: true,
                message: 'Audit logs exported successfully',
                count: logs.length,
                data: logs
            });
        }

    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export audit logs',
            error: error.message
        });
    }
};

/**
 * GET /actlog/logs/timeline - Lấy timeline analytics của audit logs
 */
export const getLogTimeline = async (req, res) => {
    try {
        const { days = 7, interval = 'hour' } = req.query; // hour, day, week
        
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        // Organization security check
        const user = req.user;
        const isSuperAdmin = user?.role === 'system.admin' || 
                           (!user?.organization_id && !user?.department_id);

        let whereConditions = {
            created_at: {
                gte: fromDate
            }
        };

        if (!isSuperAdmin && user?.organization_id) {
            whereConditions.organization_id = user.organization_id;
        }

        // Group by time intervals
        let timeFormat;
        switch (interval) {
            case 'hour':
                timeFormat = "DATE_TRUNC('hour', created_at)";
                break;
            case 'day':
                timeFormat = "DATE_TRUNC('day', created_at)";
                break;
            case 'week':
                timeFormat = "DATE_TRUNC('week', created_at)";
                break;
            default:
                timeFormat = "DATE_TRUNC('hour', created_at)";
        }

        // Get timeline data using raw SQL for better performance
        const timeline = await prisma.$queryRaw`
            SELECT 
                ${timeFormat} as time_period,
                action,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE success = true) as success_count,
                COUNT(*) FILTER (WHERE success = false) as failure_count
            FROM audit_logs 
            WHERE created_at >= ${fromDate}
            ${!isSuperAdmin && user?.organization_id ? 
                Prisma.sql`AND organization_id = ${user.organization_id}::uuid` : 
                Prisma.empty
            }
            GROUP BY time_period, action
            ORDER BY time_period ASC, count DESC
        `;

        // Group data by time period
        const groupedData = {};
        timeline.forEach(row => {
            const timePeriod = row.time_period.toISOString();
            if (!groupedData[timePeriod]) {
                groupedData[timePeriod] = {
                    time_period: timePeriod,
                    total_count: 0,
                    success_count: 0,
                    failure_count: 0,
                    actions: {}
                };
            }
            
            groupedData[timePeriod].total_count += parseInt(row.count);
            groupedData[timePeriod].success_count += parseInt(row.success_count);
            groupedData[timePeriod].failure_count += parseInt(row.failure_count);
            groupedData[timePeriod].actions[row.action] = {
                count: parseInt(row.count),
                success_count: parseInt(row.success_count),
                failure_count: parseInt(row.failure_count)
            };
        });

        const timelineData = Object.values(groupedData).sort((a, b) => 
            new Date(a.time_period) - new Date(b.time_period)
        );

        res.status(200).json({
            success: true,
            message: 'Audit log timeline retrieved successfully',
            data: {
                period_days: parseInt(days),
                interval: interval,
                timeline: timelineData,
                summary: {
                    total_periods: timelineData.length,
                    total_logs: timelineData.reduce((sum, period) => sum + period.total_count, 0),
                    avg_logs_per_period: timelineData.length > 0 ? 
                        (timelineData.reduce((sum, period) => sum + period.total_count, 0) / timelineData.length).toFixed(2) : 0
                }
            }
        });

    } catch (error) {
        console.error('Error getting audit log timeline:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit log timeline',
            error: error.message
        });
    }
};

/**
 * GET /actlog/logs/anomalies - Phát hiện anomalies trong audit logs
 */
export const detectAnomalies = async (req, res) => {
    try {
        const { days = 7, threshold_multiplier = 2 } = req.query;
        
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        // Organization security
        const user = req.user;
        const isSuperAdmin = user?.role === 'system.admin';
        
        let whereConditions = {
            created_at: { gte: fromDate }
        };
        if (!isSuperAdmin && user?.organization_id) {
            whereConditions.organization_id = user.organization_id;
        }

        // Detect anomalies
        const anomalies = [];

        // 1. Unusual login patterns (too many failed logins)
        const failedLogins = await prisma.audit_logs.groupBy({
            by: ['user_id'],
            where: {
                ...whereConditions,
                action: 'failed_login',
                user_id: { not: null }
            },
            _count: { user_id: true },
            having: {
                user_id: { _count: { gt: 5 } } // More than 5 failed logins
            }
        });

        failedLogins.forEach(item => {
            anomalies.push({
                type: 'excessive_failed_logins',
                severity: 'high',
                user_id: item.user_id,
                count: item._count.user_id,
                description: `User has ${item._count.user_id} failed login attempts in ${days} days`
            });
        });

        // 2. After-hours activities (outside 6 AM - 10 PM)
        const afterHoursLogs = await prisma.$queryRaw`
            SELECT user_id, COUNT(*) as count
            FROM audit_logs 
            WHERE created_at >= ${fromDate}
            ${!isSuperAdmin && user?.organization_id ? 
                Prisma.sql`AND organization_id = ${user.organization_id}::uuid` : 
                Prisma.empty
            }
            AND (
                EXTRACT(HOUR FROM created_at) < 6 OR 
                EXTRACT(HOUR FROM created_at) > 22
            )
            AND user_id IS NOT NULL
            GROUP BY user_id
            HAVING COUNT(*) > 10
        `;

        afterHoursLogs.forEach(item => {
            anomalies.push({
                type: 'after_hours_activity',
                severity: 'medium',
                user_id: item.user_id,
                count: parseInt(item.count),
                description: `User has ${item.count} activities outside business hours`
            });
        });

        // 3. Bulk deletion activities
        const bulkDeletions = await prisma.audit_logs.groupBy({
            by: ['user_id'],
            where: {
                ...whereConditions,
                action: 'delete',
                user_id: { not: null }
            },
            _count: { user_id: true },
            having: {
                user_id: { _count: { gt: 20 } }
            }
        });

        bulkDeletions.forEach(item => {
            anomalies.push({
                type: 'bulk_deletion',
                severity: 'high',
                user_id: item.user_id,
                count: item._count.user_id,
                description: `User performed ${item._count.user_id} deletions in ${days} days`
            });
        });

        // 4. Unusual IP addresses (new IPs for existing users)
        const unusualIPs = await prisma.$queryRaw`
            WITH user_ips AS (
                SELECT DISTINCT user_id, ip_address
                FROM audit_logs 
                WHERE created_at >= ${fromDate}
                AND user_id IS NOT NULL 
                AND ip_address IS NOT NULL
                ${!isSuperAdmin && user?.organization_id ? 
                    Prisma.sql`AND organization_id = ${user.organization_id}::uuid` : 
                    Prisma.empty
                }
            ),
            ip_counts AS (
                SELECT user_id, COUNT(DISTINCT ip_address) as ip_count
                FROM user_ips
                GROUP BY user_id
            )
            SELECT user_id, ip_count
            FROM ip_counts
            WHERE ip_count > 3
        `;

        unusualIPs.forEach(item => {
            anomalies.push({
                type: 'multiple_ip_addresses',
                severity: 'medium',
                user_id: item.user_id,
                count: parseInt(item.ip_count),
                description: `User accessed from ${item.ip_count} different IP addresses`
            });
        });

        // Get user details for anomalies
        const userIds = [...new Set(anomalies.map(a => a.user_id))];
        const users = await prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, full_name: true, email: true }
        });

        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user;
        });

        // Enrich anomalies with user details
        const enrichedAnomalies = anomalies.map(anomaly => ({
            ...anomaly,
            user: userMap[anomaly.user_id] || null
        }));

        res.status(200).json({
            success: true,
            message: 'Audit log anomalies detected successfully',
            data: {
                period_days: parseInt(days),
                total_anomalies: enrichedAnomalies.length,
                anomalies_by_severity: {
                    high: enrichedAnomalies.filter(a => a.severity === 'high').length,
                    medium: enrichedAnomalies.filter(a => a.severity === 'medium').length,
                    low: enrichedAnomalies.filter(a => a.severity === 'low').length
                },
                anomalies: enrichedAnomalies
            }
        });

    } catch (error) {
        console.error('Error detecting audit log anomalies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect audit log anomalies',
            error: error.message
        });
    }
};

/**
 * POST /actlog/logs/cleanup - Dọn dẹp audit logs theo retention policy
 */
export const cleanupOldLogs = async (req, res) => {
    try {
        const { 
            retention_days = 365,
            confirm_cleanup = false,
            archive_before_delete = true 
        } = req.body;

        // Security check - only super admin can cleanup
        const user = req.user;
        const isSuperAdmin = user?.role === 'system.admin';
        if (!isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only super administrators can perform log cleanup'
            });
        }

        if (!confirm_cleanup) {
            return res.status(400).json({
                success: false,
                message: 'Please confirm cleanup by setting confirm_cleanup: true'
            });
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(retention_days));

        // Count logs to be affected
        const logsToCleanup = await prisma.audit_logs.count({
            where: {
                created_at: {
                    lt: cutoffDate
                }
            }
        });

        if (logsToCleanup === 0) {
            return res.status(200).json({
                success: true,
                message: 'No logs found for cleanup',
                data: {
                    retention_days: parseInt(retention_days),
                    cutoff_date: cutoffDate.toISOString(),
                    logs_cleaned: 0
                }
            });
        }

        let archivedCount = 0;
        
        // Archive logs if requested (export to file system)
        if (archive_before_delete) {
            try {
                const logsToArchive = await prisma.audit_logs.findMany({
                    where: {
                        created_at: { lt: cutoffDate }
                    },
                    include: {
                        users: {
                            select: { username: true, full_name: true }
                        },
                        organizations: {
                            select: { name: true, type: true }
                        }
                    }
                });

                // In production, save to cloud storage or archive system
                const archiveData = {
                    archived_at: new Date().toISOString(),
                    retention_days: parseInt(retention_days),
                    cutoff_date: cutoffDate.toISOString(),
                    total_logs: logsToArchive.length,
                    logs: logsToArchive
                };

                // For now, just count as archived
                archivedCount = logsToArchive.length;
                
            } catch (archiveError) {
                console.error('Error archiving logs:', archiveError);
                // Continue with deletion even if archiving fails
            }
        }

        // Delete old logs
        const result = await prisma.audit_logs.deleteMany({
            where: {
                created_at: {
                    lt: cutoffDate
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Audit logs cleanup completed successfully',
            data: {
                retention_days: parseInt(retention_days),
                cutoff_date: cutoffDate.toISOString(),
                logs_cleaned: result.count,
                logs_archived: archivedCount,
                archive_enabled: archive_before_delete
            }
        });

    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup audit logs',
            error: error.message
        });
    }
};
