import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
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
} from '../controllers/users/user.controller.js';

const router = express.Router();

// ======================
// USER MANAGEMENT ROUTES
// ======================

// Get all users (with filtering and pagination)
router.get('/', authMiddleware, getAllUsers);

// Get specific user by ID (full info - admin only)
router.get('/:userId', authMiddleware, getUserById);

// Get user profile (safe for viewing by others)
router.get('/:userId/profile', authMiddleware, getUserProfile);

// Create new user
router.post('/', authMiddleware, createUser);

// Update user info
router.put('/:userId', authMiddleware, updateUser);

// Delete user (soft delete)
router.delete('/:userId', authMiddleware, deleteUser);

// ======================
// USER ROLE MANAGEMENT
// ======================

// Get user roles
router.get('/:userId/roles', authMiddleware, getUserRoles);

// Assign roles to user
router.post('/:userId/roles', authMiddleware, assignRolesToUser);

// Remove role from user
router.delete('/:userId/roles/:roleId', authMiddleware, removeRoleFromUser);

// ======================
// USER SESSION MANAGEMENT
// ======================

// Get user active sessions
router.get('/:userId/sessions', authMiddleware, getUserSessions);

// ======================
// USER STATUS MANAGEMENT
// ======================

// Deactivate user
router.patch('/:userId/deactivate', authMiddleware, deactivateUser);

// Activate user
router.patch('/:userId/activate', authMiddleware, activateUser);

// Reset user password (admin function)
router.patch('/:userId/reset-password', authMiddleware, resetUserPassword);

export default router;