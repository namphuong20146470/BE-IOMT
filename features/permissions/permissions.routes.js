// features/permissions/permissions.routes.js
import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import {
    getAllPermissions,
    createPermission,
    getPermissionById,
    updatePermission,
    deletePermission,
    getAllPermissionGroups,
    createPermissionGroup
} from '../../controllers/permission/permissionController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         resource:
 *           type: string
 *         action:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *     
 *     PermissionGroup:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: Get all permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 */
router.get('/', requirePermission('permission.read'), getAllPermissions);

/**
 * @swagger
 * /api/v1/permissions:
 *   post:
 *     summary: Create new permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Permission'
 *     responses:
 *       201:
 *         description: Permission created successfully
 */
router.post('/', requirePermission('permission.create'), createPermission);

/**
 * @swagger
 * /api/v1/permissions/{permissionId}:
 *   get:
 *     summary: Get permission by ID
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Permission retrieved successfully
 */
router.get('/:permissionId', requirePermission('permission.read'), getPermissionById);

/**
 * @swagger
 * /api/v1/permissions/{permissionId}:
 *   put:
 *     summary: Update permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Permission'
 *     responses:
 *       200:
 *         description: Permission updated successfully
 */
router.put('/:permissionId', requirePermission('permission.update'), updatePermission);

/**
 * @swagger
 * /api/v1/permissions/{permissionId}:
 *   delete:
 *     summary: Delete permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Permission deleted successfully
 */
router.delete('/:permissionId', requirePermission('permission.delete'), deletePermission);

// Permission Groups
/**
 * @swagger
 * /api/v1/permissions/groups:
 *   get:
 *     summary: Get all permission groups
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission groups retrieved successfully
 */
router.get('/groups', requirePermission('permission.read'), getAllPermissionGroups);

/**
 * @swagger
 * /api/v1/permissions/groups:
 *   post:
 *     summary: Create new permission group
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionGroup'
 *     responses:
 *       201:
 *         description: Permission group created successfully
 */
router.post('/groups', requirePermission('permission.create'), createPermissionGroup);

export default router;