import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import {
    assignDirectPermissionsToUser,
    removeDirectPermissionFromUser,
    getUserDirectPermissionsController,
    getUserAllPermissionsController,
    updateDirectPermission,
    bulkAssignDirectPermissions
} from './userPermissions.controller.js';

const router = express.Router();

// Direct permission management routes

// Get user's direct permissions only
router.get('/:userId/permissions', authMiddleware, getUserDirectPermissionsController);

// Get all user permissions (roles + direct)
router.get('/:userId/permissions/all', authMiddleware, getUserAllPermissionsController);

// Assign direct permissions to user
router.post('/:userId/permissions', authMiddleware, assignDirectPermissionsToUser);

// Bulk assign multiple direct permissions
router.post('/:userId/permissions/bulk', authMiddleware, bulkAssignDirectPermissions);

// Update specific direct permission
router.put('/:userId/permissions/:permissionId', authMiddleware, updateDirectPermission);

// Remove direct permission from user
router.delete('/:userId/permissions/:permissionId', authMiddleware, removeDirectPermissionFromUser);

export default router;