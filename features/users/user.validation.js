/**
 * Users Feature Validation
 * Input validation schemas and middleware for user management
 */

import Joi from 'joi';
import { VALIDATION_RULES } from '../../shared/constants/index.js';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

export const createUserSchema = Joi.object({
    username: Joi.string()
        .min(VALIDATION_RULES.USERNAME.MIN_LENGTH)
        .max(VALIDATION_RULES.USERNAME.MAX_LENGTH)
        .pattern(/^[a-zA-Z0-9_]+$/)
        .required()
        .messages({
            'string.empty': 'Username is required',
            'string.min': `Username must be at least ${VALIDATION_RULES.USERNAME.MIN_LENGTH} characters`,
            'string.max': `Username must not exceed ${VALIDATION_RULES.USERNAME.MAX_LENGTH} characters`,
            'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
        }),
    
    password: Joi.string()
        .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH)
        .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': `Password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters`,
            'string.max': `Password must not exceed ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`
        }),
    
    full_name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Full name is required',
            'string.min': 'Full name must be at least 2 characters',
            'string.max': 'Full name must not exceed 100 characters'
        }),
    
    email: Joi.string()
        .email()
        .max(VALIDATION_RULES.EMAIL.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Invalid email format',
            'string.max': `Email must not exceed ${VALIDATION_RULES.EMAIL.MAX_LENGTH} characters`
        }),
    
    phone: Joi.string()
        .pattern(/^[0-9]{10,11}$/)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Phone number must be 10-11 digits'
        }),
    
    organization_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Organization is required',
            'string.uuid': 'Invalid organization ID format'
        }),
    
    department_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'Invalid department ID format'
        }),
    
    role_ids: Joi.array()
        .items(Joi.string().uuid())
        .optional()
        .messages({
            'array.base': 'Role IDs must be an array',
            'string.uuid': 'Invalid role ID format'
        })
});

export const updateUserSchema = Joi.object({
    full_name: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Full name must be at least 2 characters',
            'string.max': 'Full name must not exceed 100 characters'
        }),
    
    email: Joi.string()
        .email()
        .max(VALIDATION_RULES.EMAIL.MAX_LENGTH)
        .optional()
        .messages({
            'string.email': 'Invalid email format',
            'string.max': `Email must not exceed ${VALIDATION_RULES.EMAIL.MAX_LENGTH} characters`
        }),
    
    phone: Joi.string()
        .pattern(/^[0-9]{10,11}$/)
        .optional()
        .allow('', null)
        .messages({
            'string.pattern.base': 'Phone number must be 10-11 digits'
        }),
    
    organization_id: Joi.string()
        .uuid()
        .optional()
        .messages({
            'string.uuid': 'Invalid organization ID format'
        }),
    
    department_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'Invalid department ID format'
        }),
    
    is_active: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'is_active must be a boolean'
        })
});

export const assignRolesSchema = Joi.object({
    role_ids: Joi.array()
        .items(Joi.string().uuid())
        .min(1)
        .required()
        .messages({
            'array.base': 'Role IDs must be an array',
            'array.min': 'At least one role ID is required',
            'string.uuid': 'Invalid role ID format'
        }),
    
    notes: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Notes must not exceed 500 characters'
        })
});

export const resetPasswordSchema = Joi.object({
    new_password: Joi.string()
        .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH)
        .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': `Password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters`,
            'string.max': `Password must not exceed ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Confirm password must match new password',
            'string.empty': 'Confirm password is required'
        })
});

export const userQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(100).optional().allow(''),
    organization_id: Joi.string().uuid().optional(),
    department_id: Joi.string().uuid().optional(),
    is_active: Joi.boolean().optional(),
    role_id: Joi.string().uuid().optional(),
    created_from: Joi.date().iso().optional(),
    created_to: Joi.date().iso().optional(),
    sort_by: Joi.string().valid('username', 'full_name', 'email', 'created_at', 'updated_at').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    include_roles: Joi.boolean().default(false),
    include_system_users: Joi.boolean().default(false)
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

export const validateCreateUser = (req, res, next) => {
    const { error } = createUserSchema.validate(req.body);
    
    if (error) {
        const errorDetails = error.details.reduce((acc, detail) => {
            acc[detail.path[0]] = detail.message;
            return acc;
        }, {});
        
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errorDetails
        });
    }
    
    next();
};

export const validateUpdateUser = (req, res, next) => {
    const { error } = updateUserSchema.validate(req.body);
    
    if (error) {
        const errorDetails = error.details.reduce((acc, detail) => {
            acc[detail.path[0]] = detail.message;
            return acc;
        }, {});
        
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errorDetails
        });
    }
    
    next();
};

export const validateAssignRoles = (req, res, next) => {
    const { error } = assignRolesSchema.validate(req.body);
    
    if (error) {
        const errorDetails = error.details.reduce((acc, detail) => {
            acc[detail.path[0]] = detail.message;
            return acc;
        }, {});
        
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errorDetails
        });
    }
    
    next();
};

export const validateResetPassword = (req, res, next) => {
    const { error } = resetPasswordSchema.validate(req.body);
    
    if (error) {
        const errorDetails = error.details.reduce((acc, detail) => {
            acc[detail.path[0]] = detail.message;
            return acc;
        }, {});
        
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errorDetails
        });
    }
    
    next();
};

export const validateUserQuery = (req, res, next) => {
    const { error, value } = userQuerySchema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Invalid query parameters',
            error: error.details[0].message
        });
    }
    
    req.query = value;
    next();
};