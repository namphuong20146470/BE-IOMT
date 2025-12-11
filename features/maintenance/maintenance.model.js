// features/maintenance/maintenance.model.js
import { z } from 'zod';

/**
 * Maintenance History Model - Validation schemas
 */

// Electrical metrics schema (reusable)
const ElectricalMetricsSchema = z.object({
    voltage: z.number().min(0).max(500).optional(),
    current: z.number().min(0).max(100).optional(),
    power: z.number().min(0).max(50000).optional(),
    frequency: z.number().min(45).max(65).optional(),
    power_factor: z.number().min(0).max(1).optional()
});

// Create maintenance log schema
export const MaintenanceCreateSchema = z.object({
    device_id: z.string().uuid('Invalid device ID'),
    socket_id: z.string().uuid('Invalid socket ID').optional(),
    organization_id: z.string().uuid('Invalid organization ID'),
    department_id: z.string().uuid('Invalid department ID').optional(),
    
    // Basic info
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    maintenance_type: z.enum(['preventive', 'corrective', 'emergency', 'calibration']),
    severity: z.enum(['routine', 'urgent', 'emergency']).default('routine'),
    
    // Customer/Technician issues
    customer_issue: z.string().optional(),
    technician_issue: z.string().optional(),
    
    // Timing
    start_time: z.string().datetime().optional(),
    performed_date: z.string().datetime().optional(),
    
    // Initial metrics (before maintenance) - JSONB format
    initial_metrics: ElectricalMetricsSchema.optional(),
    
    // Technician
    performed_by: z.string().uuid().optional(),
    technician_name: z.string().max(255).optional()
});

// Update maintenance log schema
export const MaintenanceUpdateSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    
    // Final metrics (after maintenance) - JSONB format
    final_metrics: ElectricalMetricsSchema.optional(),
    
    // Completion
    end_time: z.string().datetime().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    status: z.enum(['completed', 'failed', 'partial', 'cancelled']).optional(),
    
    // Analysis
    issues_found: z.string().optional(),
    actions_taken: z.string().optional(),
    conclusion: z.string().optional(),
    root_cause: z.string().optional(),
    recommendations: z.string().optional(),
    
    // Device condition
    device_condition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']).optional(),
    performance_rating: z.number().int().min(1).max(5).optional(),
    
    // Cost
    cost: z.number().min(0).optional(),
    currency: z.string().length(3).default('VND').optional(),
    
    // Parts
    parts_replaced: z.array(z.object({
        name: z.string(),
        quantity: z.number().int().min(1),
        cost: z.number().optional()
    })).optional(),
    
    consumables_used: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
        unit: z.string()
    })).optional(),
    
    // Next maintenance
    next_maintenance_date: z.string().datetime().optional(),
    next_maintenance_type: z.enum(['preventive', 'corrective', 'emergency', 'calibration']).optional()
});

// Create maintenance job schema
export const MaintenanceJobCreateSchema = z.object({
    maintenance_id: z.string().uuid('Invalid maintenance ID'),
    job_number: z.number().int().min(1),
    name: z.string().min(1).max(255),
    category: z.string().max(100).optional(),
    description: z.string().optional(),
    
    // Before/After metrics - JSONB format
    before_metrics: ElectricalMetricsSchema.optional(),
    after_metrics: ElectricalMetricsSchema.optional(),
    
    // Timing
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    
    // Status
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
    result: z.enum(['success', 'failed', 'continue', 'partial']).optional(),
    
    // Notes
    notes: z.string().optional(),
    issues_found: z.string().optional(),
    actions_taken: z.string().optional()
});

// Query filters schema
export const MaintenanceQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort_by: z.enum(['performed_date', 'created_at', 'ticket_number', 'status']).default('performed_date'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    
    // Filters
    device_id: z.string().uuid().optional(),
    socket_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    performed_by: z.string().uuid().optional(),
    maintenance_type: z.enum(['preventive', 'corrective', 'emergency', 'calibration']).optional(),
    status: z.enum(['completed', 'failed', 'partial', 'cancelled']).optional(),
    severity: z.enum(['routine', 'urgent', 'emergency']).optional(),
    
    // Date range
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    
    // Search
    search: z.string().optional(),
    
    // Include options
    include_jobs: z.coerce.boolean().default(false),
    include_parts: z.coerce.boolean().default(false),
    include_device: z.coerce.boolean().default(true)
});

// Validation helper functions
export const validateMaintenanceId = (id) => {
    return z.string().uuid().parse(id);
};

export const validateCreateMaintenance = (data) => {
    return MaintenanceCreateSchema.parse(data);
};

export const validateUpdateMaintenance = (data) => {
    return MaintenanceUpdateSchema.parse(data);
};

export const validateCreateJob = (data) => {
    return MaintenanceJobCreateSchema.parse(data);
};

export const validateMaintenanceQuery = (query) => {
    return MaintenanceQuerySchema.parse(query);
};

export default {
    MaintenanceCreateSchema,
    MaintenanceUpdateSchema,
    MaintenanceJobCreateSchema,
    MaintenanceQuerySchema,
    validateMaintenanceId,
    validateCreateMaintenance,
    validateUpdateMaintenance,
    validateCreateJob,
    validateMaintenanceQuery
};
