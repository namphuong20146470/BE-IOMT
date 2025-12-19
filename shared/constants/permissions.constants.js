/**
 * Permission Constants
 * Single source of truth for permission configurations
 */

// ==========================================
// HIDDEN PERMISSIONS
// ==========================================

/**
 * Permissions that should be hidden from UI and cannot be assigned via API
 * These are super-admin level permissions that should only be managed directly in DB
 */
export const HIDDEN_PERMISSIONS = [
    'system.admin'  // Super admin permission - cannot be assigned via UI
];

/**
 * System-level permissions (for future use)
 * These permissions are for system operations only
 */
export const SYSTEM_PERMISSIONS = [
    'system.admin',
    // Add more system permissions here as needed
    // 'system.root',
    // 'system.debug'
];

// ==========================================
// PERMISSION LEVELS (for future role-based filtering)
// ==========================================
export const PERMISSION_LEVELS = {
    SYSTEM: 100,      // system.admin
    SUPER_ADMIN: 90,  // High-level admin
    ADMIN: 50,        // Organization admin
    MANAGER: 30,      // Department manager
    USER: 10          // Basic user
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if a permission should be hidden from UI listing
 * @param {string} permissionName - Permission name/key to check
 * @returns {boolean} True if permission should be hidden
 */
export const isHiddenPermission = (permissionName) => {
    return HIDDEN_PERMISSIONS.includes(permissionName);
};

/**
 * Check if a permission is a system permission
 * @param {string} permissionName - Permission name/key to check
 * @returns {boolean} True if permission is system-level
 */
export const isSystemPermission = (permissionName) => {
    return SYSTEM_PERMISSIONS.includes(permissionName);
};

/**
 * Check if a permission can be assigned via API
 * @param {string} permissionName - Permission name/key to check
 * @returns {boolean} True if permission can be assigned
 */
export const isAssignablePermission = (permissionName) => {
    return !HIDDEN_PERMISSIONS.includes(permissionName);
};

/**
 * Filter out hidden permissions from an array of permissions
 * @param {Array} permissions - Array of permission objects
 * @returns {Array} Filtered array without hidden permissions
 */
export const filterHiddenPermissions = (permissions) => {
    if (!Array.isArray(permissions)) {
        return [];
    }
    
    return permissions.filter(permission => {
        const permName = permission.name || permission.key || permission.permission_name;
        return !isHiddenPermission(permName);
    });
};

/**
 * Validate permission assignment - throws error if trying to assign hidden permission
 * @param {string} permissionName - Permission name to validate
 * @throws {Error} If permission cannot be assigned
 */
export const validatePermissionAssignment = (permissionName) => {
    if (isHiddenPermission(permissionName)) {
        throw new Error(`Permission '${permissionName}' cannot be assigned via API`);
    }
};

// ==========================================
// EXPORT ALL
// ==========================================
export default {
    HIDDEN_PERMISSIONS,
    SYSTEM_PERMISSIONS,
    PERMISSION_LEVELS,
    isHiddenPermission,
    isSystemPermission,
    isAssignablePermission,
    filterHiddenPermissions,
    validatePermissionAssignment
};
