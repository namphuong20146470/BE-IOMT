import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import * as rolesController from '../controllers/roles/roles.controller.js';

const router = express.Router();

// ==========================================
// CORE ROLE OPERATIONS
// ==========================================

/**
 * @route GET /auth/roles
 * @desc Get roles for organization
 * @access Private - requires 'role.read' permission
 */
router.get('/roles', authMiddleware, rolesController.getAllRoles);

/**
 * @route GET /auth/roles/:id
 * @desc Get role by ID
 * @access Private - requires 'role.read' permission
 */
router.get('/roles/:id', authMiddleware, rolesController.getRoleById);

/**
 * @route POST /auth/roles
 * @desc Create new role
 * @access Private - requires 'role.create' permission
 */
router.post('/roles', authMiddleware, rolesController.createRole);

/**
 * @route PUT /auth/roles/:id
 * @desc Update role
 * @access Private - requires 'role.update' permission
 */
router.put('/roles/:id', authMiddleware, rolesController.updateRole);

/**
 * @route DELETE /auth/roles/:id
 * @desc Delete role
 * @access Private - requires 'role.delete' permission
 */
router.delete('/roles/:id', authMiddleware, rolesController.deleteRole);

// ==========================================
// ROLE ASSIGNMENT OPERATIONS
// ==========================================

/**
 * @route POST /auth/roles/assign
 * @desc Assign role to user
 * @access Private - requires 'role.assign' permission
 */
router.post('/roles/assign', authMiddleware, rolesController.assignRoleToUser);

/**
 * @route GET /auth/roles/stats
 * @desc Get role statistics
 * @access Private - requires 'role.read' permission
 */
router.get('/roles/stats', authMiddleware, rolesController.getRoleStats);

/**
 * @route GET /auth/roles/users/:userId
 * @desc Get user's active roles
 * @access Private - requires 'user.read' permission
 */
router.get('/roles/users/:userId', authMiddleware, rolesController.getUserActiveRoles);

export default router;