// features/pdu/pdu.routes.js
import { Router } from 'express';
import { z } from 'zod';
import pduController from './pdu.controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = Router();

// Validation Schemas
const createPDUSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'PDU name is required').max(100),
        code: z.string().min(1, 'PDU code is required').max(50).optional(),
        type: z.enum(['cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension']).default('cart'),
        organization_id: z.string().uuid('Invalid organization ID'),
        department_id: z.string().uuid('Invalid department ID').optional(),
        location: z.string().max(255).optional(),
        floor: z.string().max(50).optional(),
        building: z.string().max(100).optional(),
        description: z.string().max(255).optional(),
        total_outlets: z.number().int().min(1).max(48).default(4),
        voltage_rating: z.number().positive().default(220),
        max_power_watts: z.number().positive().default(10000).optional(),
        mqtt_base_topic: z.string().max(255).optional(),
        manufacturer: z.string().max(100).optional(),
        model_number: z.string().max(100).optional(),
        serial_number: z.string().max(100).optional(),
        is_mobile: z.boolean().default(true).optional(),
        specifications: z.object({}).optional()
    })
});

const updatePDUSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid PDU ID')
    }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        code: z.string().min(1).max(50).optional(),
        type: z.enum(['cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension']).optional(),
        department_id: z.string().uuid('Invalid department ID').optional(),
        location: z.string().max(255).optional(),
        floor: z.string().max(50).optional(),
        building: z.string().max(100).optional(),
        description: z.string().max(255).optional(),
        voltage_rating: z.number().positive().optional(),
        max_power_watts: z.number().positive().optional(),
        mqtt_base_topic: z.string().max(255).optional(),
        manufacturer: z.string().max(100).optional(),
        model_number: z.string().max(100).optional(),
        serial_number: z.string().max(100).optional(),
        is_mobile: z.boolean().optional(),
        is_active: z.boolean().optional(),
        specifications: z.object({}).optional()
    })
});

const getPDUQuerySchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0).default('1'),
        limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).default('20'),
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        type: z.enum(['cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension']).optional(),
        is_active: z.string().transform(val => val === 'true').optional(),
        location: z.string().optional(),
        search: z.string().min(1).optional(),
        sort_by: z.enum(['name', 'code', 'type', 'created_at', 'updated_at']).default('name'),
        sort_order: z.enum(['asc', 'desc']).default('asc'),
        include_stats: z.string().transform(val => val === 'true').optional()
    })
});

const pduStatsQuerySchema = z.object({
    query: z.object({
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        date_from: z.string().datetime().optional(),
        date_to: z.string().datetime().optional()
    })
});

// Validation Middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse({
                body: req.body,
                params: req.params,
                query: req.query
            });
            
            // Merge validated data back to req
            if (validatedData.body) req.body = validatedData.body;
            if (validatedData.params) req.params = validatedData.params;
            if (validatedData.query) req.query = validatedData.query;
            
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                        received: e.received
                    }))
                });
            }
            next(error);
        }
    };
};

// Error handling middleware for async routes
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

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
    validateRequest(z.object({
        params: z.object({
            id: z.string().uuid('Invalid PDU ID')
        })
    })),
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
    validateRequest(z.object({
        params: z.object({
            id: z.string().uuid('Invalid PDU ID')
        })
    })),
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
    validateRequest(z.object({
        params: z.object({
            id: z.string().uuid('Invalid PDU ID')
        }),
        query: z.object({
            include_device: z.string().transform(val => val === 'true').default(false),
            include_data: z.string().transform(val => val === 'true').default(false),
            status: z.enum(['active', 'idle', 'error', 'inactive']).optional()
        })
    })),
    asyncHandler(pduController.getPDUOutlets)
);

export default router;