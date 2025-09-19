import { PrismaClient } from '@prisma/client';
import permissionService from '../../services/PermissionService.js';
import auditService from '../../services/AuditService.js';

const prisma = new PrismaClient();

/**
 * Debug user permissions
 * GET /users/:userId/permissions/debug
 */
export const debugUserPermissions = async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🔍 DEBUG: Starting permission check for user:', userId);
        
        // 1. Check user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
                organization: true
            }
        });
        console.log('👤 User found:', user ? `${user.username} (${user.email})` : 'NOT FOUND');
        
        // 2. Check user roles
        const userRoles = await prisma.user_roles.findMany({
            where: { 
                user_id: userId,
                is_active: true
            },
            include: {
                role: {
                    include: {
                        role_permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });
        
        console.log('🎭 User roles:', userRoles.map(ur => ({
            role_name: ur.role.name,
            is_system_role: ur.role.is_system_role,
            organization_id: ur.organization_id,
            is_active: ur.is_active,
            permissions_count: ur.role.role_permissions.length
        })));
        
        // 3. Check specific permission
        const targetPermission = 'permission.read';
        console.log('🎯 Looking for permission:', targetPermission);
        
        // 4. Check all permissions user has
        const allUserPermissions = [];
        for (const userRole of userRoles) {
            for (const rolePermission of userRole.role.role_permissions) {
                allUserPermissions.push({
                    role_name: userRole.role.name,
                    permission_name: rolePermission.permission.name,
                    resource: rolePermission.permission.resource,
                    action: rolePermission.permission.action,
                    is_active: rolePermission.permission.is_active
                });
            }
        }
        
        console.log('📋 All user permissions:', allUserPermissions);
        
        // 5. Check if target permission exists
        const hasTargetPermission = allUserPermissions.some(p => p.permission_name === targetPermission);
        console.log('✅ Has target permission:', hasTargetPermission);
        
        // 6. Call actual permission service
        const serviceResult = await permissionService.hasPermission(userId, targetPermission);
        console.log('🔧 PermissionService result:', serviceResult);
        
        return res.json({
            success: true,
            debug: {
                user: user ? { id: user.id, username: user.username, email: user.email } : null,
                roles: userRoles.map(ur => ({
                    role_name: ur.role.name,
                    is_system_role: ur.role.is_system_role,
                    permissions_count: ur.role.role_permissions.length
                })),
                all_permissions: allUserPermissions,
                target_permission: targetPermission,
                has_target_permission: hasTargetPermission,
                service_result: serviceResult
            }
        });
        
    } catch (error) {
        console.error('❌ Debug error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

/**
 * Assign permission to user
 * POST /users/:userId/permissions
 */
export const assignPermissionToUser = async (req, res) => {
    try {
        const requestUserId = req.user?.id;
        if (!requestUserId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(requestUserId, 'user.update');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: user.update' 
            });
        }

        const { userId } = req.params;
        const { 
            permission_id, 
            valid_from,
            valid_until,
            is_active = true,
            notes 
        } = req.body;

        // Validation
        if (!permission_id) {
            return res.status(400).json({
                success: false,
                error: 'permission_id is required'
            });
        }

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if permission exists
        const permission = await prisma.permissions.findUnique({
            where: { id: permission_id }
        });

        if (!permission) {
            return res.status(404).json({
                success: false,
                error: 'Permission not found'
            });
        }

        // Check if already assigned
        const existing = await prisma.user_permissions.findFirst({
            where: {
                user_id: userId,
                permission_id: permission_id,
                is_active: true
            }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Permission already assigned to user'
            });
        }

        // Create user permission
        const userPermission = await prisma.user_permissions.create({
            data: {
                user_id: userId,
                permission_id: permission_id,
                granted_by: requestUserId,
                granted_at: new Date(),
                valid_from: valid_from ? new Date(valid_from) : new Date(),
                valid_until: valid_until ? new Date(valid_until) : null,
                is_active: is_active,
                notes: notes
            },
            include: {
                permission: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        // Log audit
        await auditService.logActivity(requestUserId, 'permission.assign', 'user', userId, {
            permission_id,
            permission_name: permission.name,
            details: 'Permission assigned to user'
        });

        return res.status(201).json({
            success: true,
            data: userPermission,
            message: `Permission "${permission.name}" assigned to user "${user.username}" successfully`
        });

    } catch (error) {
        console.error('Error assigning permission to user:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

/**
 * Get user permissions
 * GET /users/:userId/permissions
 */
export const getUserPermissions = async (req, res) => {
    try {
        const requestUserId = req.user?.id;
        if (!requestUserId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(requestUserId, 'user.read');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: user.read' 
            });
        }

        const { userId } = req.params;
        const { include_roles } = req.query;

        // Get direct permissions
        const directPermissions = await prisma.user_permissions.findMany({
            where: {
                user_id: userId,
                is_active: true
            },
            include: {
                permission: true
            }
        });

        let rolePermissions = [];
        if (include_roles === 'true') {
            // Get role-based permissions
            const userRoles = await prisma.user_roles.findMany({
                where: {
                    user_id: userId,
                    is_active: true
                },
                include: {
                    role: {
                        include: {
                            role_permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            });

            rolePermissions = userRoles.flatMap(ur => 
                ur.role.role_permissions.map(rp => ({
                    ...rp.permission,
                    source: 'role',
                    role_name: ur.role.name
                }))
            );
        }

        return res.json({
            success: true,
            data: {
                direct_permissions: directPermissions.map(up => ({
                    ...up.permission,
                    source: 'direct',
                    granted_at: up.granted_at,
                    valid_from: up.valid_from,
                    valid_until: up.valid_until,
                    notes: up.notes
                })),
                role_permissions: rolePermissions,
                total_direct: directPermissions.length,
                total_role: rolePermissions.length
            },
            include_roles: include_roles === 'true',
            message: 'User permissions retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user permissions:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

export default {
    debugUserPermissions,
    assignPermissionToUser,
    getUserPermissions
};