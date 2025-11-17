// features/departments/departments.controller.js
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Get all departments with filtering and pagination
 */
export const getAllDepartments = async (req, res) => {
    try {
        const { page = 1, limit = 20, organization_id, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const userId = req.user.id;

        // Get user's organization if not specified and user doesn't have system-wide permissions
        let orgFilter = {};
        if (organization_id) {
            orgFilter.organizationId = organization_id;
        } else {
            // If user is not super admin, filter by their organization
            if (!req.user.permissions?.includes('system.admin')) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { organizationId: true }
                });
                if (user?.organizationId) {
                    orgFilter.organizationId = user.organizationId;
                }
            }
        }

        // Build where clause
        const where = { ...orgFilter };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get departments with counts
        const [departments, total] = await Promise.all([
            prisma.departments.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    organization: {
                        select: { id: true, name: true, type: true }
                    },
                    _count: {
                        select: {
                            users: true,
                            devices: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.departments.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: departments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch departments',
            error: error.message
        });
    }
};

/**
 * Get department by ID
 */
export const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const department = await prisma.departments.findUnique({
            where: { id },
            include: {
                organization: {
                    select: { id: true, name: true, type: true }
                },
                users: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        email: true,
                        roleId: true
                    }
                },
                devices: {
                    select: {
                        id: true,
                        deviceCode: true,
                        serialNumber: true,
                        status: true,
                        location: true
                    }
                },
                _count: {
                    select: {
                        users: true,
                        devices: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Check if user has access to this department's organization
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== department.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Department belongs to different organization'
            });
        }

        return res.status(200).json({
            success: true,
            data: department
        });
    } catch (error) {
        console.error('Error fetching department:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch department',
            error: error.message
        });
    }
};

/**
 * Get departments by organization ID
 */
export const getDepartmentsByOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { page = 1, limit = 50, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check if user has access to this organization
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot access departments from different organization'
            });
        }

        // Build where clause
        const where = { organizationId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [departments, total] = await Promise.all([
            prisma.departments.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    _count: {
                        select: {
                            users: true,
                            devices: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.departments.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: departments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching departments by organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch departments',
            error: error.message
        });
    }
};

/**
 * Create new department
 */
export const createDepartment = async (req, res) => {
    try {
        const { organization_id, name, code, description } = req.body;

        // Check if organization exists and user has access
        const organization = await prisma.organizations.findUnique({
            where: { id: organization_id }
        });

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check permissions for organization
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== organization_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot create departments in different organization'
            });
        }

        // Check if department code already exists within the organization
        const existingDept = await prisma.departments.findFirst({
            where: { 
                code,
                organizationId: organization_id
            }
        });

        if (existingDept) {
            return res.status(409).json({
                success: false,
                message: 'Department code already exists in this organization'
            });
        }

        const department = await prisma.departments.create({
            data: {
                organizationId: organization_id,
                name,
                code,
                description
            },
            include: {
                organization: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        return res.status(201).json({
            success: true,
            data: department,
            message: 'Department created successfully'
        });
    } catch (error) {
        console.error('Error creating department:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create department',
            error: error.message
        });
    }
};

/**
 * Update department
 */
export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description } = req.body;

        // Check if department exists
        const existingDept = await prisma.departments.findUnique({
            where: { id },
            include: { organization: true }
        });

        if (!existingDept) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Check permissions
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== existingDept.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Department belongs to different organization'
            });
        }

        // Check if new code conflicts with other departments in the same organization
        if (code && code !== existingDept.code) {
            const codeConflict = await prisma.departments.findFirst({
                where: { 
                    code,
                    organizationId: existingDept.organizationId,
                    id: { not: id }
                }
            });

            if (codeConflict) {
                return res.status(409).json({
                    success: false,
                    message: 'Department code already exists in this organization'
                });
            }
        }

        const updatedDepartment = await prisma.departments.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(code && { code }),
                ...(description !== undefined && { description })
            },
            include: {
                organization: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: updatedDepartment,
            message: 'Department updated successfully'
        });
    } catch (error) {
        console.error('Error updating department:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update department',
            error: error.message
        });
    }
};

/**
 * Delete department
 */
export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if department exists and has dependencies
        const department = await prisma.departments.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        devices: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Check permissions
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== department.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Department belongs to different organization'
            });
        }

        // Check for dependencies
        const { users, devices } = department._count;
        if (users > 0 || devices > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete department. It has ${users} users and ${devices} devices.`,
                dependencies: { users, devices }
            });
        }

        await prisma.departments.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: 'Department deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting department:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete department',
            error: error.message
        });
    }
};

/**
 * Get department statistics
 */
export const getDepartmentStatistics = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if department exists and user has access
        const department = await prisma.departments.findUnique({
            where: { id }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== department.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Department belongs to different organization'
            });
        }

        // Get comprehensive statistics
        const [userStats, deviceStats, recentUsers, recentDevices] = await Promise.all([
            // User statistics by role
            prisma.user.groupBy({
                by: ['roleId'],
                where: { departmentId: id },
                _count: { id: true }
            }),
            
            // Device statistics by status
            prisma.device.groupBy({
                by: ['status'],
                where: { departmentId: id },
                _count: { id: true }
            }),
            
            // Users added in last 30 days
            prisma.user.count({
                where: {
                    departmentId: id,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
            
            // Devices added in last 30 days
            prisma.device.count({
                where: {
                    departmentId: id,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);

        const statistics = {
            department: {
                id: department.id,
                name: department.name,
                code: department.code
            },
            users: {
                total: userStats.reduce((sum, stat) => sum + stat._count.id, 0),
                by_role: userStats,
                added_last_30_days: recentUsers
            },
            devices: {
                total: deviceStats.reduce((sum, stat) => sum + stat._count.id, 0),
                by_status: deviceStats,
                added_last_30_days: recentDevices
            }
        };

        return res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error fetching department statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch department statistics',
            error: error.message
        });
    }
};

/**
 * Get all department statistics for an organization
 */
export const getOrganizationDepartmentStatistics = async (req, res) => {
    try {
        const { organizationId } = req.params;

        // Check permissions
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organizationId !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot access statistics from different organization'
            });
        }

        // Get department statistics
        const departments = await prisma.departments.findMany({
            where: { organizationId },
            include: {
                _count: {
                    select: {
                        users: true,
                        devices: true
                    }
                }
            }
        });

        const statistics = departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            code: dept.code,
            users_count: dept._count.users,
            devices_count: dept._count.devices
        }));

        return res.status(200).json({
            success: true,
            data: {
                organization_id: organizationId,
                departments: statistics,
                totals: {
                    users: statistics.reduce((sum, dept) => sum + dept.users_count, 0),
                    devices: statistics.reduce((sum, dept) => sum + dept.devices_count, 0)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching organization department statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch department statistics',
            error: error.message
        });
    }
};
