/**
 * 🔐 User Direct Permission Management Controller
 * Handles direct permission assignment to users (not through roles)
 */

import { PrismaClient } from '@prisma/client';
import permissionService from '../../../shared/services/PermissionService.backup.js';
import auditService from '../../../shared/services/AuditService.js';
import { HTTP_STATUS, MESSAGES } from '../../../shared/constants/index.js';

const prisma = new PrismaClient();

/**
 * Assign direct permission to user
 * @route POST /users/:userId/permissions
 */
export const assignDirectPermissionToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permission_id, conditions, valid_until } = req.body;
        const grantedBy = req.user.id;

        // Validate permission exists
        const permission = await prisma.permissions.findUnique({
            where: { id: permission_id }
        });

        if (!permission) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Permission not found'
            });
        }

        // Check if assignment already exists
        const existingAssignment = await prisma.user_permissions.findFirst({
            where: {
                user_id: userId,
                permission_id,
                is_active: true
            }
        });

        if (existingAssignment) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                message: 'Permission already assigned to user'
            });
        }

        // Create assignment
        const assignment = await prisma.user_permissions.create({
            data: {
                user_id: userId,
                permission_id,
                conditions: conditions || null,
                valid_until: valid_until ? new Date(valid_until) : null,
                granted_by: grantedBy,
                granted_at: new Date(),
                is_active: true
            },
            include: {
                permissions: {
                    select: {
                        name: true,
                        description: true,
                        resource: true,
                        action: true
                    }
                }
            }
        });

        // Log audit
        await auditService.logActivity(
            grantedBy,
            'user_permission.assign',
            'user_permission',
            assignment.id,
            {
                user_id: userId,
                permission: permission.name,
                conditions,
                valid_until
            }
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: assignment,
            message: 'Direct permission assigned successfully'
        });

    } catch (error) {
        console.error('Error assigning direct permission to user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Get user's direct permissions
 * @route GET /users/:userId/permissions
 */
export const getUserDirectPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { include_expired = false } = req.query;

        const whereCondition = {
            user_id: userId,
            is_active: true
        };

        // Filter out expired permissions unless explicitly requested
        if (include_expired === 'false' || include_expired === false) {
            whereCondition.AND = [
                {
                    OR: [
                        { valid_until: null },
                        { valid_until: { gte: new Date() } }
                    ]
                }
            ];
        }

        const directPermissions = await prisma.user_permissions.findMany({
            where: whereCondition,
            include: {
                permissions: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        resource: true,
                        action: true,
                        group_id: true
                    }
                },
            },
            orderBy: {
                granted_at: 'desc'
            }
        });

        const formattedPermissions = directPermissions.map(up => ({
            assignment_id: up.id,
            permission: up.permissions,
            conditions: up.conditions,
            valid_until: up.valid_until,
            granted_at: up.granted_at,
            granted_by: up.granted_by,
            is_expired: up.valid_until ? new Date(up.valid_until) < new Date() : false
        }));

        res.json({
            success: true,
            data: formattedPermissions,
            total: formattedPermissions.length,
            message: 'Direct permissions retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user direct permissions:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Remove direct permission from user
 * @route DELETE /users/:userId/permissions/:permissionId
 */
export const removeDirectPermissionFromUser = async (req, res) => {
    try {
        const { userId, permissionId } = req.params;
        const { reason } = req.body;

        // Find the assignment
        const assignment = await prisma.user_permissions.findFirst({
            where: {
                user_id: userId,
                permission_id: permissionId,
                is_active: true
            },
            include: {
                permissions: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!assignment) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Permission assignment not found'
            });
        }

        // Soft delete the assignment (just set is_active to false)
        await prisma.user_permissions.update({
            where: { id: assignment.id },
            data: {
                is_active: false,
                notes: reason ? `Removed: ${reason}` : 'Removed manually'
            }
        });

        // Log audit
        await auditService.logActivity(
            req.user.id,
            'user_permission.remove',
            'user_permission',
            assignment.id,
            {
                user_id: userId,
                permission: assignment.permissions.name,
                reason
            }
        );

        res.json({
            success: true,
            message: 'Direct permission removed successfully'
        });

    } catch (error) {
        console.error('Error removing direct permission from user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

// 🔄 COMPATIBILITY ALIASES - For backward compatibility with legacy imports
export { assignDirectPermissionToUser as assignPermissionToUser };
export { getUserDirectPermissions as getUserPermissions };