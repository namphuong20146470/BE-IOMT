// Permission Helper Utils
// Centralized functions for permission and admin checks

/**
 * Safely get user permissions
 * @param {Object} user - User object from JWT
 * @returns {Array} Array of permission names
 */
export function getUserPermissions(user) {
    return Array.isArray(user?.permissions) ? user.permissions : [];
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