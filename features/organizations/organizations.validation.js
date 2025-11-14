// features/organizations/organizations.validation.js
import { z } from 'zod';

// Organization type enum
const OrganizationTypeSchema = z.enum(['hospital', 'clinic', 'laboratory']);

// Create organization validation schema
const CreateOrganizationSchema = z.object({
    name: z.string()
        .min(2, 'Organization name must be at least 2 characters')
        .max(100, 'Organization name must not exceed 100 characters')
        .trim(),
    
    type: OrganizationTypeSchema,
    
    address: z.string()
        .max(500, 'Address must not exceed 500 characters')
        .optional()
        .nullable(),
    
    phone: z.string()
        .regex(/^[\d\s\-\+\(\)\.]+$/, 'Invalid phone number format')
        .max(20, 'Phone number must not exceed 20 characters')
        .optional()
        .nullable(),
    
    email: z.string()
        .email('Invalid email format')
        .max(100, 'Email must not exceed 100 characters')
        .optional()
        .nullable(),
    
    description: z.string()
        .max(1000, 'Description must not exceed 1000 characters')
        .optional()
        .nullable()
});

// Update organization validation schema (all fields optional except constraints)
const UpdateOrganizationSchema = z.object({
    name: z.string()
        .min(2, 'Organization name must be at least 2 characters')
        .max(100, 'Organization name must not exceed 100 characters')
        .trim()
        .optional(),
    
    type: OrganizationTypeSchema.optional(),
    
    address: z.string()
        .max(500, 'Address must not exceed 500 characters')
        .optional()
        .nullable(),
    
    phone: z.string()
        .regex(/^[\d\s\-\+\(\)\.]+$/, 'Invalid phone number format')
        .max(20, 'Phone number must not exceed 20 characters')
        .optional()
        .nullable(),
    
    email: z.string()
        .email('Invalid email format')
        .max(100, 'Email must not exceed 100 characters')
        .optional()
        .nullable(),
    
    description: z.string()
        .max(1000, 'Description must not exceed 1000 characters')
        .optional()
        .nullable()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
});

// Middleware for create organization validation
export const validateCreateOrganization = (req, res, next) => {
    try {
        const validatedData = CreateOrganizationSchema.parse(req.body);
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

// Middleware for update organization validation
export const validateUpdateOrganization = (req, res, next) => {
    try {
        const validatedData = UpdateOrganizationSchema.parse(req.body);
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
    CreateOrganizationSchema,
    UpdateOrganizationSchema,
    OrganizationTypeSchema
};