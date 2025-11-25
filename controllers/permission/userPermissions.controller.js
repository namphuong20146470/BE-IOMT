import { PrismaClient } from '@prisma/client';
import UserPermissionService from '../../features/users/services/UserPermissionService.js';
// Note: AuditService import commented out for now - will implement later
// import auditService from '../../shared/services/AuditService.js';

const prisma = new PrismaClient();

/**
 * 🚀 User Permissions Controller
 * Handles grant/revoke individual permissions to users
 * Uses user_permissions table for overrides (is_active true/false)
 */

/**
 * 📋 Get user's effective permissions
 * GET /users/:userId/permissions
 * Query params: 
 *  - detailed=true (include metadata)
 *  - include_overrides=true (show grant/revoke history)
 */
const getUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { detailed = false, include_overrides = false } = req.query;
        const requesterId = req.user?.id;

        if (!requesterId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check: admin or self
        if (requesterId !== userId) {
            // Check if requester has user.manage permission
            const hasPermission = await UserPermissionService.hasPermission(requesterId, 'user.manage');
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Can only view own permissions or need user.manage permission'
                });
            }
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        let permissions, overrides;

        if (detailed === 'true') {
            permissions = await UserPermissionService.getUserPermissionsDetailed(userId);
        } else {
            permissions = await UserPermissionService.getUserPermissions(userId);
        }

        if (include_overrides === 'true') {
            overrides = await UserPermissionService.getUserPermissionOverrides(userId);
        }

        res.status(200).json({
            success: true,
            data: {
                user,
                permissions,
                ...(overrides && { permission_overrides: overrides }),
                permissions_count: Array.isArray(permissions) ? permissions.length : Object.keys(permissions).length,
                timestamp: new Date().toISOString()
            },
            message: 'User permissions retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting user permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user permissions',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * ✅ Grant additional permission to user
 * POST /users/:userId/permissions/grant
 * Body: {
 *   permission_code: "device.delete",
 *   valid_until: "2025-12-31T23:59:59Z", // optional
 *   notes: "Temporary permission for project"
 * }
 */
const grantPermissionToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permission_code, valid_until, notes } = req.body;
        const grantedBy = req.user?.id;

        if (!grantedBy) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check
        const hasPermission = await UserPermissionService.hasPermission(grantedBy, 'user.permissions.manage');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Required permission: user.permissions.manage'
            });
        }

        // Validation
        if (!permission_code) {
            return res.status(400).json({
                success: false,
                error: 'permission_code is required'
            });
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Grant permission
        const result = await UserPermissionService.grantPermission({
            userId,
            permissionCode: permission_code,
            grantedBy,
            validUntil: valid_until ? new Date(valid_until) : null,
            notes
        });

        // Log audit (TODO: implement when AuditService is available)
        console.log(`📋 Audit: Permission '${permission_code}' granted to ${user.username} by ${grantedBy}`);

        res.status(201).json({
            success: true,
            data: {
                permission_grant: {
                    id: result.id,
                    user: user,
                    permission: {
                        code: result.permissions.name,
                        name: result.permissions.name,
                        description: result.permissions.description
                    },
                    granted_by: result.granted_by_user,
                    granted_at: result.granted_at,
                    valid_until: result.valid_until,
                    notes: result.notes
                }
            },
            message: `Permission '${permission_code}' granted to user successfully`
        });

    } catch (error) {
        console.error('❌ Error granting permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to grant permission',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * 🚫 Revoke permission from user
 * POST /users/:userId/permissions/revoke
 * Body: {
 *   permission_code: "device.delete",
 *   notes: "Security violation - access revoked"
 * }
 */
const revokePermissionFromUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permission_code, notes } = req.body;
        const revokedBy = req.user?.id;

        if (!revokedBy) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check
        const hasPermission = await UserPermissionService.hasPermission(revokedBy, 'user.permissions.manage');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Required permission: user.permissions.manage'
            });
        }

        // Validation
        if (!permission_code) {
            return res.status(400).json({
                success: false,
                error: 'permission_code is required'
            });
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user currently has this permission
        const currentlyHasPermission = await UserPermissionService.hasPermission(userId, permission_code);
        if (!currentlyHasPermission) {
            return res.status(400).json({
                success: false,
                error: `User does not have permission '${permission_code}' to revoke`
            });
        }

        // Revoke permission
        const result = await UserPermissionService.revokePermission({
            userId,
            permissionCode: permission_code,
            revokedBy,
            notes
        });

        // Log audit (TODO: implement when AuditService is available)
        console.log(`📋 Audit: Permission '${permission_code}' revoked from ${user.username} by ${revokedBy}`);

        res.status(200).json({
            success: true,
            data: {
                permission_revoke: {
                    id: result.id,
                    user: user,
                    permission: {
                        code: result.permissions.name,
                        name: result.permissions.name,
                        description: result.permissions.description
                    },
                    revoked_by: result.granted_by_user,
                    revoked_at: result.granted_at,
                    notes: result.notes
                }
            },
            message: `Permission '${permission_code}' revoked from user successfully`
        });

    } catch (error) {
        console.error('❌ Error revoking permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke permission',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * 🔄 Bulk grant/revoke permissions for user
 * POST /users/:userId/permissions/bulk
 * Body: {
 *   grants: ["device.create", "device.edit"],
 *   revokes: ["device.delete"],
 *   notes: "Updated permissions for project role change"
 * }
 */
const bulkUpdateUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { grants = [], revokes = [], notes } = req.body;
        const updatedBy = req.user?.id;

        if (!updatedBy) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check
        const hasPermission = await UserPermissionService.hasPermission(updatedBy, 'user.permissions.manage');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Required permission: user.permissions.manage'
            });
        }

        // Validation
        if ((!grants || grants.length === 0) && (!revokes || revokes.length === 0)) {
            return res.status(400).json({
                success: false,
                error: 'At least one grant or revoke operation is required'
            });
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Perform bulk update
        const results = await UserPermissionService.bulkUpdatePermissions({
            userId,
            grants,
            revokes,
            grantedBy: updatedBy,
            notes
        });

        // Count successes and failures
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        // Log audit (TODO: implement when AuditService is available)
        console.log(`📋 Audit: Bulk permission update for ${user.username} - ${successCount} success, ${failureCount} failed`);

        res.status(200).json({
            success: true,
            data: {
                user,
                results,
                summary: {
                    total_operations: results.length,
                    successful: successCount,
                    failed: failureCount,
                    grants_attempted: grants.length,
                    revokes_attempted: revokes.length
                }
            },
            message: `Bulk permission update completed. ${successCount} successful, ${failureCount} failed.`
        });

    } catch (error) {
        console.error('❌ Error bulk updating permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk update permissions',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * 📋 Get user's permission overrides history
 * GET /users/:userId/permissions/overrides
 * Query params:
 *  - active_only=true (only active overrides)
 *  - limit=10, offset=0 (pagination)
 */
const getUserPermissionOverrides = async (req, res) => {
    try {
        const { userId } = req.params;
        const { active_only = false, limit = 50, offset = 0 } = req.query;
        const requesterId = req.user?.id;

        if (!requesterId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check: admin or self
        if (requesterId !== userId) {
            const hasPermission = await UserPermissionService.hasPermission(requesterId, 'user.manage');
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Can only view own permission overrides or need user.manage permission'
                });
            }
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Build query conditions
        const whereClause = { user_id: userId };
        if (active_only === 'true') {
            whereClause.is_active = true;
            whereClause.AND = [
                { OR: [{ valid_from: null }, { valid_from: { lte: new Date() } }] },
                { OR: [{ valid_until: null }, { valid_until: { gte: new Date() } }] }
            ];
        }

        // Get overrides with pagination
        const [overrides, totalCount] = await Promise.all([
            prisma.user_permissions.findMany({
                where: whereClause,
                include: {
                    permissions: true,
                    granted_by_user: {
                        select: { username: true, email: true }
                    }
                },
                orderBy: { granted_at: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.user_permissions.count({ where: whereClause })
        ]);

        // Format results
        const formattedOverrides = overrides.map(override => ({
            id: override.id,
            permission: {
                code: override.permissions.name,
                name: override.permissions.name,
                description: override.permissions.description
            },
            action: override.is_active ? 'granted' : 'revoked',
            granted_by: override.granted_by_user,
            granted_at: override.granted_at,
            valid_from: override.valid_from,
            valid_until: override.valid_until,
            is_active: override.is_active,
            notes: override.notes,
            is_expired: override.valid_until ? new Date() > new Date(override.valid_until) : false,
            is_future: override.valid_from ? new Date() < new Date(override.valid_from) : false
        }));

        res.status(200).json({
            success: true,
            data: {
                user,
                overrides: formattedOverrides,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    pages: Math.ceil(totalCount / parseInt(limit)),
                    current_page: Math.floor(parseInt(offset) / parseInt(limit)) + 1
                }
            },
            message: 'User permission overrides retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting permission overrides:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permission overrides',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * 🔍 Check if user has specific permission
 * GET /users/:userId/permissions/check/:permissionCode
 */
const checkUserPermission = async (req, res) => {
    try {
        const { userId, permissionCode } = req.params;
        const requesterId = req.user?.id;

        if (!requesterId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Permission check: admin or self
        if (requesterId !== userId) {
            const hasPermission = await UserPermissionService.hasPermission(requesterId, 'user.manage');
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }

        // Check permission
        const hasPermission = await UserPermissionService.hasPermission(userId, permissionCode);

        res.status(200).json({
            success: true,
            data: {
                user_id: userId,
                permission_code: permissionCode,
                has_permission: hasPermission,
                checked_at: new Date().toISOString()
            },
            message: `Permission check completed`
        });

    } catch (error) {
        console.error('❌ Error checking permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check permission',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

export {
    getUserPermissions,
    grantPermissionToUser,
    revokePermissionFromUser,
    bulkUpdateUserPermissions,
    getUserPermissionOverrides,
    checkUserPermission
};