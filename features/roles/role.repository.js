// features/roles/role.repository.js
import prisma from '../../config/db.js';

class RoleRepository {
    /**
     * Find accessible roles with filtering
     */
    async findAccessibleRoles(user, query) {
        const {
            page = 1,
            limit = 20,
            organization_id,
            include_system = true,
            include_permissions = false,
            search,
            sort_by = 'name',
            sort_order = 'asc'
        } = query;

        // Ensure numeric values
        const numericPage = parseInt(page) || 1;
        const numericLimit = parseInt(limit) || 20;
        const offset = (numericPage - 1) * numericLimit;

        // Build where clause based on user access
        let whereClause = {};

        // Organization filtering
        if (organization_id) {
            whereClause.organization_id = parseInt(organization_id);
        } else if (user.organization_id && !user.permissions.includes('system.admin')) {
            whereClause.organization_id = user.organization_id;
        }

        // System roles filtering
        if (!include_system && !user.permissions.includes('system.admin')) {
            whereClause.is_system_role = false;
        }

        // Search filtering
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get total count
        const total = await prisma.roles.count({ where: whereClause });

        // Build include clause conditionally
        const include = {
            organizations: {
                select: { id: true, name: true }
            },
            _count: {
                select: {
                    user_roles: true
                }
            }
        };

        // Only include role_permissions if requested
        if (include_permissions === true) {
            include.role_permissions = {
                include: {
                    permissions: {
                        select: { id: true, name: true, description: true }
                    }
                }
            };
        }

        // Get roles with pagination
        const roles = await prisma.roles.findMany({
            where: whereClause,
            include,
            orderBy: { [sort_by]: sort_order },
            skip: offset,
            take: numericLimit
        });

        return {
            data: roles,
            pagination: {
                page: numericPage,
                limit: numericLimit,
                total,
                pages: Math.ceil(total / numericLimit)
            },
            filters: {
                organization_id,
                include_system,
                search
            }
        };
    }

    /**
     * Find role by ID with access control
     */
    async findByIdWithAccess(roleId, user, options = {}) {
        const { include_permissions = false, include_users = false } = options;

        const include = {
            organizations: {
                select: { id: true, name: true }
            }
        };

        if (include_permissions) {
            include.role_permissions = {
                include: {
                    permissions: true
                }
            };
        }

        if (include_users) {
            include.user_roles = {
                include: {
                    user: {
                        select: { id: true, username: true, email: true }
                    }
                }
            };
        }

        const role = await prisma.roles.findUnique({
            where: { id: roleId },
            include
        });

        if (!role) {
            return null;
        }

        // Check access permissions
        if (!user.permissions.includes('system.admin')) {
            // User can only access roles in their organization
            if (role.organization_id && user.organization_id !== role.organization_id) {
                return null;
            }
            
            // Non-admin users cannot access system roles
            if (role.is_system_role && !user.permissions.includes('role.read')) {
                return null;
            }
        }

        return role;
    }

    /**
     * Create new role
     */
    async create(roleData, userId) {
        return await prisma.roles.create({
            data: {
                ...roleData,
                created_by: userId,
                updated_by: userId
            },
            include: {
                organizations: {
                    select: { id: true, name: true }
                }
            }
        });
    }

    /**
     * Update role
     */
    async update(roleId, updateData, userId) {
        return await prisma.roles.update({
            where: { id: roleId },
            data: {
                ...updateData,
                updated_by: userId,
                updated_at: new Date()
            },
            include: {
                organizations: {
                    select: { id: true, name: true }
                },
                role_permissions: {
                    include: {
                        permissions: true
                    }
                }
            }
        });
    }

    /**
     * Delete role
     */
    async delete(roleId, userId) {
        // First remove all role permissions
        await prisma.role_permissions.deleteMany({
            where: { role_id: roleId }
        });

        // Then delete the role
        return await prisma.roles.delete({
            where: { id: roleId }
        });
    }

    /**
     * Check if role has active user assignments
     */
    async hasActiveUserAssignments(roleId) {
        const count = await prisma.user_roles.count({
            where: { role_id: roleId }
        });
        return count > 0;
    }

    /**
     * Find role by name in organization
     */
    async findByNameInOrganization(name, organizationId, excludeId = null) {
        const whereClause = {
            name,
            organization_id: organizationId
        };

        if (excludeId) {
            whereClause.id = { not: excludeId };
        }

        return await prisma.roles.findFirst({
            where: whereClause
        });
    }

    /**
     * Get role permissions
     */
    async getRolePermissions(roleId) {
        const rolePermissions = await prisma.role_permissions.findMany({
            where: { role_id: roleId },
            include: {
                permissions: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        resource: true,
                        action: true
                    }
                }
            }
        });

        return rolePermissions.map(rp => rp.permission);
    }

    /**
     * Update role permissions (replace all)
     */
    async updateRolePermissions(roleId, permissionIds, userId) {
        return await prisma.$transaction(async (tx) => {
            // Remove existing permissions
            await tx.role_permissions.deleteMany({
                where: { role_id: roleId }
            });

            // Add new permissions
            if (permissionIds.length > 0) {
                const rolePermissions = permissionIds.map(permissionId => ({
                    role_id: roleId,
                    permission_id: permissionId,
                    assigned_by: userId
                }));

                await tx.role_permissions.createMany({
                    data: rolePermissions
                });
            }

            // Return updated permissions
            return await tx.role_permissions.findMany({
                where: { role_id: roleId },
                include: {
                    permissions: true
                }
            });
        });
    }

    /**
     * Assign single permission to role
     */
    async assignPermissionToRole(roleId, permissionId, userId) {
        // Check if already assigned
        const existing = await prisma.role_permissions.findUnique({
            where: {
                role_id_permission_id: {
                    role_id: roleId,
                    permission_id: permissionId
                }
            }
        });

        if (existing) {
            throw new Error('Permission already assigned to role');
        }

        return await prisma.role_permissions.create({
            data: {
                role_id: roleId,
                permission_id: permissionId,
                assigned_by: userId
            },
            include: {
                permissions: true
            }
        });
    }

    /**
     * Remove permission from role
     */
    async removePermissionFromRole(roleId, permissionId, userId) {
        return await prisma.role_permissions.delete({
            where: {
                role_id_permission_id: {
                    role_id: roleId,
                    permission_id: permissionId
                }
            }
        });
    }

    /**
     * Get role statistics
     */
    async getRoleStatistics(user) {
        const whereClause = {};

        // Filter by user organization if not system admin
        if (!user.permissions.includes('system.admin') && user.organization_id) {
            whereClause.organization_id = user.organization_id;
        }

        const [
            totalRoles,
            systemRoles,
            customRoles,
            rolesWithUsers,
            organizationRoles
        ] = await Promise.all([
            // Total roles
            prisma.roles.count({ where: whereClause }),
            
            // System roles
            prisma.roles.count({
                where: { ...whereClause, is_system_role: true }
            }),
            
            // Custom roles
            prisma.roles.count({
                where: { ...whereClause, is_system_role: false }
            }),
            
            // Roles with active users
            prisma.roles.count({
                where: {
                    ...whereClause,
                    user_roles: { some: {} }
                }
            }),
            
            // Roles by organization (if system admin)
            user.permissions.includes('system.admin') ? 
                prisma.roles.groupBy({
                    by: ['organization_id'],
                    where: whereClause,
                    _count: { id: true }
                }) : []
        ]);

        return {
            totalRoles,
            systemRoles,
            customRoles,
            rolesWithUsers,
            rolesWithoutUsers: totalRoles - rolesWithUsers,
            organizationBreakdown: organizationRoles
        };
    }
}

export default new RoleRepository();