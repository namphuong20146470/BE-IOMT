// features/alerts/alerts.validation.js
import { z } from 'zod';

// Alert status enum (maps to existing warning system)
const AlertStatusSchema = z.enum(['new', 'acknowledged', 'resolved', 'active']);

// Alert severity enum (standardized format)
const AlertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// Alert type enum (formalized categories)
const AlertTypeSchema = z.enum(['threshold', 'offline', 'maintenance']);

// Update alert status validation schema
const UpdateAlertStatusSchema = z.object({
    status: AlertStatusSchema,
    
    resolution_notes: z.string()
        .max(1000, 'Resolution notes must not exceed 1000 characters')
        .optional()
        .nullable()
}).refine(data => {
    // If status is resolved, resolution_notes should be provided
    if (data.status === 'resolved' && !data.resolution_notes) {
        return false;
    }
    return true;
}, {
    message: 'Resolution notes are required when resolving an alert',
    path: ['resolution_notes']
});

// Resolve alert validation schema
const ResolveAlertSchema = z.object({
    resolution_notes: z.string()
        .min(5, 'Resolution notes must be at least 5 characters')
        .max(1000, 'Resolution notes must not exceed 1000 characters')
});

// Query parameters validation for filtering alerts
const AlertsQuerySchema = z.object({
    page: z.string()
        .regex(/^\d+$/, 'Page must be a positive integer')
        .transform(val => parseInt(val))
        .refine(val => val >= 1, 'Page must be at least 1')
        .optional(),
    
    limit: z.string()
        .regex(/^\d+$/, 'Limit must be a positive integer')
        .transform(val => parseInt(val))
        .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
        .optional(),
    
    status: AlertStatusSchema.optional(),
    
    severity: AlertSeveritySchema.optional(),
    
    alert_type: AlertTypeSchema.optional(),
    
    device_id: z.string()
        .uuid('Device ID must be a valid UUID')
        .optional(),
    
    organization_id: z.string()
        .uuid('Organization ID must be a valid UUID')
        .optional(),
    
    start_date: z.string()
        .datetime('Start date must be a valid datetime')
        .optional(),
    
    end_date: z.string()
        .datetime('End date must be a valid datetime')
        .optional()
}).refine(data => {
    // If both start_date and end_date are provided, start_date should be before end_date
    if (data.start_date && data.end_date) {
        return new Date(data.start_date) < new Date(data.end_date);
    }
    return true;
}, {
    message: 'Start date must be before end date',
    path: ['start_date']
});

// Middleware for update alert status validation
export const validateUpdateAlertStatus = (req, res, next) => {
    try {
        const validatedData = UpdateAlertStatusSchema.parse(req.body);
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

// Middleware for resolve alert validation
export const validateResolveAlert = (req, res, next) => {
    try {
        const validatedData = ResolveAlertSchema.parse(req.body);
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

// Middleware for alerts query parameters validation
export const validateAlertsQuery = (req, res, next) => {
    try {
        const validatedData = AlertsQuerySchema.parse(req.query);
        req.query = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters',
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
    UpdateAlertStatusSchema,
    ResolveAlertSchema,
    AlertsQuerySchema,
    AlertStatusSchema,
    AlertSeveritySchema,
    AlertTypeSchema
};