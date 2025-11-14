/**
 * 📋 User Controllers Index
 * Central export point for all user-related controllers
 * 
 * This file aggregates all micro-controllers into a single import point
 * to maintain backward compatibility and clean imports
 */

// CRUD Operations
export {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} from './user-crud.controller.js';

// Role Management  
export {
    getUserRoles,
    assignRolesToUser,
    removeRoleFromUser
} from './user-roles.controller.js';

// Permission Management (compatibility aliases)
export {
    assignPermissionToUser,
    getUserPermissions
} from './user-direct-permissions.controller.js';

// Note: logoutUser should be moved to auth feature
// TODO: Move logoutUser from actLog.js to auth controller

// Profile & Status Management
export {
    getUserProfile,
    getUserSessions,
    deactivateUser,
    activateUser,
    resetUserPassword,
    terminateSession,
    getSessionStatistics
} from './user-profile.controller.js';

// Admin & Statistics
export {
    searchUsers,
    getUserStatistics,
    exportUsers,
    bulkUpdateUsers,
    deleteAllUsersExceptAdmin
} from './user-admin.controller.js';