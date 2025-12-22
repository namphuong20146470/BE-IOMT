// features/roles/role.service.js
import { PrismaClient } from '@prisma/client';
import roleRepository from './role.repository.js';
import roleModel from './role.model.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import { 
    isHiddenPermission, 
    validatePermissionAssignment 
} from '../../shared/constants/permissions.constants.js';

const prisma = new PrismaClient();

class RoleService {
    /**
     * Get all roles with filtering
     */
    async getAllRoles(queryParams, user) {
        try {
            // Validate and sanitize query parameters
            const validatedQuery = roleModel.validateQueryParams(queryParams);
            
            // Check user permissions for organization access
            const accessibleRoles = await roleRepository.findAccessibleRoles(user, validatedQuery);
            
            // Sanitize role data based on include_permissions flag
            const sanitizedRoles = accessibleRoles.data.map(role => 
                roleModel.sanitizeRole(role, validatedQuery.include_permissions)
            );
            
            return {
                success: true,
                message: 'Roles retrieved successfully',
                data: sanitizedRoles,
                pagination: accessibleRoles.pagination,
                filters: accessibleRoles.filters
            };
        } catch (error) {
            console.error('Error in getAllRoles service:', error);
            throw new AppError(error.message || 'Failed to fetch roles', error.statusCode || 500);
        }
    }

    /**
     * Get role by ID
     */
    async getRoleById(roleId, user, options = {}) {
        try {
            // Validate role ID
            const validatedId = roleModel.validateRoleId(roleId);
            
            // Get role with access control
            const role = await roleRepository.findByIdWithAccess(validatedId, user, options);
            
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            return {
                success: true,
                message: 'Role retrieved successfully',
                data: role
            };
        } catch (error) {
            console.error('Error in getRoleById service:', error);
            throw new AppError(error.message || 'Failed to fetch role', error.statusCode || 500);
        }
    }

    /**
     * Create new role
     */
    async createRole(roleData, user) {
        try {
            // Validate role data
            const validatedData = roleModel.validateCreateRole(roleData);
            
            // Check user permissions
            await this.validateUserRoleAccess(user, validatedData.organization_id, 'create');
            
            // Check for duplicate role name
            await this.validateRoleUniqueness(validatedData);
            
            // Create role
            const newRole = await roleRepository.create(validatedData, user.id);
            
            return {
                success: true,
                message: 'Role created successfully',
                data: newRole
            };
        } catch (error) {
            console.error('Error in createRole service:', error);
            throw new AppError(error.message || 'Failed to create role', error.statusCode || 500);
        }
    }

    /**
     * Update role
     */
    async updateRole(roleId, updateData, user) {
        try {
            // Validate inputs
            const validatedId = roleModel.validateRoleId(roleId);
            const validatedData = roleModel.validateUpdateRole(updateData);
            
            // Check role exists and user has access
            const existingRole = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!existingRole) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Validate user permissions
            await this.validateUserRoleAccess(user, existingRole.organization_id, 'manage');
            
            // If changing name, check uniqueness
            if (validatedData.name && validatedData.name !== existingRole.name) {
                await this.validateRoleUniqueness({
                    name: validatedData.name,
                    organization_id: existingRole.organization_id
                }, validatedId);
            }
            
            // Update role
            const updatedRole = await roleRepository.update(validatedId, validatedData, user.id);
            
            return {
                success: true,
                message: 'Role updated successfully',
                data: updatedRole
            };
        } catch (error) {
            console.error('Error in updateRole service:', error);
            throw new AppError(error.message || 'Failed to update role', error.statusCode || 500);
        }
    }

    /**
     * Delete role
     */
    async deleteRole(roleId, user) {
        try {
            // Validate role ID
            const validatedId = roleModel.validateRoleId(roleId);
            
            // Check role exists and user has access
            const existingRole = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!existingRole) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Check if it's a system role
            if (existingRole.is_system_role) {
                throw new AppError('Cannot delete system role', 400);
            }

            // Validate user permissions
            await this.validateUserRoleAccess(user, existingRole.organization_id, 'manage');
            
            // Check if role has active user assignments
            const hasUsers = await roleRepository.hasActiveUserAssignments(validatedId);
            if (hasUsers) {
                throw new AppError('Cannot delete role with active user assignments', 400);
            }
            
            // Delete role
            await roleRepository.delete(validatedId, user.id);
            
            return {
                success: true,
                message: 'Role deleted successfully'
            };
        } catch (error) {
            console.error('Error in deleteRole service:', error);
            throw new AppError(error.message || 'Failed to delete role', error.statusCode || 500);
        }
    }

    /**
     * Get role permissions (with optional grouping)
     */
    async getRolePermissions(roleId, user, options = {}) {
        try {
            // Validate role ID
            const validatedId = roleModel.validateRoleId(roleId);
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Get role permissions
            const permissions = await roleRepository.getRolePermissions(validatedId);
            
            // If grouped requested, organize by permission groups
            if (options.grouped === 'true' || options.grouped === true) {
                const grouped = await this.groupPermissionsByGroup(permissions, role);
                return {
                    success: true,
                    message: 'Role permissions retrieved successfully',
                    data: grouped
                };
            }
            
            return {
                success: true,
                message: 'Role permissions retrieved successfully',
                data: permissions
            };
        } catch (error) {
            console.error('Error in getRolePermissions service:', error);
            throw new AppError(error.message || 'Failed to fetch role permissions', error.statusCode || 500);
        }
    }

    /**
     * Group permissions by permission groups for UI
     */
    async groupPermissionsByGroup(permissions, role) {
        try {
            // Get all permission groups
            const allGroups = await prisma.permission_groups.findMany({
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
                include: {
                    permissions: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            resource: true,
                            action: true,
                            priority: true
                        }
                    }
                }
            });

            const rolePermissionIds = new Set(permissions.map(p => p.id));
            
            const groupedPermissions = {};
            
            for (const group of allGroups) {
                const assignedPerms = group.permissions.filter(p => rolePermissionIds.has(p.id));
                
                groupedPermissions[group.id] = {
                    group_name: group.name,
                    group_description: group.description,
                    group_color: group.color,
                    group_icon: group.icon,
                    sort_order: group.sort_order,
                    total_in_group: group.permissions.length,
                    assigned_count: assignedPerms.length,
                    all_assigned: assignedPerms.length === group.permissions.length && group.permissions.length > 0,
                    permissions: assignedPerms
                };
            }

            return {
                role: {
                    id: role.id,
                    name: role.name,
                    description: role.description
                },
                total_permissions: permissions.length,
                grouped_permissions: groupedPermissions
            };
        } catch (error) {
            console.error('Error grouping permissions:', error);
            throw error;
        }
    }

    /**
     * Bulk assign permissions to role
     */
    async bulkAssignPermissions(roleId, data, user) {
        try {
            const validatedId = roleModel.validateRoleId(roleId);
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Check if it's a system role
            if (role.is_system_role && !user.permissions.includes('system.admin')) {
                throw new AppError('Only system admin can modify system role permissions', 403);
            }

            let permissionIds = [];
            
            // If group_id provided, get all permissions from that group
            if (data.group_id) {
                const group = await prisma.permission_groups.findUnique({
                    where: { id: data.group_id },
                    include: {
                        permissions: {
                            select: { id: true }
                        }
                    }
                });

                if (!group) {
                    throw new AppError('Permission group not found', 404);
                }

                permissionIds = group.permissions.map(p => p.id);
            } 
            // Otherwise use provided permission_ids
            else if (data.permission_ids && Array.isArray(data.permission_ids)) {
                permissionIds = data.permission_ids;
            } else {
                throw new AppError('Either group_id or permission_ids must be provided', 400);
            }

            if (permissionIds.length === 0) {
                throw new AppError('No permissions to assign', 400);
            }

            // ✅ Validate no hidden permissions using centralized helper
            const permissionsToCheck = await prisma.permissions.findMany({
                where: { id: { in: permissionIds } },
                select: { id: true, name: true }
            });

            const hiddenPerms = permissionsToCheck.filter(p => isHiddenPermission(p.name));
            if (hiddenPerms.length > 0) {
                const hiddenNames = hiddenPerms.map(p => p.name).join(', ');
                throw new AppError(
                    `Cannot assign hidden permissions: ${hiddenNames}`, 
                    403
                );
            }

            // Bulk insert role_permissions (skip duplicates)
            const result = await roleRepository.bulkAssignPermissions(validatedId, permissionIds, user.id);
            
            // Get permission names for response
            const permissions = await prisma.permissions.findMany({
                where: { id: { in: permissionIds } },
                select: { name: true }
            });

            return {
                success: true,
                message: `Assigned ${result.count} permissions to role`,
                data: {
                    role_id: validatedId,
                    assigned_count: result.count,
                    permissions: permissions.map(p => p.name),
                    ...(data.group_id && { group_id: data.group_id })
                }
            };
        } catch (error) {
            console.error('Error in bulkAssignPermissions:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Bulk remove permissions from role
     */
    async bulkRemovePermissions(roleId, data, user) {
        try {
            const validatedId = roleModel.validateRoleId(roleId);
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Check if it's a system role
            if (role.is_system_role && !user.permissions.includes('system.admin')) {
                throw new AppError('Only system admin can modify system role permissions', 403);
            }

            let permissionIds = [];
            
            // If group_id provided, get all permissions from that group
            if (data.group_id) {
                const group = await prisma.permission_groups.findUnique({
                    where: { id: data.group_id },
                    include: {
                        permissions: {
                            select: { id: true }
                        }
                    }
                });

                if (!group) {
                    throw new AppError('Permission group not found', 404);
                }

                permissionIds = group.permissions.map(p => p.id);
            } 
            // Otherwise use provided permission_ids
            else if (data.permission_ids && Array.isArray(data.permission_ids)) {
                permissionIds = data.permission_ids;
            } else {
                throw new AppError('Either group_id or permission_ids must be provided', 400);
            }

            if (permissionIds.length === 0) {
                throw new AppError('No permissions to remove', 400);
            }

            // Bulk delete role_permissions
            const result = await roleRepository.bulkRemovePermissions(validatedId, permissionIds);
            
            // Get remaining permission count
            const remainingCount = await prisma.role_permissions.count({
                where: { role_id: validatedId }
            });

            return {
                success: true,
                message: `Removed ${result.count} permissions from role`,
                data: {
                    role_id: validatedId,
                    removed_count: result.count,
                    remaining_permissions: remainingCount,
                    ...(data.group_id && { group_id: data.group_id })
                }
            };
        } catch (error) {
            console.error('Error in bulkRemovePermissions:', error);
            throw error instanceof AppError ? error : new AppError(error.message, 500);
        }
    }

    /**
     * Update role permissions
     */
    async updateRolePermissions(roleId, permissionIds, user) {
        try {
            // Validate inputs
            const validatedId = roleModel.validateRoleId(roleId);
            const validatedPermissions = roleModel.validatePermissionIds(permissionIds);
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Check if it's a system role
            if (role.is_system_role && !user.permissions.includes('system.admin')) {
                throw new AppError('Only system admin can modify system role permissions', 403);
            }

            // Validate user permissions
            await this.validateUserRoleAccess(user, role.organization_id, 'manage');
            
            // Update role permissions
            const updatedPermissions = await roleRepository.updateRolePermissions(
                validatedId, 
                validatedPermissions, 
                user.id
            );
            
            return {
                success: true,
                message: 'Role permissions updated successfully',
                data: updatedPermissions
            };
        } catch (error) {
            console.error('Error in updateRolePermissions service:', error);
            throw new AppError(error.message || 'Failed to update role permissions', error.statusCode || 500);
        }
    }

    /**
     * Assign permission to role
     */
    async assignPermissionToRole(roleId, permissionId, user) {
        try {
            // Validate inputs
            const validatedRoleId = roleModel.validateRoleId(roleId);
            const validatedPermissionId = roleModel.validatePermissionId(permissionId);
            
            // ✅ Check if trying to assign hidden permission using centralized helper
            const permission = await prisma.permissions.findUnique({
                where: { id: validatedPermissionId },
                select: { name: true }
            });

            if (!permission) {
                throw new AppError('Permission not found', 404);
            }

            // Validate permission can be assigned (throws error if hidden)
            try {
                validatePermissionAssignment(permission.name);
            } catch (error) {
                throw new AppError(error.message, 403);
            }
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedRoleId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Validate user permissions
            await this.validateUserRoleAccess(user, role.organization_id, 'manage');
            
            // Assign permission
            const result = await roleRepository.assignPermissionToRole(
                validatedRoleId, 
                validatedPermissionId, 
                user.id
            );
            
            return {
                success: true,
                message: 'Permission assigned to role successfully',
                data: result
            };
        } catch (error) {
            console.error('Error in assignPermissionToRole service:', error);
            throw new AppError(error.message || 'Failed to assign permission', error.statusCode || 500);
        }
    }

    /**
     * Remove permission from role
     */
    async removePermissionFromRole(roleId, permissionId, user) {
        try {
            // Validate inputs
            const validatedRoleId = roleModel.validateRoleId(roleId);
            const validatedPermissionId = roleModel.validatePermissionId(permissionId);
            
            // Check role access
            const role = await roleRepository.findByIdWithAccess(validatedRoleId, user);
            if (!role) {
                throw new AppError('Role not found or access denied', 404);
            }

            // Validate user permissions
            await this.validateUserRoleAccess(user, role.organization_id, 'manage');
            
            // Remove permission
            await roleRepository.removePermissionFromRole(
                validatedRoleId, 
                validatedPermissionId, 
                user.id
            );
            
            return {
                success: true,
                message: 'Permission removed from role successfully'
            };
        } catch (error) {
            console.error('Error in removePermissionFromRole service:', error);
            throw new AppError(error.message || 'Failed to remove permission', error.statusCode || 500);
        }
    }

    /**
     * Validate user access to role operations
     */
    async validateUserRoleAccess(user, organizationId, action) {
        // System admin has full access
        if (user.permissions.includes('system.admin')) {
            return true;
        }

        // Check role permissions
        const requiredPermission = action === 'create' ? 'role.create' : 'role.manage';
        if (!user.permissions.includes(requiredPermission)) {
            throw new AppError(`Insufficient permissions for ${action} operation`, 403);
        }

        // Check organization access
        if (organizationId && user.organization_id && user.organization_id !== organizationId) {
            throw new AppError('Access denied to this organization', 403);
        }

        return true;
    }

    /**
     * Validate role name uniqueness
     */
    async validateRoleUniqueness(roleData, excludeId = null) {
        const existingRole = await roleRepository.findByNameInOrganization(
            roleData.name,
            roleData.organization_id,
            excludeId
        );

        if (existingRole) {
            throw new AppError('Role name already exists in this organization', 400);
        }
    }

    /**
     * Get role statistics
     */
    async getRoleStats(user) {
        try {
            // Validate user permissions
            if (!user.permissions.includes('role.read')) {
                throw new AppError('Insufficient permissions', 403);
            }

            const stats = await roleRepository.getRoleStatistics(user);
            
            return {
                success: true,
                message: 'Role statistics retrieved successfully',
                data: stats
            };
        } catch (error) {
            console.error('Error in getRoleStats service:', error);
            throw new AppError(error.message || 'Failed to fetch role statistics', error.statusCode || 500);
        }
    }
}

export default new RoleService();