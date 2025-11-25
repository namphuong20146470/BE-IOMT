// features/pdu/pdu.model.js
import { z } from 'zod';

/**
 * PDU Model - Validation schemas and data models
 */

export const PduCreateSchema = z.object({
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
});

export const PduUpdateSchema = z.object({
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
});

export const PduQuerySchema = z.object({
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
});

export const PduStatsQuerySchema = z.object({
    organization_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional()
});

export const PduModel = {
    create: PduCreateSchema,
    update: PduUpdateSchema,
    query: PduQuerySchema,
    stats: PduStatsQuerySchema
};

export default PduModel;