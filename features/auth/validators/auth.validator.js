/**
 * Auth Feature Validation
 * Input validation schemas and middleware for authentication
 */

import Joi from 'joi';
import { VALIDATION_RULES } from '../../shared/constants/index.js';

// ==========================================
// VALIDATION SCHEMAS  
// ==========================================

export const loginSchema = Joi.object({
    username: Joi.string()
        .min(VALIDATION_RULES.USERNAME.MIN_LENGTH)
        .max(VALIDATION_RULES.USERNAME.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'Username is required',
            'string.min': `Username must be at least ${VALIDATION_RULES.USERNAME.MIN_LENGTH} characters`,
            'string.max': `Username must not exceed ${VALIDATION_RULES.USERNAME.MAX_LENGTH} characters`
        }),
    
    password: Joi.string()
        .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH)
        .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': `Password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters`,
            'string.max': `Password must not exceed ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`
        })
});

export const changePasswordSchema = Joi.object({
    current_password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Current password is required'
        }),
    
    new_password: Joi.string()
        .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH)
        .max(VALIDATION_RULES.PASSWORD.MAX_LENGTH)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': `New password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters`,
            'string.max': `New password must not exceed ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Confirm password must match new password',
            'string.empty': 'Confirm password is required'
        })
});

export const updateProfileSchema = Joi.object({
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
        .messages({
            'string.pattern.base': 'Phone number must be 10-11 digits'
        })
});

export const refreshTokenSchema = Joi.object({
    refresh_token: Joi.string()
        .required()
        .messages({
            'string.empty': 'Refresh token is required'
        })
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

export const validateLogin = (req, res, next) => {
    const { error } = loginSchema.validate(req.body);
    
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

export const validateChangePassword = (req, res, next) => {
    const { error } = changePasswordSchema.validate(req.body);
    
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

export const validateUpdateProfile = (req, res, next) => {
    const { error } = updateProfileSchema.validate(req.body);
    
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

export const validateRefreshToken = (req, res, next) => {
    const { error } = refreshTokenSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            error: error.details[0].message
        });
    }
    
    next();
};