import { PrismaClient } from '@prisma/client';
import { 
    hasPermission,
    getUserAllPermissions,
    getUserDirectPermissions,
    getUserPermissionsBySource
} from '../../utils/permissionHelpers.js';

const prisma = new PrismaClient();

/**
 * Assign direct permissions to user
 * POST /users/:userId/permissions
 */
export const assignDirectPermissionsToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permission_ids, notes, valid_from, valid_until } = req.body;

        // Check permission to manage users
        if (!hasPermission(req.user, 'user.manage')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot manage user permissions'
            });
        }

        // Validate required fields
        if (!permission_ids || !Array.isArray(permission_ids) || permission_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'permission_ids array is required'
            });
        }

        // Validate user exists
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate permissions exist
        const permissions = await prisma.permissions.findMany({
            where: { id: { in: permission_ids } }
        });

        if (permissions.length !== permission_ids.length) {
            return res.status(400).json({
                success: false,
                message: 'Some permissions not found'
            });
        }

        // Create direct permission assignments
        const userPermissions = permission_ids.map(permissionId => ({
            user_id: userId,
            permission_id: permissionId,
            granted_by: req.user.id,
            granted_at: new Date(),
            valid_from: valid_from ? new Date(valid_from) : new Date(),
            valid_until: valid_until ? new Date(valid_until) : null,
            is_active: true,
            notes: notes || null
        }));

        // Remove existing direct permissions if replacing
        await prisma.user_permissions.deleteMany({
            where: { 
                user_id: userId,
                permission_id: { in: permission_ids }
            }
        });

        // Add new direct permissions
        await prisma.user_permissions.createMany({
            data: userPermissions
        });

        // Return updated permissions
        const updatedPermissions = await getUserPermissionsBySource(userId);

        res.json({
            success: true,
            data: {
                user_id: userId,
                permissions: updatedPermissions
            },
            message: 'Direct permissions assigned successfully'
        });

    } catch (error) {
        console.error('Error assigning direct permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Remove direct permission from user
 * DELETE /users/:userId/permissions/:permissionId
 */
export const removeDirectPermissionFromUser = async (req, res) => {
    try {
        const { userId, permissionId } = req.params;

        if (!hasPermission(req.user, 'user.manage')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot manage user permissions'
            });
        }

        // Check if direct permission exists
        const existingPermission = await prisma.user_permissions.findFirst({
            where: {
                user_id: userId,
                permission_id: permissionId
            },
            include: {
                permissions: true
            }
        });

        if (!existingPermission) {
            return res.status(404).json({
                success: false,
                message: 'Direct permission not found'
            });
        }

        // Remove direct permission
        await prisma.user_permissions.deleteMany({
            where: {
                user_id: userId,
                permission_id: permissionId
            }
        });

        res.json({
            success: true,
            data: {
                removed_permission: existingPermission.permissions.name
            },
            message: 'Direct permission removed successfully'
        });

    } catch (error) {
        console.error('Error removing direct permission:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Get user's direct permissions
 * GET /users/:userId/permissions
 */
export const getUserDirectPermissionsController = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check permission
        const canManageUsers = hasPermission(req.user, 'user.manage');
        const isSelfAccess = req.user.id === userId;

        if (!canManageUsers && !isSelfAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot view user permissions'
            });
        }

        // Validate user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get direct permissions
        const directPermissions = await getUserDirectPermissions(userId);

        res.json({
            success: true,
            data: {
                user,
                direct_permissions: directPermissions
            }
        });

    } catch (error) {
        console.error('Error getting user direct permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Get all user permissions (roles + direct)
 * GET /users/:userId/permissions/all
 */
export const getUserAllPermissionsController = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check permission
        const canManageUsers = hasPermission(req.user, 'user.manage');
        const isSelfAccess = req.user.id === userId;

        if (!canManageUsers && !isSelfAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot view user permissions'
            });
        }

        // Validate user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get all permissions grouped by source
        const permissionsBySource = await getUserPermissionsBySource(userId);

        res.json({
            success: true,
            data: {
                user,
                ...permissionsBySource
            }
        });

    } catch (error) {
        console.error('Error getting all user permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Update direct permission (extend validity, change notes, etc.)
 * PUT /users/:userId/permissions/:permissionId
 */
export const updateDirectPermission = async (req, res) => {
    try {
        const { userId, permissionId } = req.params;
        const { valid_until, notes, is_active } = req.body;

        if (!hasPermission(req.user, 'user.manage')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot manage user permissions'
            });
        }

        // Check if direct permission exists
        const existingPermission = await prisma.user_permissions.findFirst({
            where: {
                user_id: userId,
                permission_id: permissionId
            }
        });

        if (!existingPermission) {
            return res.status(404).json({
                success: false,
                message: 'Direct permission not found'
            });
        }

        // Update permission
        const updateData = {};
        if (valid_until !== undefined) updateData.valid_until = valid_until ? new Date(valid_until) : null;
        if (notes !== undefined) updateData.notes = notes;
        if (is_active !== undefined) updateData.is_active = is_active;

        const updatedPermission = await prisma.user_permissions.updateMany({
            where: {
                user_id: userId,
                permission_id: permissionId
            },
            data: updateData
        });

        res.json({
            success: true,
            data: { updated_count: updatedPermission.count },
            message: 'Direct permission updated successfully'
        });

    } catch (error) {
        console.error('Error updating direct permission:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Bulk assign multiple direct permissions
 * POST /users/:userId/permissions/bulk
 */
export const bulkAssignDirectPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { assignments } = req.body; // Array of {permission_id, notes, valid_from, valid_until}

        if (!hasPermission(req.user, 'user.manage')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot manage user permissions'
            });
        }

        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'assignments array is required'
            });
        }

        // Validate user exists
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Process assignments
        const userPermissions = assignments.map(assignment => ({
            user_id: userId,
            permission_id: assignment.permission_id,
            granted_by: req.user.id,
            granted_at: new Date(),
            valid_from: assignment.valid_from ? new Date(assignment.valid_from) : new Date(),
            valid_until: assignment.valid_until ? new Date(assignment.valid_until) : null,
            is_active: true,
            notes: assignment.notes || null
        }));

        // Remove existing direct permissions for these permission IDs
        const permissionIds = assignments.map(a => a.permission_id);
        await prisma.user_permissions.deleteMany({
            where: { 
                user_id: userId,
                permission_id: { in: permissionIds }
            }
        });

        // Add new direct permissions
        await prisma.user_permissions.createMany({
            data: userPermissions
        });

        // Return updated permissions
        const updatedPermissions = await getUserPermissionsBySource(userId);

        res.json({
            success: true,
            data: {
                user_id: userId,
                assigned_count: assignments.length,
                permissions: updatedPermissions
            },
            message: 'Bulk direct permissions assigned successfully'
        });

    } catch (error) {
        console.error('Error bulk assigning direct permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};