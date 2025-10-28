/**
 * Feature Validation Template
 * Input validation schemas and middleware
 */

import Joi from 'joi';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

export const createItemSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Name is required',
            'string.min': 'Name must be at least 2 characters',
            'string.max': 'Name must not exceed 100 characters'
        }),
    
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Description must not exceed 500 characters'
        }),
    
    status: Joi.string()
        .valid('active', 'inactive')
        .default('active')
        .messages({
            'any.only': 'Status must be either active or inactive'
        }),
    
    priority: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .optional()
        .messages({
            'number.base': 'Priority must be a number',
            'number.integer': 'Priority must be an integer',
            'number.min': 'Priority must be at least 1',
            'number.max': 'Priority must not exceed 10'
        })
});

export const updateItemSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Name must be at least 2 characters',
            'string.max': 'Name must not exceed 100 characters'
        }),
    
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Description must not exceed 500 characters'
        }),
    
    status: Joi.string()
        .valid('active', 'inactive')
        .optional()
        .messages({
            'any.only': 'Status must be either active or inactive'
        }),
    
    priority: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .optional()
        .messages({
            'number.base': 'Priority must be a number',
            'number.integer': 'Priority must be an integer',
            'number.min': 'Priority must be at least 1',
            'number.max': 'Priority must not exceed 10'
        })
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

export const validateCreateItem = (req, res, next) => {
    const { error } = createItemSchema.validate(req.body);
    
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

export const validateUpdateItem = (req, res, next) => {
    const { error } = updateItemSchema.validate(req.body);
    
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

// ==========================================
// QUERY VALIDATION
// ==========================================

export const validatePaginationQuery = (req, res, next) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().max(100).optional().allow(''),
        status: Joi.string().valid('active', 'inactive', 'all').optional(),
        sort_by: Joi.string().valid('name', 'created_at', 'updated_at').default('created_at'),
        sort_order: Joi.string().valid('asc', 'desc').default('desc')
    });
    
    const { error, value } = schema.validate(req.query);
    
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