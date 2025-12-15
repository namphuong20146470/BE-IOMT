// features/maintenance/maintenance.repository.js
import prisma from '../../config/db.js';

/**
 * Maintenance History Repository - Database operations
 */

class MaintenanceRepository {
    /**
     * Create maintenance log with transaction
     */
    async create(data) {
        return prisma.maintenance_history.create({
            data: {
                ...data,
                created_at: new Date(),
                updated_at: new Date()
            },
            include: {
                device: {
                    select: {
                        id: true,
                        serial_number: true,
                        model: {
                            select: {
                                id: true,
                                name: true,
                                manufacturer_id: true
                            }
                        }
                    }
                },
                performer: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true
                    }
                },
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Find maintenance log by ID
     */
    async findById(id, options = {}) {
        const { include_jobs = false, include_parts = false } = options;
        
        return prisma.maintenance_history.findUnique({
            where: { id },
            include: {
                device: {
                    select: {
                        id: true,
                        serial_number: true,
                        asset_tag: true,
                        status: true,
                        model: {
                            select: {
                                name: true,
                                model_number: true,
                                manufacturer_id: true
                            }
                        },
                        device_data_latest: true
                    }
                },
                performer: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        phone: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        full_name: true
                    }
                },
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                ...(include_parts && {
                    parts: {
                        orderBy: { created_at: 'asc' }
                    }
                })
            }
        });
    }

    /**
     * Find all maintenance logs with filters
     */
    async findMany(filters = {}, pagination = {}) {
        const {
            device_id,
            organization_id,
            department_id,
            performed_by,
            maintenance_type,
            status,
            severity,
            start_date,
            end_date,
            search
        } = filters;

        const {
            page = 1,
            limit = 20,
            sort_by = 'performed_date',
            sort_order = 'desc',
            include_jobs = false,
            include_parts = false
        } = pagination;

        const skip = (page - 1) * limit;

        // Build where clause
        const where = {
            ...(device_id && { device_id }),
            ...(organization_id && { organization_id }),
            ...(department_id && { department_id }),
            ...(performed_by && { performed_by }),
            ...(maintenance_type && { maintenance_type }),
            ...(status && { status }),
            ...(severity && { severity }),
            ...(start_date && end_date && {
                performed_date: {
                    gte: new Date(start_date),
                    lte: new Date(end_date)
                }
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { ticket_number: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        const [data, total] = await Promise.all([
            prisma.maintenance_history.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sort_by]: sort_order },
                include: {
                    device: {
                        select: {
                            id: true,
                            serial_number: true,
                            model: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    },
                    performer: {
                        select: {
                            full_name: true
                        }
                    },
                    organization: {
                        select: {
                            name: true
                        }
                    },
                    ...(include_parts && {
                        parts: true
                    })
                }
            }),
            prisma.maintenance_history.count({ where })
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Update maintenance log
     */
    async update(id, data) {
        return prisma.maintenance_history.update({
            where: { id },
            data: {
                ...data,
                updated_at: new Date()
            },
            include: {
                device: true,
                performer: true,
                parts: true
            }
        });
    }

    /**
     * Delete maintenance log
     */
    async delete(id) {
        return prisma.maintenance_history.delete({
            where: { id }
        });
    }

    /**
     * Get maintenance statistics
     */
    async getStatistics(filters = {}) {
        const { organization_id, start_date, end_date } = filters;

        const where = {
            ...(organization_id && { organization_id }),
            ...(start_date && end_date && {
                performed_date: {
                    gte: new Date(start_date),
                    lte: new Date(end_date)
                }
            })
        };

        const [
            total,
            byType,
            byStatus,
            bySeverity,
            avgDuration,
            totalCost
        ] = await Promise.all([
            prisma.maintenance_history.count({ where }),
            
            prisma.maintenance_history.groupBy({
                by: ['maintenance_type'],
                where,
                _count: true
            }),
            
            prisma.maintenance_history.groupBy({
                by: ['status'],
                where,
                _count: true
            }),
            
            prisma.maintenance_history.groupBy({
                by: ['severity'],
                where,
                _count: true
            }),
            
            prisma.maintenance_history.aggregate({
                where,
                _avg: { duration_minutes: true }
            }),
            
            prisma.maintenance_history.aggregate({
                where,
                _sum: { cost: true }
            })
        ]);

        return {
            total,
            by_type: byType.map(item => ({
                type: item.maintenance_type,
                count: item._count
            })),
            by_status: byStatus.map(item => ({
                status: item.status,
                count: item._count
            })),
            by_severity: bySeverity.map(item => ({
                severity: item.severity,
                count: item._count
            })),
            average_duration_minutes: avgDuration._avg.duration_minutes || 0,
            total_cost: totalCost._sum.cost || 0
        };
    }

    /**
     * Get recent maintenance for device
     */
    async getDeviceMaintenanceHistory(deviceId, limit = 10) {
        return prisma.maintenance_history.findMany({
            where: { device_id: deviceId },
            take: limit,
            orderBy: { performed_date: 'desc' },
            include: {
                performer: {
                    select: {
                        full_name: true
                    }
                },
                parts: true
            }
        });
    }

    /**
     * Create maintenance job
     */
    async createJob(jobData) {
        console.log('📦 Repository creating job with data:', {
            before_metrics: jobData.before_metrics,
            after_metrics: jobData.after_metrics,
            before_type: typeof jobData.before_metrics,
            after_type: typeof jobData.after_metrics
        });
        
        const result = await prisma.maintenance_jobs.create({
            data: {
                maintenance_id: jobData.maintenance_id,
                job_number: jobData.job_number,
                name: jobData.name,
                category: jobData.category,
                description: jobData.description,
                before_metrics: jobData.before_metrics,
                after_metrics: jobData.after_metrics,
                start_time: jobData.start_time ? new Date(jobData.start_time) : null,
                end_time: jobData.end_time ? new Date(jobData.end_time) : null,
                duration_minutes: jobData.duration_minutes,
                status: jobData.status,
                result: jobData.result,
                notes: jobData.notes,
                issues_found: jobData.issues_found,
                actions_taken: jobData.actions_taken,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        
        console.log('✅ Job created in DB:', {
            id: result.id,
            before_metrics: result.before_metrics,
            after_metrics: result.after_metrics
        });
        
        return result;
    }

    /**
     * Get jobs for maintenance log
     */
    async getMaintenanceJobs(maintenanceId) {
        return prisma.maintenance_jobs.findMany({
            where: { maintenance_id: maintenanceId },
            orderBy: { job_number: 'asc' }
        });
    }

    /**
     * Get maintenance job by ID
     */
    async getJobById(jobId) {
        return prisma.maintenance_jobs.findUnique({
            where: { id: jobId }
        });
    }

    /**
     * Update maintenance job
     */
    async updateJob(jobId, data) {
        const updateData = {
            updated_at: new Date()
        };

        // Add fields if provided
        if (data.before_metrics !== undefined) {
            updateData.before_metrics = data.before_metrics;
        }
        if (data.after_metrics !== undefined) {
            updateData.after_metrics = data.after_metrics;
        }
        if (data.status) {
            updateData.status = data.status;
        }
        if (data.result) {
            updateData.result = data.result;
        }
        if (data.start_time) {
            updateData.start_time = new Date(data.start_time);
        }
        if (data.end_time) {
            updateData.end_time = new Date(data.end_time);
        }
        if (data.duration_minutes !== undefined) {
            updateData.duration_minutes = data.duration_minutes;
        }
        if (data.notes !== undefined) {
            updateData.notes = data.notes;
        }
        if (data.issues_found !== undefined) {
            updateData.issues_found = data.issues_found;
        }
        if (data.actions_taken !== undefined) {
            updateData.actions_taken = data.actions_taken;
        }

        return prisma.maintenance_jobs.update({
            where: { id: jobId },
            data: updateData
        });
    }
}

export default new MaintenanceRepository();
