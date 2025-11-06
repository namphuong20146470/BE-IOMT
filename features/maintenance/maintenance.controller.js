// features/maintenance/maintenance.controller.js
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ====================================================================
// MAINTENANCE SCHEDULES CONTROLLERS
// ====================================================================

/**
 * Get maintenance schedules with filtering and pagination
 */
export const getMaintenanceSchedules = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            device_id, 
            maintenance_type, 
            status, 
            organization_id,
            start_date,
            end_date 
        } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause with organization filtering
        const where = {};
        
        // Organization filter based on user permissions
        if (!req.user.permissions?.includes('system.admin')) {
            where.device = {
                organizationId: req.user.organizationId
            };
        } else if (organization_id) {
            where.device = {
                organizationId: organization_id
            };
        }

        // Additional filters
        if (device_id) where.deviceId = device_id;
        if (maintenance_type) where.maintenanceType = maintenance_type;
        if (status) where.status = status;
        
        if (start_date || end_date) {
            where.scheduledDate = {};
            if (start_date) where.scheduledDate.gte = new Date(start_date);
            if (end_date) where.scheduledDate.lte = new Date(end_date);
        }

        const [schedules, total] = await Promise.all([
            prisma.maintenanceSchedule.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    device: {
                        select: {
                            id: true,
                            deviceCode: true,
                            serialNumber: true,
                            location: true,
                            status: true,
                            organization: {
                                select: { id: true, name: true }
                            },
                            department: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            username: true,
                            fullName: true,
                            email: true
                        }
                    }
                },
                orderBy: { scheduledDate: 'asc' }
            }),
            prisma.maintenanceSchedule.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: schedules,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance schedules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance schedules',
            error: error.message
        });
    }
};

/**
 * Get maintenance schedule by ID
 */
export const getMaintenanceScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: {
                device: {
                    include: {
                        organization: true,
                        department: true,
                        model: {
                            include: { category: true }
                        }
                    }
                },
                assignedTo: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        email: true
                    }
                },
                records: {
                    orderBy: { performedDate: 'desc' },
                    take: 5
                }
            }
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance schedule not found'
            });
        }

        // Check organization access
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== schedule.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Schedule belongs to different organization'
            });
        }

        return res.status(200).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Error fetching maintenance schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance schedule',
            error: error.message
        });
    }
};

/**
 * Get schedules for specific device
 */
export const getSchedulesByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { page = 1, limit = 10, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check if device exists and user has access
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
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        const where = { deviceId };
        if (status) where.status = status;

        const [schedules, total] = await Promise.all([
            prisma.maintenanceSchedule.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    assignedTo: {
                        select: {
                            id: true,
                            username: true,
                            fullName: true
                        }
                    }
                },
                orderBy: { scheduledDate: 'desc' }
            }),
            prisma.maintenanceSchedule.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: schedules,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching device schedules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device schedules',
            error: error.message
        });
    }
};

/**
 * Get upcoming maintenance schedules (next 30 days)
 */
export const getUpcomingSchedules = async (req, res) => {
    try {
        const { limit = 20, days = 30 } = req.query;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(days));

        const where = {
            scheduledDate: {
                gte: new Date(),
                lte: endDate
            },
            status: 'pending'
        };

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            where.device = {
                organizationId: req.user.organizationId
            };
        }

        const schedules = await prisma.maintenanceSchedule.findMany({
            where,
            take: parseInt(limit),
            include: {
                device: {
                    select: {
                        id: true,
                        deviceCode: true,
                        serialNumber: true,
                        location: true,
                        organization: {
                            select: { name: true }
                        }
                    }
                },
                assignedTo: {
                    select: {
                        fullName: true,
                        email: true
                    }
                }
            },
            orderBy: { scheduledDate: 'asc' }
        });

        return res.status(200).json({
            success: true,
            data: schedules,
            count: schedules.length
        });
    } catch (error) {
        console.error('Error fetching upcoming schedules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming schedules',
            error: error.message
        });
    }
};

/**
 * Get overdue maintenance schedules
 */
export const getOverdueSchedules = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const where = {
            scheduledDate: {
                lt: new Date()
            },
            status: 'pending'
        };

        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            where.device = {
                organizationId: req.user.organizationId
            };
        }

        const schedules = await prisma.maintenanceSchedule.findMany({
            where,
            take: parseInt(limit),
            include: {
                device: {
                    select: {
                        id: true,
                        deviceCode: true,
                        serialNumber: true,
                        location: true,
                        organization: {
                            select: { name: true }
                        }
                    }
                },
                assignedTo: {
                    select: {
                        fullName: true,
                        email: true
                    }
                }
            },
            orderBy: { scheduledDate: 'asc' }
        });

        return res.status(200).json({
            success: true,
            data: schedules,
            count: schedules.length
        });
    } catch (error) {
        console.error('Error fetching overdue schedules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch overdue schedules',
            error: error.message
        });
    }
};

/**
 * Create new maintenance schedule
 */
export const createMaintenanceSchedule = async (req, res) => {
    try {
        const { 
            device_id, 
            maintenance_type, 
            scheduled_date, 
            frequency, 
            description, 
            assigned_to_id 
        } = req.body;

        // Check if device exists and user has access
        const device = await prisma.device.findUnique({
            where: { id: device_id },
            select: { organizationId: true }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        // Check if assigned user exists and belongs to same organization
        if (assigned_to_id) {
            const assignedUser = await prisma.user.findUnique({
                where: { id: assigned_to_id },
                select: { organizationId: true }
            });

            if (!assignedUser || assignedUser.organizationId !== device.organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned user must belong to the same organization as the device'
                });
            }
        }

        const schedule = await prisma.maintenanceSchedule.create({
            data: {
                deviceId: device_id,
                maintenanceType: maintenance_type,
                scheduledDate: new Date(scheduled_date),
                frequency,
                description,
                assignedToId: assigned_to_id,
                status: 'pending',
                createdById: req.user.id
            },
            include: {
                device: {
                    select: {
                        deviceCode: true,
                        serialNumber: true
                    }
                },
                assignedTo: {
                    select: {
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            data: schedule,
            message: 'Maintenance schedule created successfully'
        });
    } catch (error) {
        console.error('Error creating maintenance schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create maintenance schedule',
            error: error.message
        });
    }
};

/**
 * Update maintenance schedule
 */
export const updateMaintenanceSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            maintenance_type, 
            scheduled_date, 
            frequency, 
            description, 
            assigned_to_id,
            status 
        } = req.body;

        // Check if schedule exists and user has access
        const existingSchedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: {
                device: {
                    select: { organizationId: true }
                }
            }
        });

        if (!existingSchedule) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance schedule not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== existingSchedule.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Schedule belongs to different organization'
            });
        }

        const updateData = {};
        if (maintenance_type) updateData.maintenanceType = maintenance_type;
        if (scheduled_date) updateData.scheduledDate = new Date(scheduled_date);
        if (frequency !== undefined) updateData.frequency = frequency;
        if (description !== undefined) updateData.description = description;
        if (assigned_to_id !== undefined) updateData.assignedToId = assigned_to_id;
        if (status) updateData.status = status;

        const updatedSchedule = await prisma.maintenanceSchedule.update({
            where: { id },
            data: updateData,
            include: {
                device: {
                    select: {
                        deviceCode: true,
                        serialNumber: true
                    }
                },
                assignedTo: {
                    select: {
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: updatedSchedule,
            message: 'Maintenance schedule updated successfully'
        });
    } catch (error) {
        console.error('Error updating maintenance schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update maintenance schedule',
            error: error.message
        });
    }
};

/**
 * Delete maintenance schedule
 */
export const deleteMaintenanceSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if schedule exists and user has access
        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: {
                device: {
                    select: { organizationId: true }
                },
                _count: {
                    select: { records: true }
                }
            }
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance schedule not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== schedule.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Schedule belongs to different organization'
            });
        }

        // Check if schedule has maintenance records
        if (schedule._count.records > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete schedule with existing maintenance records'
            });
        }

        await prisma.maintenanceSchedule.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: 'Maintenance schedule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting maintenance schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete maintenance schedule',
            error: error.message
        });
    }
};

/**
 * Complete maintenance schedule and create record
 */
export const completeMaintenanceSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, cost, notes } = req.body;

        // Check if schedule exists and is pending
        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: {
                device: {
                    select: { organizationId: true }
                }
            }
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance schedule not found'
            });
        }

        if (schedule.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending schedules can be completed'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== schedule.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Schedule belongs to different organization'
            });
        }

        // Use transaction to update schedule and create record
        const result = await prisma.$transaction(async (tx) => {
            // Update schedule to completed
            const updatedSchedule = await tx.maintenanceSchedule.update({
                where: { id },
                data: {
                    status: 'completed',
                    completedDate: new Date(),
                    completedById: req.user.id
                }
            });

            // Create maintenance record
            const record = await tx.maintenanceRecord.create({
                data: {
                    deviceId: schedule.deviceId,
                    scheduleId: id,
                    maintenanceType: schedule.maintenanceType,
                    performedDate: new Date(),
                    description: description || schedule.description,
                    cost: cost || 0,
                    notes,
                    performedById: req.user.id
                }
            });

            return { schedule: updatedSchedule, record };
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Maintenance schedule completed successfully'
        });
    } catch (error) {
        console.error('Error completing maintenance schedule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to complete maintenance schedule',
            error: error.message
        });
    }
};

// ====================================================================
// MAINTENANCE RECORDS CONTROLLERS
// ====================================================================

/**
 * Get maintenance records with filtering and pagination
 */
export const getMaintenanceRecords = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            device_id, 
            maintenance_type, 
            organization_id,
            start_date,
            end_date 
        } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};
        
        // Organization filter
        if (!req.user.permissions?.includes('system.admin')) {
            where.device = {
                organizationId: req.user.organizationId
            };
        } else if (organization_id) {
            where.device = {
                organizationId: organization_id
            };
        }

        // Additional filters
        if (device_id) where.deviceId = device_id;
        if (maintenance_type) where.maintenanceType = maintenance_type;
        
        if (start_date || end_date) {
            where.performedDate = {};
            if (start_date) where.performedDate.gte = new Date(start_date);
            if (end_date) where.performedDate.lte = new Date(end_date);
        }

        const [records, total] = await Promise.all([
            prisma.maintenanceRecord.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    device: {
                        select: {
                            id: true,
                            deviceCode: true,
                            serialNumber: true,
                            location: true,
                            organization: {
                                select: { name: true }
                            }
                        }
                    },
                    performedBy: {
                        select: {
                            fullName: true,
                            email: true
                        }
                    },
                    schedule: {
                        select: {
                            id: true,
                            scheduledDate: true
                        }
                    }
                },
                orderBy: { performedDate: 'desc' }
            }),
            prisma.maintenanceRecord.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance records:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance records',
            error: error.message
        });
    }
};

/**
 * Get maintenance record by ID
 */
export const getMaintenanceRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await prisma.maintenanceRecord.findUnique({
            where: { id },
            include: {
                device: {
                    include: {
                        organization: true,
                        model: {
                            include: { category: true }
                        }
                    }
                },
                performedBy: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        email: true
                    }
                },
                schedule: true
            }
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        // Check organization access
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== record.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Record belongs to different organization'
            });
        }

        return res.status(200).json({
            success: true,
            data: record
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

/**
 * Get records for specific device
 */
export const getRecordsByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { page = 1, limit = 10, maintenance_type } = req.query;
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
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        const where = { deviceId };
        if (maintenance_type) where.maintenanceType = maintenance_type;

        const [records, total] = await Promise.all([
            prisma.maintenanceRecord.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    performedBy: {
                        select: {
                            fullName: true
                        }
                    }
                },
                orderBy: { performedDate: 'desc' }
            }),
            prisma.maintenanceRecord.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching device records:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch device records',
            error: error.message
        });
    }
};

/**
 * Create new maintenance record
 */
export const createMaintenanceRecord = async (req, res) => {
    try {
        const { 
            device_id, 
            schedule_id,
            maintenance_type, 
            performed_date,
            description, 
            cost,
            notes 
        } = req.body;

        // Check device access
        const device = await prisma.device.findUnique({
            where: { id: device_id },
            select: { organizationId: true }
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Device belongs to different organization'
            });
        }

        const record = await prisma.maintenanceRecord.create({
            data: {
                deviceId: device_id,
                scheduleId: schedule_id,
                maintenanceType: maintenance_type,
                performedDate: new Date(performed_date),
                description,
                cost: cost || 0,
                notes,
                performedById: req.user.id
            },
            include: {
                device: {
                    select: {
                        deviceCode: true,
                        serialNumber: true
                    }
                },
                performedBy: {
                    select: {
                        fullName: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            data: record,
            message: 'Maintenance record created successfully'
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

/**
 * Update maintenance record
 */
export const updateMaintenanceRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            maintenance_type, 
            performed_date,
            description, 
            cost,
            notes 
        } = req.body;

        // Check record access
        const existingRecord = await prisma.maintenanceRecord.findUnique({
            where: { id },
            include: {
                device: {
                    select: { organizationId: true }
                }
            }
        });

        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== existingRecord.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Record belongs to different organization'
            });
        }

        const updateData = {};
        if (maintenance_type) updateData.maintenanceType = maintenance_type;
        if (performed_date) updateData.performedDate = new Date(performed_date);
        if (description !== undefined) updateData.description = description;
        if (cost !== undefined) updateData.cost = cost;
        if (notes !== undefined) updateData.notes = notes;

        const updatedRecord = await prisma.maintenanceRecord.update({
            where: { id },
            data: updateData,
            include: {
                device: {
                    select: {
                        deviceCode: true,
                        serialNumber: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: updatedRecord,
            message: 'Maintenance record updated successfully'
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

/**
 * Delete maintenance record
 */
export const deleteMaintenanceRecord = async (req, res) => {
    try {
        const { id } = req.params;

        // Check record access
        const record = await prisma.maintenanceRecord.findUnique({
            where: { id },
            include: {
                device: {
                    select: { organizationId: true }
                }
            }
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== record.device.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Record belongs to different organization'
            });
        }

        await prisma.maintenanceRecord.delete({
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

// ====================================================================
// MAINTENANCE ANALYTICS & STATISTICS
// ====================================================================

/**
 * Get maintenance statistics
 */
export const getMaintenanceStatistics = async (req, res) => {
    try {
        const { organization_id, period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Organization filter
        const deviceFilter = {};
        if (!req.user.permissions?.includes('system.admin')) {
            deviceFilter.organizationId = req.user.organizationId;
        } else if (organization_id) {
            deviceFilter.organizationId = organization_id;
        }

        const [
            totalSchedules,
            pendingSchedules,
            overdueSchedules,
            completedSchedules,
            totalRecords,
            recentRecords,
            maintenanceTypes,
            costStats
        ] = await Promise.all([
            // Total schedules
            prisma.maintenanceSchedule.count({
                where: { device: deviceFilter }
            }),
            
            // Pending schedules
            prisma.maintenanceSchedule.count({
                where: { 
                    status: 'pending',
                    device: deviceFilter
                }
            }),
            
            // Overdue schedules
            prisma.maintenanceSchedule.count({
                where: { 
                    status: 'pending',
                    scheduledDate: { lt: new Date() },
                    device: deviceFilter
                }
            }),
            
            // Completed schedules in period
            prisma.maintenanceSchedule.count({
                where: { 
                    status: 'completed',
                    completedDate: { gte: startDate },
                    device: deviceFilter
                }
            }),
            
            // Total records
            prisma.maintenanceRecord.count({
                where: { device: deviceFilter }
            }),
            
            // Records in period
            prisma.maintenanceRecord.count({
                where: { 
                    performedDate: { gte: startDate },
                    device: deviceFilter
                }
            }),
            
            // Maintenance types breakdown
            prisma.maintenanceRecord.groupBy({
                by: ['maintenanceType'],
                where: { 
                    performedDate: { gte: startDate },
                    device: deviceFilter
                },
                _count: { id: true },
                _sum: { cost: true }
            }),
            
            // Cost statistics
            prisma.maintenanceRecord.aggregate({
                where: { 
                    performedDate: { gte: startDate },
                    device: deviceFilter
                },
                _sum: { cost: true },
                _avg: { cost: true },
                _count: { id: true }
            })
        ]);

        const statistics = {
            period: {
                days,
                start_date: startDate,
                end_date: new Date()
            },
            schedules: {
                total: totalSchedules,
                pending: pendingSchedules,
                overdue: overdueSchedules,
                completed_in_period: completedSchedules
            },
            records: {
                total: totalRecords,
                in_period: recentRecords
            },
            maintenance_types: maintenanceTypes,
            costs: {
                total_in_period: costStats._sum.cost || 0,
                average_cost: costStats._avg.cost || 0,
                total_activities: costStats._count
            }
        };

        return res.status(200).json({
            success: true,
            data: statistics
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

/**
 * Get maintenance cost analysis
 */
export const getMaintenanceCostAnalysis = async (req, res) => {
    try {
        const { organization_id, period = '365' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Organization filter
        const deviceFilter = {};
        if (!req.user.permissions?.includes('system.admin')) {
            deviceFilter.organizationId = req.user.organizationId;
        } else if (organization_id) {
            deviceFilter.organizationId = organization_id;
        }

        const [costByType, costByDevice, costByMonth] = await Promise.all([
            // Cost by maintenance type
            prisma.maintenanceRecord.groupBy({
                by: ['maintenanceType'],
                where: { 
                    performedDate: { gte: startDate },
                    device: deviceFilter
                },
                _sum: { cost: true },
                _count: { id: true }
            }),
            
            // Top 10 devices by cost
            prisma.$queryRaw`
                SELECT 
                    d.id,
                    d.device_code,
                    d.serial_number,
                    SUM(mr.cost) as total_cost,
                    COUNT(mr.id) as maintenance_count
                FROM maintenance_records mr
                JOIN devices d ON mr.device_id = d.id
                WHERE mr.performed_date >= ${startDate}
                ${!req.user.permissions?.includes('system.admin') && req.user.organizationId ? 
                    `AND d.organization_id = '${req.user.organizationId}'` : 
                    organization_id ? `AND d.organization_id = '${organization_id}'` : ''
                }
                GROUP BY d.id, d.device_code, d.serial_number
                ORDER BY total_cost DESC
                LIMIT 10
            `,
            
            // Cost by month (last 12 months)
            prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('month', mr.performed_date) as month,
                    SUM(mr.cost) as total_cost,
                    COUNT(mr.id) as maintenance_count
                FROM maintenance_records mr
                JOIN devices d ON mr.device_id = d.id
                WHERE mr.performed_date >= ${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)}
                ${!req.user.permissions?.includes('system.admin') && req.user.organizationId ? 
                    `AND d.organization_id = '${req.user.organizationId}'` : 
                    organization_id ? `AND d.organization_id = '${organization_id}'` : ''
                }
                GROUP BY DATE_TRUNC('month', mr.performed_date)
                ORDER BY month DESC
                LIMIT 12
            `
        ]);

        const analysis = {
            period: {
                days,
                start_date: startDate,
                end_date: new Date()
            },
            cost_by_type: costByType,
            top_devices_by_cost: costByDevice,
            monthly_trends: costByMonth,
            summary: {
                total_cost: costByType.reduce((sum, type) => sum + (type._sum.cost || 0), 0),
                total_activities: costByType.reduce((sum, type) => sum + type._count, 0)
            }
        };

        return res.status(200).json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error('Error fetching maintenance cost analysis:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance cost analysis',
            error: error.message
        });
    }
};