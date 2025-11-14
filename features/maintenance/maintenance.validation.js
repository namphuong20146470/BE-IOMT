// features/maintenance/maintenance.validation.js
import { z } from 'zod';

// Maintenance type enum
const MaintenanceTypeSchema = z.enum(['preventive', 'corrective', 'calibration', 'inspection']);

// Frequency enum
const FrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one_time']);

// Schedule status enum
const ScheduleStatusSchema = z.enum(['pending', 'completed', 'cancelled', 'overdue']);

// Create maintenance schedule validation schema
const CreateScheduleSchema = z.object({
    device_id: z.string()
        .uuid('Device ID must be a valid UUID'),
    
    maintenance_type: MaintenanceTypeSchema,
    
    scheduled_date: z.string()
        .datetime('Scheduled date must be a valid datetime')
        .refine(date => new Date(date) > new Date(), {
            message: 'Scheduled date must be in the future'
        }),
    
    frequency: FrequencySchema.optional(),
    
    description: z.string()
        .min(5, 'Description must be at least 5 characters')
        .max(1000, 'Description must not exceed 1000 characters')
        .optional(),
    
    assigned_to_id: z.string()
        .uuid('Assigned to ID must be a valid UUID')
        .optional()
        .nullable()
});

// Update maintenance schedule validation schema
const UpdateScheduleSchema = z.object({
    maintenance_type: MaintenanceTypeSchema.optional(),
    
    scheduled_date: z.string()
        .datetime('Scheduled date must be a valid datetime')
        .optional(),
    
    frequency: FrequencySchema.optional().nullable(),
    
    description: z.string()
        .min(5, 'Description must be at least 5 characters')
        .max(1000, 'Description must not exceed 1000 characters')
        .optional()
        .nullable(),
    
    assigned_to_id: z.string()
        .uuid('Assigned to ID must be a valid UUID')
        .optional()
        .nullable(),
    
    status: ScheduleStatusSchema.optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
});

// Create maintenance record validation schema
const CreateRecordSchema = z.object({
    device_id: z.string()
        .uuid('Device ID must be a valid UUID'),
    
    schedule_id: z.string()
        .uuid('Schedule ID must be a valid UUID')
        .optional()
        .nullable(),
    
    maintenance_type: MaintenanceTypeSchema,
    
    performed_date: z.string()
        .datetime('Performed date must be a valid datetime')
        .refine(date => new Date(date) <= new Date(), {
            message: 'Performed date cannot be in the future'
        }),
    
    description: z.string()
        .min(5, 'Description must be at least 5 characters')
        .max(1000, 'Description must not exceed 1000 characters'),
    
    cost: z.number()
        .min(0, 'Cost must be a positive number')
        .optional()
        .default(0),
    
    notes: z.string()
        .max(2000, 'Notes must not exceed 2000 characters')
        .optional()
        .nullable()
});

// Update maintenance record validation schema
const UpdateRecordSchema = z.object({
    maintenance_type: MaintenanceTypeSchema.optional(),
    
    performed_date: z.string()
        .datetime('Performed date must be a valid datetime')
        .refine(date => new Date(date) <= new Date(), {
            message: 'Performed date cannot be in the future'
        })
        .optional(),
    
    description: z.string()
        .min(5, 'Description must be at least 5 characters')
        .max(1000, 'Description must not exceed 1000 characters')
        .optional(),
    
    cost: z.number()
        .min(0, 'Cost must be a positive number')
        .optional(),
    
    notes: z.string()
        .max(2000, 'Notes must not exceed 2000 characters')
        .optional()
        .nullable()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
});

// Middleware for create schedule validation
export const validateCreateSchedule = (req, res, next) => {
    try {
        const validatedData = CreateScheduleSchema.parse(req.body);
        req.body = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal validation error',
            error: error.message
        });
    }
};

// Middleware for update schedule validation
export const validateUpdateSchedule = (req, res, next) => {
    try {
        const validatedData = UpdateScheduleSchema.parse(req.body);
        req.body = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal validation error',
            error: error.message
        });
    }
};

// Middleware for create record validation
export const validateCreateRecord = (req, res, next) => {
    try {
        const validatedData = CreateRecordSchema.parse(req.body);
        req.body = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal validation error',
            error: error.message
        });
    }
};

// Middleware for update record validation
export const validateUpdateRecord = (req, res, next) => {
    try {
        const validatedData = UpdateRecordSchema.parse(req.body);
        req.body = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal validation error',
            error: error.message
        });
    }
};

export {
    CreateScheduleSchema,
    UpdateScheduleSchema,
    CreateRecordSchema,
    UpdateRecordSchema,
    MaintenanceTypeSchema,
    FrequencySchema,
    ScheduleStatusSchema
};