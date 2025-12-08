// features/pdu/pdu.validation.js
import { z } from 'zod';

/**
 * PDU Validation Schemas
 */

// Base PDU validation schemas
export const createPDUSchema = z.object({
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
        total_sockets: z.number().int().min(1).max(48).default(4),
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

export const updatePDUSchema = z.object({
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

export const getPDUQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        type: z.enum(['cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension']).optional(),
        is_active: z.coerce.boolean().optional(),
        location: z.string().optional(),
        search: z.string().min(1).optional(),
        sort_by: z.enum(['name', 'code', 'type', 'created_at', 'updated_at']).default('name'),
        sort_order: z.enum(['asc', 'desc']).default('asc'),
        include_stats: z.coerce.boolean().optional()
    })
});

export const pduStatsQuerySchema = z.object({
    query: z.object({
        organization_id: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        date_from: z.string().datetime().optional(),
        date_to: z.string().datetime().optional()
    })
});

export const pduByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid PDU ID')
    })
});

export const pduSocketsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid PDU ID')
    }),
    query: z.object({
        include_device: z.coerce.boolean().default(false),
        include_data: z.coerce.boolean().default(false),
        status: z.enum(['active', 'idle', 'error', 'inactive']).optional()
    })
});

// Validation middleware
export const validateRequest = (schema) => {
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
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};