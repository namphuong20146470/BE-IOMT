// features/outlets/outlet.routes.js
import express from 'express';
import outletController from './outlet.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Outlet:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the outlet
 *         pdu_id:
 *           type: integer
 *           description: ID of the parent PDU
 *         outlet_number:
 *           type: integer
 *           description: Physical outlet number on the PDU
 *         name:
 *           type: string
 *           description: Outlet name/label
 *         status:
 *           type: string
 *           enum: [active, inactive, maintenance, error]
 *         assigned_device_id:
 *           type: integer
 *           nullable: true
 *           description: ID of device assigned to this outlet
 *         is_controllable:
 *           type: boolean
 *           description: Whether the outlet can be controlled remotely
 *         power_limit_watts:
 *           type: number
 *           nullable: true
 *           description: Maximum power limit in watts
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     OutletAssignment:
 *       type: object
 *       required:
 *         - device_id
 *       properties:
 *         device_id:
 *           type: integer
 *           description: ID of device to assign
 *         notes:
 *           type: string
 *           description: Optional assignment notes
 *
 *     DeviceTransfer:
 *       type: object
 *       required:
 *         - from_outlet_id
 *         - to_outlet_id
 *         - device_id
 *       properties:
 *         from_outlet_id:
 *           type: integer
 *         to_outlet_id:
 *           type: integer
 *         device_id:
 *           type: integer
 *         notes:
 *           type: string
 *
 *     BulkAssignment:
 *       type: object
 *       required:
 *         - assignments
 *       properties:
 *         assignments:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - outlet_id
 *               - device_id
 *             properties:
 *               outlet_id:
 *                 type: integer
 *               device_id:
 *                 type: integer
 *               notes:
 *                 type: string
 *
 *     OutletControl:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [on, off, reset, restart]
 *         duration:
 *           type: integer
 *           description: Duration in seconds for temporary actions
 *         notes:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/outlets:
 *   get:
 *     summary: Get all outlets with filtering
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pdu_id
 *         schema:
 *           type: integer
 *         description: Filter by PDU ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance, error]
 *       - in: query
 *         name: assigned
 *         schema:
 *           type: boolean
 *         description: Filter by device assignment status
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: department_id
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
 *           default: 20
 *     responses:
 *       200:
 *         description: Outlets retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get('/', requirePermission('device.read'), outletController.getAllOutlets);

/**
 * @swagger
 * /api/v1/outlets/available:
 *   get:
 *     summary: Get available outlets for device assignment
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: min_power_watts
 *         schema:
 *           type: number
 *         description: Minimum power capacity required
 *     responses:
 *       200:
 *         description: Available outlets retrieved successfully
 */
router.get('/available', requirePermission('device.read'), outletController.getAvailableOutlets);

/**
 * @swagger
 * /api/v1/outlets/transfer:
 *   post:
 *     summary: Transfer device between outlets
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceTransfer'
 *     responses:
 *       200:
 *         description: Device transferred successfully
 *       400:
 *         description: Invalid transfer request
 *       403:
 *         description: Access denied
 */
router.post('/transfer', requirePermission('device.manage'), outletController.transferDevice);

/**
 * @swagger
 * /api/v1/outlets/bulk-assign:
 *   post:
 *     summary: Bulk assign devices to outlets
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkAssignment'
 *     responses:
 *       200:
 *         description: Devices assigned successfully
 *       400:
 *         description: Invalid assignment data
 *       403:
 *         description: Access denied
 */
router.post('/bulk-assign', requirePermission('device.manage'), outletController.bulkAssignDevices);

/**
 * @swagger
 * /api/outlets/{id}:
 *   get:
 *     summary: Get outlet by ID
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: include_device
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: include_data
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: include_history
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Outlet retrieved successfully
 *       404:
 *         description: Outlet not found
 */
router.get('/:id', requirePermission('device.read'), outletController.getOutletById);

/**
 * @swagger
 * /api/outlets/{id}:
 *   patch:
 *     summary: Update outlet configuration
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               is_controllable:
 *                 type: boolean
 *               power_limit_watts:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance]
 *     responses:
 *       200:
 *         description: Outlet updated successfully
 *       400:
 *         description: Invalid update data
 *       403:
 *         description: Access denied
 *       404:
 *         description: Outlet not found
 */
router.patch('/:id', requirePermission('device.manage'), outletController.updateOutlet);

/**
 * @swagger
 * /api/v1/outlets/{id}/data:
 *   get:
 *     summary: Get outlet data and metrics
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [minute, hour, day]
 *           default: hour
 *     responses:
 *       200:
 *         description: Outlet data retrieved successfully
 */
router.get('/:id/data', requirePermission('device.read'), outletController.getOutletData);

/**
 * @swagger
 * /api/v1/outlets/{id}/assign:
 *   post:
 *     summary: Assign device to outlet
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OutletAssignment'
 *     responses:
 *       200:
 *         description: Device assigned successfully
 *       400:
 *         description: Invalid assignment request
 *       403:
 *         description: Access denied
 */
router.post('/:id/assign', requirePermission('device.manage'), outletController.assignDevice);

/**
 * @swagger
 * /api/v1/outlets/{id}/unassign:
 *   post:
 *     summary: Unassign device from outlet
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device unassigned successfully
 *       400:
 *         description: No device assigned to outlet
 *       403:
 *         description: Access denied
 */
router.post('/:id/unassign', requirePermission('device.manage'), outletController.unassignDevice);

/**
 * @swagger
 * /api/v1/outlets/{id}/history:
 *   get:
 *     summary: Get outlet assignment history
 *     tags: [Outlets]
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
 *         description: Outlet history retrieved successfully
 */
router.get('/:id/history', requirePermission('device.read'), outletController.getOutletHistory);

/**
 * @swagger
 * /api/v1/outlets/{id}/control:
 *   post:
 *     summary: Control outlet (turn on/off/reset)
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OutletControl'
 *     responses:
 *       200:
 *         description: Outlet controlled successfully
 *       400:
 *         description: Invalid control command
 *       403:
 *         description: Access denied - outlet not controllable
 */
router.post('/:id/control', requirePermission('device.manage'), outletController.controlOutlet);

export default router;