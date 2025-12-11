// features/maintenance/maintenance-logs.routes.js
import express from 'express';
import {
    createMaintenanceLog,
    getAllMaintenanceLogs,
    getMaintenanceLog,
    updateMaintenanceLog,
    deleteMaintenanceLog,
    createMaintenanceJob,
    getStatistics,
    getDeviceHistory,
    captureCurrentMetrics
} from './maintenance-logs.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     MaintenanceLog:
 *       type: object
 *       required:
 *         - device_id
 *         - title
 *         - maintenance_type
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         ticket_number:
 *           type: string
 *           example: MT-20251209-0001
 *         device_id:
 *           type: string
 *           format: uuid
 *         socket_id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         maintenance_type:
 *           type: string
 *           enum: [preventive, corrective, emergency, calibration]
 *         severity:
 *           type: string
 *           enum: [routine, urgent, emergency]
 *         status:
 *           type: string
 *           enum: [completed, failed, partial, cancelled]
 *         customer_issue:
 *           type: string
 *         technician_issue:
 *           type: string
 *         initial_voltage:
 *           type: number
 *         initial_current:
 *           type: number
 *         initial_power:
 *           type: number
 *         final_voltage:
 *           type: number
 *         final_current:
 *           type: number
 *         final_power:
 *           type: number
 *         start_time:
 *           type: string
 *           format: date-time
 *         end_time:
 *           type: string
 *           format: date-time
 *         duration_minutes:
 *           type: integer
 *         performed_by:
 *           type: string
 *           format: uuid
 *         conclusion:
 *           type: string
 *         root_cause:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/maintenance-logs:
 *   post:
 *     summary: Create new maintenance log
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaintenanceLog'
 *     responses:
 *       201:
 *         description: Maintenance log created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', requirePermission('maintenance.create'), createMaintenanceLog);

/**
 * @swagger
 * /api/v1/maintenance-logs:
 *   get:
 *     summary: Get all maintenance logs with filters
 *     tags: [Maintenance Logs]
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
 *           default: 20
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: maintenance_type
 *         schema:
 *           type: string
 *           enum: [preventive, corrective, emergency, calibration]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, failed, partial, cancelled]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: include_jobs
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: include_parts
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Maintenance logs retrieved successfully
 */
router.get('/', requirePermission('maintenance.read'), getAllMaintenanceLogs);

/**
 * @swagger
 * /api/v1/maintenance-logs/statistics:
 *   get:
 *     summary: Get maintenance statistics
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics', requirePermission('maintenance.read'), getStatistics);

/**
 * @swagger
 * /api/v1/maintenance-logs/device/{deviceId}/history:
 *   get:
 *     summary: Get device maintenance history
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Device history retrieved successfully
 */
router.get('/device/:deviceId/history', requirePermission('maintenance.read'), getDeviceHistory);

/**
 * @swagger
 * /api/v1/maintenance-logs/device/{deviceId}/current-metrics:
 *   get:
 *     summary: Capture current device metrics
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Current metrics captured successfully
 */
router.get('/device/:deviceId/current-metrics', requirePermission('device.read'), captureCurrentMetrics);

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}:
 *   get:
 *     summary: Get maintenance log by ID
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: include_jobs
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: include_parts
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Maintenance log retrieved successfully
 */
router.get('/:id', requirePermission('maintenance.read'), getMaintenanceLog);

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}:
 *   patch:
 *     summary: Update maintenance log
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaintenanceLog'
 *     responses:
 *       200:
 *         description: Maintenance log updated successfully
 */
router.patch('/:id', requirePermission('maintenance.update'), updateMaintenanceLog);

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}:
 *   delete:
 *     summary: Delete maintenance log
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Maintenance log deleted successfully
 */
router.delete('/:id', requirePermission('maintenance.delete'), deleteMaintenanceLog);

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}/jobs:
 *   post:
 *     summary: Create maintenance job
 *     tags: [Maintenance Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_number
 *               - name
 *             properties:
 *               job_number:
 *                 type: integer
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               before_voltage:
 *                 type: number
 *               before_current:
 *                 type: number
 *               after_voltage:
 *                 type: number
 *               after_current:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Maintenance job created successfully
 */
router.post('/:id/jobs', requirePermission('maintenance.update'), createMaintenanceJob);

export default router;
