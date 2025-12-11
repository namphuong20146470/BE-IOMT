/**
 * Permission Groups Service
 * Business logic for permission group management
 */

import prisma from '../../config/db.js';
import { AppError } from '../../shared/utils/errorHandler.js';

class PermissionGroupService {
    /**
     * Get all permission groups with permissions count
     */
    async getAllPermissionGroups(queryParams = {}, user) {
        try {
            const {
                include_permissions = 'false',
                is_active,
                page = 1,
                limit = 50
            } = queryParams;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const where = {};
            if (is_active !== undefined) {
                where.is_active = is_active === 'true';
            }

            // Get groups with permission count
            const groups = await prisma.permission_groups.findMany({
                where,
                orderBy: { sort_order: 'asc' },
                skip,
                take: parseInt(limit),
                include: {
                    permissions: include_permissions === 'true' ? {
                        orderBy: { name: 'asc' },
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            resource: true,
                            action: true,
                            scope: true
                        }
                    } : {
                        select: { id: true }
                    }
                }
            });

            // Transform data to include counts
            const transformedGroups = groups.map(group => ({
                id: group.id,
                name: group.name,
                description: group.description,
                color: group.color,
                icon: group.icon,
                sort_order: group.sort_order,
                is_active: group.is_active,
                created_at: group.created_at,
                updated_at: group.updated_at,
                permission_count: group.permissions.length,
                ...(include_permissions === 'true' && {
                    permissions: group.permissions
                })
            }));

            const total = await prisma.permission_groups.count({ where });

            return {
                success: true,
                message: 'Permission groups retrieved successfully',
                data: transformedGroups,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    total_pages: Math.ceil(total / parseInt(limit))
                }
            };
        } catch (error) {
            console.error('Error in getAllPermissionGroups:', error);
            throw new AppError(error.message, 500);
        }
    }

    /**
     * Get permission group by ID
     */
    async getPermissionGroupById(groupId, user, options = {}) {
        try {
            const { includePermissions = true } = options;

            const group = await prisma.permission_groups.findUnique({
                where: { id: groupId },
                include: {
                    permissions: includePermissions ? {
                        orderBy: [
                            { resource: 'asc' },
                            { action: 'asc' }
                        ],
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            resource: true,
                            action: true,
                            scope: true,
                            priority: true,
                            created_at: true
                        }
                    } : {
                        select: { id: true }
                    }
                }
            });

            if (!group) {
                throw new AppError('Permission group not found', 404);
            }

            return {
                success: true,
                message: 'Permission group retrieved successfully',
                data: {
                    ...group,
                    permission_count: group.permissions.length
                }
            };
        } catch (error) {
            console.error('Error in getPermissionGroupById:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Create new permission group
     */
    async createPermissionGroup(groupData, user) {
        try {
            const { name, description, color, icon, sort_order, is_active = true } = groupData;

            // Check if name already exists
            const existing = await prisma.permission_groups.findUnique({
                where: { name }
            });

            if (existing) {
                throw new AppError('Permission group with this name already exists', 400);
            }

            const newGroup = await prisma.permission_groups.create({
                data: {
                    name,
                    description,
                    color,
                    icon,
                    sort_order: sort_order || 0,
                    is_active
                }
            });

            return {
                success: true,
                message: 'Permission group created successfully',
                data: newGroup
            };
        } catch (error) {
            console.error('Error in createPermissionGroup:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Update permission group
     */
    async updatePermissionGroup(groupId, updateData, user) {
        try {
            // Check if group exists
            const existing = await prisma.permission_groups.findUnique({
                where: { id: groupId }
            });

            if (!existing) {
                throw new AppError('Permission group not found', 404);
            }

            // If updating name, check uniqueness
            if (updateData.name && updateData.name !== existing.name) {
                const nameExists = await prisma.permission_groups.findUnique({
                    where: { name: updateData.name }
                });

                if (nameExists) {
                    throw new AppError('Permission group with this name already exists', 400);
                }
            }

            const updated = await prisma.permission_groups.update({
                where: { id: groupId },
                data: {
                    ...(updateData.name && { name: updateData.name }),
                    ...(updateData.description !== undefined && { description: updateData.description }),
                    ...(updateData.color && { color: updateData.color }),
                    ...(updateData.icon && { icon: updateData.icon }),
                    ...(updateData.sort_order !== undefined && { sort_order: updateData.sort_order }),
                    ...(updateData.is_active !== undefined && { is_active: updateData.is_active })
                }
            });

            return {
                success: true,
                message: 'Permission group updated successfully',
                data: updated
            };
        } catch (error) {
            console.error('Error in updatePermissionGroup:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Delete permission group
     */
    async deletePermissionGroup(groupId, user) {
        try {
            // Check if group exists
            const existing = await prisma.permission_groups.findUnique({
                where: { id: groupId },
                include: {
                    permissions: {
                        select: { id: true }
                    }
                }
            });

            if (!existing) {
                throw new AppError('Permission group not found', 404);
            }

            // Check if group has permissions
            if (existing.permissions.length > 0) {
                throw new AppError(
                    `Cannot delete group with ${existing.permissions.length} permissions. ` +
                    'Please reassign or remove permissions first.',
                    400
                );
            }

            await prisma.permission_groups.delete({
                where: { id: groupId }
            });

            return {
                success: true,
                message: 'Permission group deleted successfully'
            };
        } catch (error) {
            console.error('Error in deletePermissionGroup:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Get permission groups statistics
     */
    async getGroupStatistics(user) {
        try {
            const stats = await prisma.$queryRaw`
                SELECT 
                    COUNT(*)::int AS total_groups,
                    COUNT(CASE WHEN is_active = true THEN 1 END)::int AS active_groups,
                    COUNT(CASE WHEN is_active = false THEN 1 END)::int AS inactive_groups,
                    (
                        SELECT COUNT(*)::int 
                        FROM permissions 
                        WHERE group_id IS NOT NULL
                    ) AS grouped_permissions,
                    (
                        SELECT COUNT(*)::int 
                        FROM permissions 
                        WHERE group_id IS NULL
                    ) AS ungrouped_permissions
                FROM permission_groups
            `;

            return {
                success: true,
                message: 'Permission group statistics retrieved successfully',
                data: stats[0]
            };
        } catch (error) {
            console.error('Error in getGroupStatistics:', error);
            throw new AppError(error.message, 500);
        }
    }
}

export default new PermissionGroupService();
