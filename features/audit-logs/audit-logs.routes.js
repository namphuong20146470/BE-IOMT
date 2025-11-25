// features/audit-logs/audit-logs.routes.js
import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import {
    getAllAuditLogs,
    getAuditLogById,
    getUserAuditLogs,
    getResourceAuditLogs,
    deleteAuditLog,
    exportAuditLogs
} from '../../controllers/auditLogs/auditLogsController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         user_id:
 *           type: integer
 *         action:
 *           type: string
 *         resource_type:
 *           type: string
 *         resource_id:
 *           type: integer
 *         old_values:
 *           type: object
 *         new_values:
 *           type: object
 *         ip_address:
 *           type: string
 *         user_agent:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: Get all audit logs
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 */
router.get('/', requirePermission('audit.read'), getAllAuditLogs);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 */
router.get('/:id', requirePermission('audit.read'), getAuditLogById);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   delete:
 *     summary: Delete audit log
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audit log deleted successfully
 */
router.delete('/:id', requirePermission('audit.delete'), deleteAuditLog);

/**
 * @swagger
 * /api/v1/audit-logs/users/{userId}:
 *   get:
 *     summary: Get audit logs for specific user
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User audit logs retrieved successfully
 */
router.get('/users/:userId', requirePermission('audit.read'), getUserAuditLogs);

/**
 * @swagger
 * /api/v1/audit-logs/resources/{resourceType}/{resourceId}:
 *   get:
 *     summary: Get audit logs for specific resource
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resource audit logs retrieved successfully
 */
router.get('/resources/:resourceType/:resourceId', requirePermission('audit.read'), getResourceAuditLogs);

/**
 * @swagger
 * /api/v1/audit-logs/export:
 *   get:
 *     summary: Export audit logs
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Audit logs exported successfully
 */
router.get('/export', requirePermission('audit.export'), exportAuditLogs);

export default router;