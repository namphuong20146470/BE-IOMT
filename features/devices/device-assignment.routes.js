// features/devices/device-assignment.routes.js
import { Router } from 'express';
import { z } from 'zod';
import deviceAssignmentService from './services/deviceAssignmentService.js';
import assignmentValidator from './services/assignmentValidator.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = Router();

// Validation Schemas
const validateAssignmentSchema = z.object({
    body: z.object({
        outlet_id: z.string().uuid('Invalid outlet ID'),
        device_id: z.string().uuid('Invalid device ID')
    })
});

const validateBulkAssignmentSchema = z.object({
    body: z.object({
        assignments: z.array(z.object({
            outlet_id: z.string().uuid('Invalid outlet ID'),
            device_id: z.string().uuid('Invalid device ID')
        })).min(1, 'At least one assignment is required').max(100, 'Maximum 100 assignments per validation')
    })
});

const validateTransferSchema = z.object({
    body: z.object({
        from_outlet_id: z.string().uuid('Invalid source outlet ID'),
        to_outlet_id: z.string().uuid('Invalid destination outlet ID')
    })
});

const getAvailableResourcesSchema = z.object({
    query: z.object({
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        resource_type: z.enum(['devices', 'outlets']).default('devices')
    })
});

const getAssignmentHistorySchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid resource ID')
    }),
    query: z.object({
        resource_type: z.enum(['device', 'outlet']).default('device'),
        limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).default('50')
    })
});

const checkConflictsSchema = z.object({
    body: z.object({
        outlet_id: z.string().uuid('Invalid outlet ID'),
        device_id: z.string().uuid('Invalid device ID')
    })
});

const getSummarySchema = z.object({
    query: z.object({
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional()
    })
});

// Middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse({
                body: req.body,
                params: req.params,
                query: req.query
            });
            
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

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Routes

/**
 * @swagger
 * /api/device-assignment/validate:
 *   post:
 *     summary: Validate device-outlet assignment
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outlet_id
 *               - device_id
 *             properties:
 *               outlet_id:
 *                 type: string
 *                 format: uuid
 *               device_id:
 *                 type: string
 *                 format: uuid
 */
router.post('/validate',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(validateAssignmentSchema),
    asyncHandler(async (req, res) => {
        const { outlet_id, device_id } = req.body;
        
        const validation = await assignmentValidator.validateAssignment(
            outlet_id,
            device_id,
            req.user
        );
        
        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
            outlet_info: validation.outlet_info,
            device_info: validation.device_info
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/validate-bulk:
 *   post:
 *     summary: Validate multiple device-outlet assignments
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 */
router.post('/validate-bulk',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(validateBulkAssignmentSchema),
    asyncHandler(async (req, res) => {
        const { assignments } = req.body;
        
        const results = await assignmentValidator.validateBulkAssignments(
            assignments,
            req.user
        );
        
        res.json({
            success: true,
            data: results,
            summary: {
                total: assignments.length,
                valid: results.filter(r => r.valid).length,
                invalid: results.filter(r => !r.valid).length
            }
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/validate-transfer:
 *   post:
 *     summary: Validate device transfer between outlets
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 */
router.post('/validate-transfer',
    authMiddleware,
    requirePermission('device.manage'),
    validateRequest(validateTransferSchema),
    asyncHandler(async (req, res) => {
        const { from_outlet_id, to_outlet_id } = req.body;
        
        const validation = await assignmentValidator.validateTransfer(
            from_outlet_id,
            to_outlet_id,
            req.user
        );
        
        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
            source_outlet: validation.source_outlet,
            target_outlet: validation.target_outlet,
            device_info: validation.device_info
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/available:
 *   get:
 *     summary: Get available devices or outlets for assignment
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *           enum: [devices, outlets]
 *           default: devices
 *         description: Type of resources to retrieve
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by organization
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department
 */
router.get('/available',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(getAvailableResourcesSchema),
    asyncHandler(async (req, res) => {
        const { resource_type, organization_id, department_id } = req.query;
        
        const orgId = organization_id || req.user.organization_id;
        
        let resources;
        if (resource_type === 'outlets') {
            resources = await deviceAssignmentService.getAvailableOutlets(orgId, department_id);
        } else {
            resources = await deviceAssignmentService.getAvailableDevices(orgId, department_id);
        }
        
        res.json({
            success: true,
            data: resources,
            resource_type,
            total: resources.length
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/history/{id}:
 *   get:
 *     summary: Get assignment history for device or outlet
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID or Outlet ID
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *           enum: [device, outlet]
 *           default: device
 *         description: Type of resource
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of records
 */
router.get('/history/:id',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(getAssignmentHistorySchema),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { resource_type, limit } = req.query;
        
        const history = await deviceAssignmentService.getAssignmentHistory(
            id,
            resource_type,
            limit
        );
        
        res.json({
            success: true,
            data: history,
            resource_type,
            resource_id: id,
            total: history.length
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/check-conflicts:
 *   post:
 *     summary: Real-time conflict checking for assignment
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outlet_id
 *               - device_id
 */
router.post('/check-conflicts',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(checkConflictsSchema),
    asyncHandler(async (req, res) => {
        const { outlet_id, device_id } = req.body;
        
        const conflicts = await assignmentValidator.checkConflicts(
            outlet_id,
            device_id,
            req.user
        );
        
        res.json({
            success: true,
            has_conflicts: conflicts.length > 0,
            conflicts,
            outlet_id,
            device_id
        });
    })
);

/**
 * @swagger
 * /api/device-assignment/summary:
 *   get:
 *     summary: Get assignment statistics summary
 *     tags: [Device Assignment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by organization
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department
 */
router.get('/summary',
    authMiddleware,
    requirePermission('device.read'),
    validateRequest(getSummarySchema),
    asyncHandler(async (req, res) => {
        const { organization_id, department_id } = req.query;
        
        const orgId = organization_id || req.user.organization_id;
        
        const summary = await deviceAssignmentService.getAssignmentSummary(
            orgId,
            department_id
        );
        
        res.json({
            success: true,
            data: summary
        });
    })
);

export default router;