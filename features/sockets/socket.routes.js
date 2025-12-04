// features/sockets/socket.routes.js
import express from 'express';
import socketController from './socket.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Socket:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the socket
 *         pdu_id:
 *           type: integer
 *           description: ID of the parent PDU
 *         socket_number:
 *           type: integer
 *           description: Physical socket number on the PDU
 *         name:
 *           type: string
 *           description: Socket name/label
 *         status:
 *           type: string
 *           enum: [active, inactive, maintenance, error]
 *         assigned_device_id:
 *           type: integer
 *           nullable: true
 *           description: ID of device assigned to this socket
 *         is_controllable:
 *           type: boolean
 *           description: Whether the socket can be controlled remotely
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
 *     SocketAssignment:
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
 *         - from_socket_id
 *         - to_socket_id
 *         - device_id
 *       properties:
 *         from_socket_id:
 *           type: integer
 *         to_socket_id:
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
 *               - socket_id
 *               - device_id
 *             properties:
 *               socket_id:
 *                 type: integer
 *               device_id:
 *                 type: integer
 *               notes:
 *                 type: string
 *
 *     SocketControl:
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
 * /api/v1/sockets:
 *   get:
 *     summary: Get all sockets with filtering
 *     tags: [Sockets]
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
 *         description: Sockets retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get('/', requirePermission('device.read'), socketController.getAllSockets);

/**
 * @swagger
 * /api/v1/sockets/available:
 *   get:
 *     summary: Get available sockets for device assignment
 *     tags: [Sockets]
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
 *         description: Available sockets retrieved successfully
 */
router.get('/available', requirePermission('device.read'), socketController.getAvailableSockets);

/**
 * @swagger
 * /api/v1/sockets/transfer:
 *   post:
 *     summary: Transfer device between sockets
 *     tags: [Sockets]
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
router.post('/transfer', requirePermission('device.manage'), socketController.transferDevice);

/**
 * @swagger
 * /api/v1/sockets/bulk-assign:
 *   post:
 *     summary: Bulk assign devices to sockets
 *     tags: [Sockets]
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
router.post('/bulk-assign', requirePermission('device.manage'), socketController.bulkAssignDevices);

/**
 * @swagger
 * /api/sockets/{id}:
 *   get:
 *     summary: Get socket by ID
 *     tags: [Sockets]
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
 *         description: Socket retrieved successfully
 *       404:
 *         description: Socket not found
 */
router.get('/:id', requirePermission('device.read'), socketController.getSocketById);

/**
 * @swagger
 * /api/sockets/{id}:
 *   patch:
 *     summary: Update socket configuration
 *     tags: [Sockets]
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
 *         description: Socket updated successfully
 *       400:
 *         description: Invalid update data
 *       403:
 *         description: Access denied
 *       404:
 *         description: Socket not found
 */
router.patch('/:id', requirePermission('device.manage'), socketController.updateSocket);

/**
 * @swagger
 * /api/v1/sockets/{id}/data:
 *   get:
 *     summary: Get socket data and metrics
 *     tags: [Sockets]
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
 *         description: Socket data retrieved successfully
 */
router.get('/:id/data', requirePermission('device.read'), socketController.getSocketData);

/**
 * @swagger
 * /api/v1/sockets/{id}/assign:
 *   post:
 *     summary: Assign device to socket
 *     tags: [Sockets]
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
 *             $ref: '#/components/schemas/SocketAssignment'
 *     responses:
 *       200:
 *         description: Device assigned successfully
 *       400:
 *         description: Invalid assignment request
 *       403:
 *         description: Access denied
 */
router.post('/:id/assign', requirePermission('device.manage'), socketController.assignDevice);

/**
 * @swagger
 * /api/v1/sockets/{id}/unassign:
 *   post:
 *     summary: Unassign device from socket
 *     tags: [Sockets]
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
 *         description: No device assigned to socket
 *       403:
 *         description: Access denied
 */
router.post('/:id/unassign', requirePermission('device.manage'), socketController.unassignDevice);

/**
 * @swagger
 * /api/v1/sockets/{id}/history:
 *   get:
 *     summary: Get socket assignment history
 *     tags: [Sockets]
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
 *         description: Socket history retrieved successfully
 */
router.get('/:id/history', requirePermission('device.read'), socketController.getSocketHistory);

/**
 * @swagger
 * /api/v1/sockets/{id}/control:
 *   post:
 *     summary: Control socket (turn on/off/reset)
 *     tags: [Sockets]
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
 *             $ref: '#/components/schemas/SocketControl'
 *     responses:
 *       200:
 *         description: Socket controlled successfully
 *       400:
 *         description: Invalid control command
 *       403:
 *         description: Access denied - socket not controllable
 */
router.post('/:id/control', requirePermission('device.manage'), socketController.controlSocket);

export default router;