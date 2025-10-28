// Permission Helper Utils
// Centralized functions for permission and admin checks

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Safely get user permissions
 * @param {Object} user - User object from JWT
 * @returns {Array} Array of permission names
 */
export function getUserPermissions(user) {
    return Array.isArray(user?.permissions) ? user.permissions : [];
}

/**
 * Get ALL user permissions (from roles + direct assignments)
 * @param {string} userId - User ID
 * @returns {Array} Combined permissions from roles and direct assignments
 */
export async function getUserAllPermissions(userId) {
    try {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
                // Permissions from roles
                user_roles: {
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
                },
                // Direct permissions
                user_permissions: {
                    where: {
                        is_active: true,
                        OR: [
                            { valid_until: null },
                            { valid_until: { gte: new Date() } }
                        ]
                    },
                    include: {
                        permissions: true
                    }
                }
            }
        });

        if (!user) return [];

        const allPermissions = new Set();

        // Add permissions from roles
        user.user_roles.forEach(userRole => {
            userRole.roles.role_permissions.forEach(rolePermission => {
                allPermissions.add(rolePermission.permissions.name);
            });
        });

        // Add direct permissions
        user.user_permissions.forEach(userPermission => {
            allPermissions.add(userPermission.permissions.name);
        });

        return Array.from(allPermissions);
    } catch (error) {
        console.error('Error getting user permissions:', error);
        return [];
    }
}

/**
 * Check if user has specific permission (enhanced with database lookup)
 * @param {Object|string} userOrId - User object from JWT or user ID
 * @param {string} permission - Permission name to check
 * @returns {boolean} True if user has permission
 */
export async function hasPermissionEnhanced(userOrId, permission) {
    try {
        // If user object is passed with permissions array
        if (typeof userOrId === 'object' && userOrId?.permissions) {
            return getUserPermissions(userOrId).includes(permission);
        }

        // If user ID is passed, fetch from database
        const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
        if (!userId) return false;

        const allPermissions = await getUserAllPermissions(userId);
        return allPermissions.includes(permission);
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Get user's direct permissions only
 * @param {string} userId - User ID
 * @returns {Array} Array of direct permission objects
 */
export async function getUserDirectPermissions(userId) {
    try {
        const directPermissions = await prisma.user_permissions.findMany({
            where: {
                user_id: userId,
                is_active: true,
                OR: [
                    { valid_until: null },
                    { valid_until: { gte: new Date() } }
                ]
            },
            include: {
                permissions: true,
                granted_by_user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true
                    }
                }
            }
        });

        return directPermissions.map(up => ({
            permission: up.permissions,
            granted_by: up.granted_by_user,
            granted_at: up.granted_at,
            valid_from: up.valid_from,
            valid_until: up.valid_until,
            notes: up.notes
        }));
    } catch (error) {
        console.error('Error getting direct permissions:', error);
        return [];
    }
}

/**
 * Get user permissions grouped by source (roles vs direct)
 * @param {string} userId - User ID
 * @returns {Object} Permissions grouped by source
 */
export async function getUserPermissionsBySource(userId) {
    try {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
                user_roles: {
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
                },
                user_permissions: {
                    where: {
                        is_active: true,
                        OR: [
                            { valid_until: null },
                            { valid_until: { gte: new Date() } }
                        ]
                    },
                    include: {
                        permissions: true,
                        granted_by_user: {
                            select: { full_name: true, email: true }
                        }
                    }
                }
            }
        });

        if (!user) return { rolePermissions: [], directPermissions: [], allPermissions: [] };

        // Role-based permissions
        const rolePermissions = [];
        const rolePermissionNames = new Set();
        user.user_roles.forEach(userRole => {
            userRole.roles.role_permissions.forEach(rolePermission => {
                if (!rolePermissionNames.has(rolePermission.permissions.name)) {
                    rolePermissions.push({
                        permission: rolePermission.permissions,
                        source: 'role',
                        role: userRole.roles
                    });
                    rolePermissionNames.add(rolePermission.permissions.name);
                }
            });
        });

        // Direct permissions
        const directPermissions = user.user_permissions.map(up => ({
            permission: up.permissions,
            source: 'direct',
            granted_by: up.granted_by_user,
            granted_at: up.granted_at,
            valid_until: up.valid_until,
            notes: up.notes
        }));

        // All unique permissions
        const allPermissionNames = new Set([
            ...rolePermissions.map(rp => rp.permission.name),
            ...directPermissions.map(dp => dp.permission.name)
        ]);

        return {
            rolePermissions,
            directPermissions,
            allPermissions: Array.from(allPermissionNames)
        };
    } catch (error) {
        console.error('Error getting permissions by source:', error);
        return { rolePermissions: [], directPermissions: [], allPermissions: [] };
    }
}

/**
 * Check if user has specific permission
 * @param {Object} user - User object from JWT
 * @param {string} permission - Permission name to check
 * @returns {boolean} True if user has permission
 */
export function hasPermission(user, permission) {
    const permissions = getUserPermissions(user);
    return permissions.includes(permission);
}

/**
 * Check if user is System Admin
 * System Admin = has 'system.admin' permission
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if user is system admin
 */
export function isSystemAdmin(user) {
    return hasPermission(user, 'system.admin');
}

/**
 * Check if user is Organization Admin
 * Org Admin = has 'organization.manage' permission
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if user is organization admin
 */
export function isOrganizationAdmin(user) {
    return hasPermission(user, 'organization.manage');
}

/**
 * Check if user is Department Admin
 * Dept Admin = has 'department.manage' permission
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if user is department admin
 */
export function isDepartmentAdmin(user) {
    return hasPermission(user, 'department.manage');
}

/**
 * Get user access level
 * @param {Object} user - User object from JWT
 * @returns {string} 'system' | 'organization' | 'department' | 'user'
 */
export function getUserAccessLevel(user) {
    if (isSystemAdmin(user)) return 'system';
    if (isOrganizationAdmin(user)) return 'organization'; 
    if (isDepartmentAdmin(user)) return 'department';
    return 'user';
}

/**
 * Check if user can access cross-organization data
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if user can access cross-org data
 */
export function canAccessCrossOrganization(user) {
    return isSystemAdmin(user);
}

/**
 * Check if user can access cross-department data
 * @param {Object} user - User object from JWT  
 * @returns {boolean} True if user can access cross-dept data
 */
export function canAccessCrossDepartment(user) {
    return isSystemAdmin(user) || isOrganizationAdmin(user);
}

/**
 * Get effective organization ID for queries
 * @param {Object} user - User object from JWT
 * @param {string} requestedOrgId - Requested organization ID from request
 * @returns {string|null} Organization ID to use for queries, null for system admin
 */
export function getEffectiveOrganizationId(user, requestedOrgId) {
    if (isSystemAdmin(user)) {
        // System admin can query any org or all orgs (null)
        return requestedOrgId || null;
    }
    
    // Non-system admin must use their own org
    return user?.organization_id || null;
}

/**
 * Get effective department ID for queries
 * @param {Object} user - User object from JWT
 * @param {string} requestedDeptId - Requested department ID from request
 * @returns {string|null} Department ID to use for queries
 */
export function getEffectiveDepartmentId(user, requestedDeptId) {
    if (isSystemAdmin(user) || isOrganizationAdmin(user)) {
        // System/Org admin can query any dept in their scope
        return requestedDeptId || null;
    }
    
    // Department admin/user must use their own dept
    return user?.department_id || null;
}

/**
 * Validate organization access
 * @param {Object} user - User object from JWT
 * @param {string} targetOrgId - Target organization ID
 * @returns {Object} { allowed: boolean, message?: string }
 */
export function validateOrganizationAccess(user, targetOrgId) {
    if (isSystemAdmin(user)) {
        return { allowed: true };
    }
    
    if (!targetOrgId) {
        return { allowed: false, message: 'Organization ID is required' };
    }
    
    if (targetOrgId !== user?.organization_id) {
        return { 
            allowed: false, 
            message: 'Access denied: Cannot access different organization' 
        };
    }
    
    return { allowed: true };
}

/**
 * Validate department access
 * @param {Object} user - User object from JWT
 * @param {string} targetDeptId - Target department ID
 * @returns {Object} { allowed: boolean, message?: string }
 */
export function validateDepartmentAccess(user, targetDeptId) {
    if (isSystemAdmin(user) || isOrganizationAdmin(user)) {
        return { allowed: true };
    }
    
    if (!targetDeptId) {
        return { allowed: false, message: 'Department ID is required' };
    }
    
    if (targetDeptId !== user?.department_id) {
        return { 
            allowed: false, 
            message: 'Access denied: Cannot access different department' 
        };
    }
    
    return { allowed: true };
}