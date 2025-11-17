// features/organizations/organizations.controller.js
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Get all organizations with pagination and filtering
 */
export const getAllOrganizations = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};
        if (type) {
            where.type = type;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get organizations with user counts
        const [organizations, total] = await Promise.all([
            prisma.organizations.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    _count: {
                        select: {
                            users: true,
                            departments: true,
                            devices: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.organizations.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: organizations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch organizations',
            error: error.message
        });
    }
};

/**
 * Get organization by ID
 */
export const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;

        const organization = await prisma.organizations.findUnique({
            where: { id },
            include: {
                departments: {
                    include: {
                        _count: {
                            select: { devices: true, users: true }
                        }
                    }
                },
                _count: {
                    select: {
                        users: true,
                        departments: true,
                        devices: true
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: organization
        });
    } catch (error) {
        console.error('Error fetching organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch organization',
            error: error.message
        });
    }
};

/**
 * Get current user's organization
 */
export const getCurrentUserOrganization = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                organization: {
                    include: {
                        _count: {
                            select: {
                                users: true,
                                departments: true,
                                devices: true
                            }
                        }
                    }
                }
            }
        });

        if (!user || !user.organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found for current user'
            });
        }

        return res.status(200).json({
            success: true,
            data: user.organization
        });
    } catch (error) {
        console.error('Error fetching current user organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch organization',
            error: error.message
        });
    }
};

/**
 * Create new organization
 */
export const createOrganization = async (req, res) => {
    try {
        const { name, type, address, phone, email, description } = req.body;

        // Check if organization name already exists
        const existingOrg = await prisma.organizations.findFirst({
            where: { name }
        });

        if (existingOrg) {
            return res.status(409).json({
                success: false,
                message: 'Organization name already exists'
            });
        }

        const organization = await prisma.organizations.create({
            data: {
                name,
                type,
                address,
                phone,
                email,
                description
            }
        });

        return res.status(201).json({
            success: true,
            data: organization,
            message: 'Organization created successfully'
        });
    } catch (error) {
        console.error('Error creating organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create organization',
            error: error.message
        });
    }
};

/**
 * Update organization
 */
export const updateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, address, phone, email, description } = req.body;

        // Check if organization exists
        const existingOrg = await prisma.organizations.findUnique({
            where: { id }
        });

        if (!existingOrg) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check if new name conflicts with other organizations
        if (name && name !== existingOrg.name) {
            const nameConflict = await prisma.organizations.findFirst({
                where: { 
                    name,
                    id: { not: id }
                }
            });

            if (nameConflict) {
                return res.status(409).json({
                    success: false,
                    message: 'Organization name already exists'
                });
            }
        }

        const updatedOrganization = await prisma.organizations.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(type && { type }),
                ...(address !== undefined && { address }),
                ...(phone !== undefined && { phone }),
                ...(email !== undefined && { email }),
                ...(description !== undefined && { description })
            }
        });

        return res.status(200).json({
            success: true,
            data: updatedOrganization,
            message: 'Organization updated successfully'
        });
    } catch (error) {
        console.error('Error updating organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update organization',
            error: error.message
        });
    }
};

/**
 * Delete organization
 */
export const deleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if organization exists and has dependencies
        const organization = await prisma.organizations.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        departments: true,
                        devices: true
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check for dependencies
        const { users, departments, devices } = organization._count;
        if (users > 0 || departments > 0 || devices > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete organization. It has ${users} users, ${departments} departments, and ${devices} devices.`,
                dependencies: { users, departments, devices }
            });
        }

        await prisma.organizations.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: 'Organization deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete organization',
            error: error.message
        });
    }
};

/**
 * Get organization statistics
 */
export const getOrganizationStatistics = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if organization exists
        const organization = await prisma.organizations.findUnique({
            where: { id }
        });

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Get comprehensive statistics
        const [userStats, deviceStats, departmentStats, recentActivity] = await Promise.all([
            // User statistics
            prisma.user.groupBy({
                by: ['roleId'],
                where: { organizationId: id },
                _count: { id: true }
            }),
            
            // Device statistics by status
            prisma.device.groupBy({
                by: ['status'],
                where: { organizationId: id },
                _count: { id: true }
            }),
            
            // Department count
            prisma.department.count({
                where: { organizationId: id }
            }),
            
            // Recent devices added (last 30 days)
            prisma.device.count({
                where: {
                    organizationId: id,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);

        const statistics = {
            organization: {
                id: organization.id,
                name: organization.name,
                type: organization.type
            },
            users: {
                total: userStats.reduce((sum, stat) => sum + stat._count.id, 0),
                by_role: userStats
            },
            devices: {
                total: deviceStats.reduce((sum, stat) => sum + stat._count.id, 0),
                by_status: deviceStats
            },
            departments: {
                total: departmentStats
            },
            activity: {
                devices_added_last_30_days: recentActivity
            }
        };

        return res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error fetching organization statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch organization statistics',
            error: error.message
        });
    }
};
