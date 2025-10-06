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
        
        // 3. Check specific permission
        const targetPermission = 'permission.read';
        console.log('🎯 Looking for permission:', targetPermission);
        
        // 4. Check all permissions user has
        const allUserPermissions = [];
        for (const userRole of userRoles) {
            for (const rolePermission of userRole.roles.role_permissions) {
                allUserPermissions.push({
                    role_name: userRole.roles.name,
                    permission_name: rolePermission.permissions.name,
                    resource: rolePermission.permissions.resource,
                    action: rolePermission.permissions.action,
                    is_active: rolePermission.permissions.is_active
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
                    role_name: ur.roles.name,
                    is_system_role: ur.roles.is_system_role,
                    permissions_count: ur.roles.role_permissions.length
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
                permissions: true,
                users: {
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
                permissions: true
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

            rolePermissions = userRoles.flatMap(ur => 
                ur.roles.role_permissions.map(rp => ({
                    ...rp.permissions,
                    source: 'role',
                    role_name: ur.roles.name
                }))
            );
        }

        return res.json({
            success: true,
            data: {
                direct_permissions: directPermissions.map(up => ({
                    ...up.permissions,
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

// ==================== USER ROLE MANAGEMENT ====================

/**
 * Assign role to user
 * POST /users/:userId/roles
 */
export const assignRoleToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role_id, organization_id, department_id, notes } = req.body;
        const assignedBy = req.user?.id;

        if (!role_id) {
            return res.status(400).json({
                success: false,
                error: 'role_id is required'
            });
        }

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, organization_id: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if role exists
        const role = await prisma.roles.findUnique({
            where: { id: role_id },
            select: { 
                id: true, 
                name: true, 
                is_system_role: true,
                organization_id: true
            }
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                error: 'Role not found'
            });
        }

        // Check if user already has this role
        const existingAssignment = await prisma.user_roles.findFirst({
            where: {
                user_id: userId,
                role_id: role_id,
                is_active: true
            }
        });

        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                error: 'User already has this role'
            });
        }

        // Determine organization for role assignment
        const roleOrgId = organization_id || user.organization_id || role.organization_id;

        // ✅ FIXED: Use raw SQL for role assignment to avoid Prisma relationship issues
        console.log('🔍 Role assignment data:', {
            user_id: userId,
            role_id: role_id,
            organization_id: roleOrgId,
            department_id: department_id || null,
            assigned_by: assignedBy
        });

        let assignment;
        if (roleOrgId) {
            // Normal role assignment with organization
            assignment = await prisma.$queryRaw`
                INSERT INTO user_roles (
                    user_id, role_id, organization_id, department_id,
                    assigned_by, assigned_at, is_active, valid_from, valid_until, notes
                ) VALUES (
                    ${userId}::uuid,
                    ${role_id}::uuid,
                    ${roleOrgId}::uuid,
                    ${department_id || null}::uuid,
                    ${assignedBy}::uuid,
                    CURRENT_TIMESTAMP,
                    true,
                    CURRENT_TIMESTAMP,
                    null,
                    ${notes || `Role assigned to ${user.username}`}
                ) RETURNING id
            `;
        } else {
            // System role assignment without organization (for Super Admin)
            assignment = await prisma.$queryRaw`
                INSERT INTO user_roles (
                    user_id, role_id, organization_id, department_id,
                    assigned_by, assigned_at, is_active, valid_from, valid_until, notes
                ) VALUES (
                    ${userId}::uuid,
                    ${role_id}::uuid,
                    null,
                    null,
                    ${assignedBy}::uuid,
                    CURRENT_TIMESTAMP,
                    true,
                    CURRENT_TIMESTAMP,
                    null,
                    ${notes || `System role assigned to ${user.username}`}
                ) RETURNING id
            `;
        }

        console.log('✅ Role assignment result:', assignment);

        // Get the created assignment with relationships
        const createdAssignment = await prisma.user_roles.findUnique({
            where: { id: assignment[0].id },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        color: true,
                        icon: true,
                        is_system_role: true
                    }
                },
                organizations: roleOrgId ? {
                    select: {
                        id: true,
                        name: true
                    }
                } : false
            }
        });

        res.status(201).json({
            success: true,
            data: createdAssignment,
            message: `Role "${role.name}" assigned to user successfully`
        });

    } catch (error) {
        console.error('Error assigning role to user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

/**
 * Remove role from user
 * DELETE /users/:userId/roles/:roleId
 */
export const removeRoleFromUser = async (req, res) => {
    try {
        const { userId, roleId } = req.params;

        // Find the role assignment
        const assignment = await prisma.user_roles.findFirst({
            where: {
                user_id: userId,
                role_id: roleId,
                is_active: true
            },
            include: {
                roles: {
                    select: { name: true }
                },
                users: {
                    select: { username: true }
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: 'Role assignment not found'
            });
        }

        // Deactivate the role assignment
        await prisma.user_roles.update({
            where: { id: assignment.id },
            data: {
                is_active: false,
                updated_at: new Date()
            }
        });

        res.json({
            success: true,
            message: `Role "${assignment.roles.name}" removed from user "${assignment.users.username}" successfully`
        });

    } catch (error) {
        console.error('Error removing role from user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

/**
 * Get user roles
 * GET /users/:userId/roles
 */
export const getUserRoles = async (req, res) => {
    try {
        const { userId } = req.params;
        const { include_permissions = 'false' } = req.query;

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get user roles
        const userRoles = await prisma.user_roles.findMany({
            where: {
                user_id: userId,
                is_active: true
            },
            include: {
                roles: {
                    include: {
                        role_permissions: include_permissions === 'true' ? {
                            include: {
                                permissions: true
                            }
                        } : false
                    }
                },
                organizations: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        const formattedRoles = userRoles.map(ur => ({
            assignment_id: ur.id,
            role: {
                id: ur.roles.id,
                name: ur.roles.name,
                description: ur.roles.description,
                color: ur.roles.color,
                icon: ur.roles.icon,
                is_system_role: ur.roles.is_system_role,
                permissions: include_permissions === 'true' ? 
                    ur.roles.role_permissions.map(rp => rp.permissions) : undefined
            },
            organization: ur.organizations,
            department: ur.departments,
            assigned_at: ur.assigned_at,
            valid_from: ur.valid_from,
            valid_until: ur.valid_until,
            notes: ur.notes
        }));

        res.json({
            success: true,
            data: formattedRoles,
            total: formattedRoles.length,
            include_permissions: include_permissions === 'true',
            message: 'User roles retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user roles:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

export default {
    debugUserPermissions,
    assignPermissionToUser,
    getUserPermissions,
    assignRoleToUser,
    removeRoleFromUser,
    getUserRoles
};