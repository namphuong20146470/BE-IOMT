/**
 * 🔍 User Permission Debug Controller
 * Handles debugging and troubleshooting of user permissions
 */

import { PrismaClient } from '@prisma/client';
import permissionService from '../../../shared/services/PermissionService.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';

const prisma = new PrismaClient();

/**
 * Debug user permissions - comprehensive permission analysis
 * @route GET /users/:userId/permissions/debug
 */
export const debugUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🔍 DEBUG: Starting permission check for user:', userId);
        
        // 1. Check user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('👤 User found:', `${user.username} (${user.email})`);
        
        // 2. Check user roles
        const userRoles = await prisma.user_roles.findMany({
            where: { 
                user_id: userId,
                is_active: true
            },
            include: {
                roles: {
                    include: {
                        role_permissions: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                }
            }
        });
        
        console.log('🎭 User roles:', userRoles.map(ur => ({
            role_name: ur.roles.name,
            is_system_role: ur.roles.is_system_role,
            organization_id: ur.organization_id,
            is_active: ur.is_active,
            permissions_count: ur.roles.role_permissions.length
        })));

        // 3. Check direct permissions
        const directPermissions = await prisma.user_permissions.findMany({
            where: {
                user_id: userId,
                is_active: true
            },
            include: {
                permissions: true
            }
        });

        console.log('🔑 Direct permissions:', directPermissions.map(up => ({
            permission_name: up.permissions.name,
            organization_id: up.organization_id,
            expires_at: up.expires_at,
            is_expired: up.expires_at ? new Date(up.expires_at) < new Date() : false
        })));

        // 4. Aggregate all permissions
        const rolePermissions = userRoles.flatMap(ur => 
            ur.roles.role_permissions.map(rp => ({
                name: rp.permissions.name,
                source: `Role: ${ur.roles.name}`,
                resource: rp.permissions.resource,
                action: rp.permissions.action,
                organization_id: ur.organization_id
            }))
        );

        const directPerms = directPermissions
            .filter(up => !up.expires_at || new Date(up.expires_at) >= new Date())
            .map(up => ({
                name: up.permissions.name,
                source: 'Direct Assignment',
                resource: up.permissions.resource,
                action: up.permissions.action,
                organization_id: up.organization_id,
                expires_at: up.expires_at
            }));

        const allPermissions = [...rolePermissions, ...directPerms];
        const uniquePermissions = allPermissions.reduce((acc, perm) => {
            const key = `${perm.name}-${perm.organization_id || 'global'}`;
            if (!acc[key]) {
                acc[key] = perm;
            }
            return acc;
        }, {});

        // 5. Permission summary
        const summary = {
            user_info: {
                id: user.id,
                username: user.username,
                email: user.email,
                is_active: user.is_active,
                organization: user.organizations,
                department: user.departments
            },
            roles_count: userRoles.length,
            direct_permissions_count: directPermissions.length,
            total_unique_permissions: Object.keys(uniquePermissions).length,
            permissions_by_source: {
                role_based: rolePermissions.length,
                direct_assigned: directPerms.length
            }
        };

        console.log('📊 Permission summary:', summary);

        res.json({
            success: true,
            debug_info: {
                summary,
                user_roles: userRoles.map(ur => ({
                    role_id: ur.roles.id,
                    role_name: ur.roles.name,
                    is_system_role: ur.roles.is_system_role,
                    organization_id: ur.organization_id,
                    permissions: ur.roles.role_permissions.map(rp => ({
                        name: rp.permissions.name,
                        resource: rp.permissions.resource,
                        action: rp.permissions.action
                    }))
                })),
                direct_permissions: directPerms,
                all_unique_permissions: Object.values(uniquePermissions),
                expired_permissions: directPermissions.filter(up => 
                    up.expires_at && new Date(up.expires_at) < new Date()
                )
            },
            message: 'Debug information retrieved successfully'
        });

    } catch (error) {
        console.error('Error debugging user permissions:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to debug user permissions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Test user permission for specific action
 * @route POST /users/:userId/permissions/test
 */
export const testUserPermission = async (req, res) => {
    try {
        const { userId } = req.params;
        const { permission_name, resource_id, organization_id } = req.body;

        if (!permission_name) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Permission name is required'
            });
        }

        // Use permission service to check permission
        const hasPermission = await permissionService.hasPermission(
            userId, 
            permission_name, 
            { resource_id, organization_id }
        );

        // Get detailed reasoning
        const permissionDetails = await permissionService.getPermissionSource(
            userId, 
            permission_name, 
            { organization_id }
        );

        res.json({
            success: true,
            test_result: {
                user_id: userId,
                permission_name,
                has_permission: hasPermission,
                source: permissionDetails.source || 'No permission found',
                details: permissionDetails,
                tested_at: new Date().toISOString()
            },
            message: 'Permission test completed'
        });

    } catch (error) {
        console.error('Error testing user permission:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to test permission'
        });
    }
};