// features/departments/departments.validation.js
import { z } from 'zod';

// Create department validation schema
const CreateDepartmentSchema = z.object({
    organization_id: z.string()
        .uuid('Organization ID must be a valid UUID'),
    
    name: z.string()
        .min(2, 'Department name must be at least 2 characters')
        .max(100, 'Department name must not exceed 100 characters')
        .trim(),
    
    code: z.string()
        .min(2, 'Department code must be at least 2 characters')
        .max(20, 'Department code must not exceed 20 characters')
        .regex(/^[A-Z0-9_-]+$/, 'Department code must contain only uppercase letters, numbers, hyphens, and underscores')
        .trim(),
    
    description: z.string()
        .max(500, 'Description must not exceed 500 characters')
        .optional()
        .nullable()
});

// Update department validation schema (all fields optional except constraints)
const UpdateDepartmentSchema = z.object({
    name: z.string()
        .min(2, 'Department name must be at least 2 characters')
        .max(100, 'Department name must not exceed 100 characters')
        .trim()
        .optional(),
    
    code: z.string()
        .min(2, 'Department code must be at least 2 characters')
        .max(20, 'Department code must not exceed 20 characters')
        .regex(/^[A-Z0-9_-]+$/, 'Department code must contain only uppercase letters, numbers, hyphens, and underscores')
        .trim()
        .optional(),
    
    description: z.string()
        .max(500, 'Description must not exceed 500 characters')
        .optional()
        .nullable()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
});

// Middleware for create department validation
export const validateCreateDepartment = (req, res, next) => {
    try {
        const validatedData = CreateDepartmentSchema.parse(req.body);
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

// Middleware for update department validation
export const validateUpdateDepartment = (req, res, next) => {
    try {
        const validatedData = UpdateDepartmentSchema.parse(req.body);
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
    CreateDepartmentSchema,
    UpdateDepartmentSchema
};