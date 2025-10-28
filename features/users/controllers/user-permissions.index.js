/**
 * 📋 User Permission Controllers Index
 * Exports all micro-controllers for user permission management
 */

// Direct Permission Management
export { 
    assignDirectPermissionToUser,
    getUserDirectPermissions,
    removeDirectPermissionFromUser 
} from './user-direct-permissions.controller.js';

// Role Management  
export {
    assignRolesToUser,
    removeRoleFromUser,
    getUserRoles
} from './user-roles.controller.js';

// Debug & Testing
export {
    debugUserPermissions,
    testUserPermission
} from './user-debug.controller.js';