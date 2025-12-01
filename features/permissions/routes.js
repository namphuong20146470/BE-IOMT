// features/permissions/routes.js
import express from 'express';
import permissionController from './permission.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Permission management routes
router.get('/', requirePermission('permission.read'), permissionController.getAllPermissions);
router.get('/stats', requirePermission('permission.read'), permissionController.getPermissionStats);
router.get('/categories', requirePermission('permission.read'), permissionController.getCategories);
router.get('/actions', requirePermission('permission.read'), permissionController.getActions);
router.get('/hierarchy', requirePermission('permission.read'), permissionController.getPermissionsHierarchy);
router.get('/search', requirePermission('permission.read'), permissionController.searchPermissions);

// Permission CRUD operations
router.get('/:permissionId', requirePermission('permission.read'), permissionController.getPermissionById);
router.post('/', requirePermission('permission.create'), permissionController.createPermission);
router.put('/:permissionId', requirePermission('permission.update'), permissionController.updatePermission);
router.delete('/:permissionId', requirePermission('permission.delete'), permissionController.deletePermission);

// Permission category operations
router.get('/category/:category', requirePermission('permission.read'), permissionController.getPermissionsByCategory);

// Permission validation
router.post('/:permissionId/validate', requirePermission('permission.read'), permissionController.validatePermissionAssignment);

// Legacy compatibility routes (deprecated)
router.get('/groups', permissionController.getPermissionGroups);
router.get('/roles/:roleId', permissionController.getPermissionsForRole);

export default router;
