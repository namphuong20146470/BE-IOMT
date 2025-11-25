// features/outlets/outlet.model.js
import { z } from 'zod';

/**
 * Outlet Model - Validation schemas and data models
 */

export const OutletUpdateSchema = z.object({
    name: z.string().max(100).optional(),
    is_enabled: z.boolean().optional(),
    max_power_watts: z.number().positive().optional(),
    voltage_rating: z.number().positive().optional(),
    connector_type: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    mqtt_topic_suffix: z.string().max(100).optional()
});

export const OutletQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).default('20'),
    pdu_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    status: z.enum(['active', 'idle', 'error', 'inactive']).optional(),
    assigned: z.string().transform(val => val === 'true').optional(),
    search: z.string().min(1).optional(),
    include_device: z.string().transform(val => val === 'true').default('false'),
    include_data: z.string().transform(val => val === 'true').default('false'),
    sort_by: z.enum(['outlet_number', 'name', 'status', 'assigned_at']).default('outlet_number'),
    sort_order: z.enum(['asc', 'desc']).default('asc')
});

export const OutletDataQuerySchema = z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    interval: z.enum(['minute', 'hour', 'day']).default('hour'),
    metrics: z.string().optional(), // comma-separated
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 1000).default('100')
});

export const OutletAssignmentSchema = z.object({
    device_id: z.string().uuid('Invalid device ID'),
    notes: z.string().max(500).optional()
});

export const OutletUnassignmentSchema = z.object({
    notes: z.string().max(500).optional()
});

export const OutletControlSchema = z.object({
    action: z.enum(['turn_on', 'turn_off', 'reset', 'toggle']),
    force: z.boolean().default(false)
});

export const BulkAssignmentSchema = z.object({
    assignments: z.array(z.object({
        outlet_id: z.string().uuid(),
        device_id: z.string().uuid(),
        notes: z.string().max(500).optional()
    })).min(1).max(50)
});

export const OutletTransferSchema = z.object({
    from_outlet_id: z.string().uuid(),
    to_outlet_id: z.string().uuid(),
    notes: z.string().max(500).optional()
});

export const OutletModel = {
    update: OutletUpdateSchema,
    query: OutletQuerySchema,
    dataQuery: OutletDataQuerySchema,
    assignment: OutletAssignmentSchema,
    unassignment: OutletUnassignmentSchema,
    control: OutletControlSchema,
    bulkAssignment: BulkAssignmentSchema,
    transfer: OutletTransferSchema
};

export default OutletModel;