// features/maintenance/maintenance.model.js
import { z } from 'zod';

/**
 * Maintenance History Model - Validation schemas
 */

// Electrical metrics schema (reusable)
// ✅ Support both standard metrics AND custom fields
const ElectricalMetricsSchema = z.object({
    voltage: z.number().min(0).max(500).optional(),
    current: z.number().min(0).max(100).optional(),
    power: z.number().min(0).max(50000).optional(),
    frequency: z.number().min(45).max(65).optional(),
    power_factor: z.number().min(0).max(1).optional()
}).passthrough(); // ✅ Allow additional custom fields

// Extended metrics schema with common measurements
const ExtendedMetricsSchema = z.object({
    // ===== Điện năng cơ bản =====
    voltage: z.number().min(0).max(500).optional(),
    current: z.number().min(0).max(100).optional(),
    power: z.number().min(0).max(50000).optional(),
    frequency: z.number().min(45).max(65).optional(),
    power_factor: z.number().min(0).max(1).optional(),
    
    // ===== Nhiệt độ =====
    temperature_internal: z.number().min(-50).max(200).optional(),  // Nhiệt độ trong máy (°C)
    temperature_external: z.number().min(-50).max(200).optional(),  // Nhiệt độ vỏ ngoài
    room_temperature: z.number().min(0).max(50).optional(),         // Nhiệt độ phòng
    
    // ===== Môi trường =====
    room_humidity: z.number().min(0).max(100).optional(),           // Độ ẩm (%)
    noise_level: z.number().min(0).max(200).optional(),             // Tiếng ồn (dB)
    vibration_level: z.number().min(0).optional(),                  // Độ rung (mm/s)
    
    // ===== Cơ khí =====
    fan_speed: z.number().min(0).max(10000).optional(),             // Tốc độ quạt (RPM)
    motor_speed: z.number().min(0).max(10000).optional(),           // Tốc độ động cơ (RPM)
    
    // ===== Áp suất & Lưu lượng =====
    pressure: z.number().min(0).optional(),                         // Áp suất (bar)
    flow_rate: z.number().min(0).optional(),                        // Lưu lượng (L/min)
    
    // ===== Quang học =====
    brightness: z.number().min(0).optional(),                       // Độ sáng (cd/m²)
    light_intensity: z.number().min(0).optional(),                  // Cường độ sáng (lux)
    
    // ===== Khí y tế =====
    co2_pressure: z.number().min(0).optional(),                     // Áp suất CO2 (PSI)
    co2_flow_rate: z.number().min(0).optional(),                    // Lưu lượng CO2
    o2_concentration: z.number().min(0).max(100).optional(),        // Nồng độ O2 (%)
    
    // ===== Hiệu suất =====
    efficiency: z.number().min(0).max(100).optional(),              // Hiệu suất (%)
    operating_hours: z.number().min(0).optional()                   // Số giờ vận hành
}).passthrough(); // ✅ Still allow any other custom fields

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
    
    // ✅ Before/After metrics - NOW OPTIONAL for 3-stage workflow
    before_metrics: ElectricalMetricsSchema.optional(),
    after_metrics: ElectricalMetricsSchema.optional(),
    
    // Timing - all optional initially
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    
    // ✅ Status defaults to 'pending' for new workflow
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
    result: z.enum(['success', 'failed', 'continue', 'partial']).optional(),
    
    // Notes
    notes: z.string().optional(),
    issues_found: z.string().optional(),
    actions_taken: z.string().optional()
});

// Start job schema (pending → in_progress)
export const MaintenanceJobStartSchema = z.object({
    before_metrics: ElectricalMetricsSchema.optional() // Auto-captured if not provided
});

// Complete job schema (in_progress → completed)
export const MaintenanceJobCompleteSchema = z.object({
    after_metrics: ElectricalMetricsSchema, // Required
    result: z.enum(['success', 'failed', 'continue', 'partial']), // Required
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

export const validateStartJob = (data) => {
    return MaintenanceJobStartSchema.parse(data);
};

export const validateCompleteJob = (data) => {
    return MaintenanceJobCompleteSchema.parse(data);
};

export const validateMaintenanceQuery = (query) => {
    return MaintenanceQuerySchema.parse(query);
};

export default {
    MaintenanceCreateSchema,
    MaintenanceUpdateSchema,
    MaintenanceJobCreateSchema,
    MaintenanceJobStartSchema,
    MaintenanceJobCompleteSchema,
    MaintenanceQuerySchema,
    validateMaintenanceId,
    validateCreateMaintenance,
    validateUpdateMaintenance,
    validateCreateJob,
    validateStartJob,
    validateCompleteJob,
    validateMaintenanceQuery
};
