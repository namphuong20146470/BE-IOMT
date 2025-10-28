import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/middleware/rbacMiddleware.js';
import {
    getAllUsers,
    getUserById,
    getUserProfile,
    createUser,
    updateUser,
    deleteUser,
    assignRolesToUser,
    removeRoleFromUser,
    getUserRoles,
    getUserSessions,
    deactivateUser,
    activateUser,
    resetUserPassword
} from './user.controller.js';

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
// USER ROLE MANAGEMENT
// ======================

// Get user roles
router.get('/:userId/roles', authMiddleware, requirePermission('user.read'), getUserRoles);

// Assign roles to user
router.post('/:userId/roles', authMiddleware, requirePermission('role.assign'), assignRolesToUser);

// Remove role from user
router.delete('/:userId/roles/:roleId', authMiddleware, requirePermission('role.assign'), removeRoleFromUser);

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

export default router;