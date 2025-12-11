/**
 * Permission Groups Routes
 * RESTful API endpoints for permission group management
 */

import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import permissionGroupController from './permission-groups.controller.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route GET /api/v1/permission-groups
 * @desc Get all permission groups
 * @query include_permissions - Include full permission details (default: false)
 * @query is_active - Filter by active status
 * @query page - Page number
 * @query limit - Items per page
 * @access Private - requires 'permission.read'
 */
router.get('/',
    requirePermission('permission.read'),
    permissionGroupController.getAllPermissionGroups
);

/**
 * @route GET /api/v1/permission-groups/statistics
 * @desc Get permission group statistics
 * @access Private - requires 'permission.read'
 */
router.get('/statistics',
    requirePermission('permission.read'),
    permissionGroupController.getGroupStatistics
);

/**
 * @route GET /api/v1/permission-groups/:id
 * @desc Get permission group by ID
 * @query include_permissions - Include permissions (default: true)
 * @access Private - requires 'permission.read'
 */
router.get('/:id',
    requirePermission('permission.read'),
    permissionGroupController.getPermissionGroupById
);

/**
 * @route POST /api/v1/permission-groups
 * @desc Create new permission group
 * @body { name, description, color, icon, sort_order, is_active }
 * @access Private - requires 'permission.create'
 */
router.post('/',
    requirePermission('permission.create'),
    permissionGroupController.createPermissionGroup
);

/**
 * @route PUT /api/v1/permission-groups/:id
 * @desc Update permission group
 * @body { name, description, color, icon, sort_order, is_active }
 * @access Private - requires 'permission.update'
 */
router.put('/:id',
    requirePermission('permission.update'),
    permissionGroupController.updatePermissionGroup
);

/**
 * @route DELETE /api/v1/permission-groups/:id
 * @desc Delete permission group (only if no permissions assigned)
 * @access Private - requires 'permission.delete'
 */
router.delete('/:id',
    requirePermission('permission.delete'),
    permissionGroupController.deletePermissionGroup
);

export default router;
