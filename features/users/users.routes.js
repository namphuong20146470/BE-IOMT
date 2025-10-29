import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../shared/middleware/rbacMiddleware.js';
import {
    // CRUD Operations
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    
    // Profile & Status
    getUserProfile,
    getUserSessions,
    deactivateUser,
    activateUser,
    resetUserPassword,
    
    // Admin Operations
    searchUsers,
    getUserStatistics,
    exportUsers,
    bulkUpdateUsers,
    deleteAllUsersExceptAdmin
} from './controllers/index.js';

// Permission Management (Micro-controllers)
import {
    // Role Management
    getUserRoles,
    assignRolesToUser,
    removeRoleFromUser,
    
    // Direct Permissions
    assignDirectPermissionToUser,
    getUserDirectPermissions,
    removeDirectPermissionFromUser,
    
    // Debug & Testing
    debugUserPermissions,
    testUserPermission
} from './controllers/user-permissions.index.js';

const router = express.Router();

// ======================
// USER MANAGEMENT ROUTES
// ======================

// Get all users (with filtering and pagination)
router.get('/', authMiddleware, requirePermission('user.read'), getAllUsers);

// Get specific user by ID (full info - admin only)
router.get('/:userId', authMiddleware, requirePermission('user.read'), getUserById);

// Get user profile (safe for viewing by others)
router.get('/:userId/profile', authMiddleware, getUserProfile);

// Create new user
router.post('/', authMiddleware, requirePermission('user.create'), createUser);

// Update user info
router.put('/:userId', authMiddleware, requirePermission('user.update'), updateUser);

// Delete user (soft delete)
router.delete('/:userId', authMiddleware, requirePermission('user.delete'), deleteUser);

// ======================
// USER PERMISSION MANAGEMENT
// ======================

// Get user roles
router.get('/:userId/roles', authMiddleware, requirePermission('user.read'), getUserRoles);

// Assign role to user
router.post('/:userId/roles', authMiddleware, requirePermission('role.assign'), assignRolesToUser);

// Remove role from user
router.delete('/:userId/roles/:roleId', authMiddleware, requirePermission('role.assign'), removeRoleFromUser);

// Get user direct permissions
router.get('/:userId/permissions', authMiddleware, requirePermission('user.read'), getUserDirectPermissions);

// Assign direct permission to user
router.post('/:userId/permissions', authMiddleware, requirePermission('permission.assign'), assignDirectPermissionToUser);

// Remove direct permission from user
router.delete('/:userId/permissions/:permissionId', authMiddleware, requirePermission('permission.assign'), removeDirectPermissionFromUser);

// Debug user permissions (development/troubleshooting)
router.get('/:userId/permissions/debug', authMiddleware, requirePermission('user.read'), debugUserPermissions);

// Test specific permission for user
router.post('/:userId/permissions/test', authMiddleware, requirePermission('user.read'), testUserPermission);

// ======================
// USER SESSION MANAGEMENT
// ======================

// Get user active sessions
router.get('/:userId/sessions', authMiddleware, getUserSessions);

// ======================
// USER STATUS MANAGEMENT
// ======================

// Deactivate user
router.patch('/:userId/deactivate', authMiddleware, requirePermission('user.manage'), deactivateUser);

// Activate user
router.patch('/:userId/activate', authMiddleware, requirePermission('user.manage'), activateUser);

// Reset user password (admin function)
router.patch('/:userId/reset-password', authMiddleware, requirePermission('user.manage'), resetUserPassword);

// ======================
// ADMIN OPERATIONS
// ======================

// Search users
router.post('/search', authMiddleware, requirePermission('user.read'), searchUsers);

// Get user statistics
router.get('/statistics', authMiddleware, requirePermission('user.read'), getUserStatistics);

// Export users data
router.get('/export', authMiddleware, requirePermission('user.read'), exportUsers);

// Bulk update users
router.patch('/bulk-update', authMiddleware, requirePermission('user.update'), bulkUpdateUsers);

// Delete all users except admin (dangerous!)
router.delete('/all-except-admin', authMiddleware, requirePermission('user.delete'), deleteAllUsersExceptAdmin);

export default router;