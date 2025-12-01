// features/roles/routes.js
import express from 'express';
import roleController from './role.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Role management routes
router.get('/', requirePermission('role.read'), roleController.getAllRoles);
router.get('/stats', requirePermission('role.read'), roleController.getRoleStats);
router.get('/:roleId', requirePermission('role.read'), roleController.getRoleById);
router.post('/', requirePermission('role.create'), roleController.createRole);
router.put('/:roleId', requirePermission('role.update'), roleController.updateRole);
router.delete('/:roleId', requirePermission('role.delete'), roleController.deleteRole);

// Role permissions management
router.get('/:roleId/permissions', requirePermission('role.read'), roleController.getRolePermissions);
router.put('/:roleId/permissions', requirePermission('role.manage_permissions'), roleController.updateRolePermissions);
router.post('/:roleId/permissions', requirePermission('role.manage_permissions'), roleController.assignPermissionToRole);
router.delete('/:roleId/permissions/:permissionId', requirePermission('role.manage_permissions'), roleController.removePermissionFromRole);

export default router;
