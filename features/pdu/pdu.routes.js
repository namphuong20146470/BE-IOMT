// features/pdu/pdu.routes.js
import { Router } from 'express';
import pduController from './pdu.controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import {
    createPDUSchema,
    updatePDUSchema,
    getPDUQuerySchema,
    pduStatsQuerySchema,
    pduByIdSchema,
    pduOutletsSchema,
    validateRequest,
    asyncHandler
} from './pdu.validation.js';

const router = Router();

// Routes

/**
 * @swagger
 * /api/v1/pdus:
 *   get:
 *     summary: Get all PDUs with filtering and pagination
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by organization
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [cart, wall_mount, floor_stand, ceiling, rack, extension]
 *         description: Filter by PDU type
 *     responses:
 *       200:
 *         description: List of PDUs retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
    authMiddleware,
    requirePermission('device.list'),
    validateRequest(getPDUQuerySchema),
    asyncHandler(pduController.getAllPDUs)
);

/**
 * @swagger
 * /api/v1/pdus/statistics:
 *   get:
 *     summary: Get PDU statistics and metrics
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 */
router.get('/statistics',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(pduStatsQuerySchema),
    asyncHandler(pduController.getPDUStatistics)
);

/**
 * @swagger
 * /api/v1/pdus/{id}:
 *   get:
 *     summary: Get PDU by ID
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: PDU ID
 */
router.get('/:id',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(pduByIdSchema),
    asyncHandler(pduController.getPDUById)
);

/**
 * @swagger
 * /api/v1/pdus:
 *   post:
 *     summary: Create new PDU
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - organization_id
 *               - total_outlets
 *               - voltage_rating
 */
router.post('/',
    authMiddleware,
    requirePermission('device.create'),
    validateRequest(createPDUSchema),
    asyncHandler(pduController.createPDU)
);

/**
 * @swagger
 * /api/pdus/{id}:
 *   put:
 *     summary: Update PDU
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id',
    authMiddleware,
    requirePermission('device.update'),
    validateRequest(updatePDUSchema),
    asyncHandler(pduController.updatePDU)
);

/**
 * @swagger
 * /api/pdus/{id}:
 *   delete:
 *     summary: Delete PDU
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id',
    authMiddleware,
    requirePermission('device.delete'),
    validateRequest(pduByIdSchema),
    asyncHandler(pduController.deletePDU)
);

/**
 * @swagger
 * /api/pdus/{id}/outlets:
 *   get:
 *     summary: Get all outlets for a PDU
 *     tags: [PDU]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/outlets',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(pduOutletsSchema),
    asyncHandler(pduController.getPDUOutlets)
);

export default router;