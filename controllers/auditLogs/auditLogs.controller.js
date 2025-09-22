import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// AUDIT LOGS CONTROLLER
// ==========================================

/**
 * GET /actlog/logs - Lấy tất cả audit logs
 * Query params:
 * - page: số trang (default: 1)
 * - limit: số record trên 1 trang (default: 50)
 * - user_id: filter theo user
 * - action: filter theo action
 * - resource_type: filter theo resource type
 * - success: filter theo success status (true/false)
 * - from_date: từ ngày (YYYY-MM-DD)
 * - to_date: đến ngày (YYYY-MM-DD)
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
            search
        } = req.query;

        // Tính offset cho pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build where conditions
        const whereConditions = {};

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
            take: parseInt(limit)
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        res.status(200).json({
            success: true,
            message: 'Audit logs retrieved successfully',
            data: {
                logs,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_count: totalCount,
                    per_page: parseInt(limit),
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage
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

        // Get request metadata
        const ip_address = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
        const user_agent = req.get('User-Agent') || 'Unknown';

        const log = await prisma.audit_logs.create({
            data: {
                user_id: user_id || null,
                organization_id: organization_id || null,
                action,
                resource_type: resource_type || null,
                resource_id: resource_id || null,
                old_values: old_values || null,
                new_values: new_values || null,
                ip_address,
                user_agent,
                success,
                error_message: error_message || null
            },
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
