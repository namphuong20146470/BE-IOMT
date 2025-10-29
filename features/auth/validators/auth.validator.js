/**
 * 🔍 Authentication Input Validation
 * Joi schemas and middleware for validating authentication requests
 */

import Joi from 'joi';
import { sendValidationError } from '../helpers/response.helper.js';
import { PASSWORD_POLICY } from '../constants/auth.constants.js';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(/^[a-zA-Z0-9._-]+$/)
        .required()
        .messages({
            'string.empty': 'Username is required',
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username cannot exceed 50 characters',
            'string.pattern.base': 'Username can only contain letters, numbers, dots, underscores, and hyphens'
        }),
    
    password: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'Password is required'
        }),
    
    remember_me: Joi.boolean()
        .optional()
        .default(false),
    
    device_id: Joi.string()
        .max(255)
        .optional()
        .allow(null, '')
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = Joi.object({
    refresh_token: Joi.string()
        .min(64)
        .max(256)
        .pattern(/^[a-f0-9]+$/)
        .optional()
        .messages({
            'string.min': 'Invalid refresh token format',
            'string.max': 'Invalid refresh token format',
            'string.pattern.base': 'Invalid refresh token format'
        }),
    
    session_id: Joi.string()
        .uuid()
        .optional()
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = Joi.object({
    current_password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Current password is required'
        }),
    
    new_password: Joi.string()
        .min(PASSWORD_POLICY.MIN_LENGTH)
        .max(PASSWORD_POLICY.MAX_LENGTH)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`,
            'string.max': `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`,
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Password confirmation does not match',
            'string.empty': 'Password confirmation is required'
        })
}).with('new_password', 'confirm_password');

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
    full_name: Joi.string()
        .min(2)
        .max(100)
        .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
        .optional()
        .messages({
            'string.min': 'Full name must be at least 2 characters long',
            'string.max': 'Full name cannot exceed 100 characters',
            'string.pattern.base': 'Full name can only contain letters, spaces, hyphens, and apostrophes'
        }),
    
    email: Joi.string()
        .email()
        .max(255)
        .optional()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.max': 'Email cannot exceed 255 characters'
        }),
    
    phone: Joi.string()
        .pattern(/^[\d\s\-\+\(\)]+$/)
        .min(10)
        .max(20)
        .optional()
        .allow(null, '')
        .messages({
            'string.pattern.base': 'Please provide a valid phone number',
            'string.min': 'Phone number must be at least 10 digits',
            'string.max': 'Phone number cannot exceed 20 characters'
        }),
    
    avatar: Joi.string()
        .uri()
        .max(500)
        .optional()
        .allow(null, '')
        .messages({
            'string.uri': 'Avatar must be a valid URL',
            'string.max': 'Avatar URL cannot exceed 500 characters'
        })
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'string.empty': 'Reset token is required'
        }),
    
    new_password: Joi.string()
        .min(PASSWORD_POLICY.MIN_LENGTH)
        .max(PASSWORD_POLICY.MAX_LENGTH)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`,
            'string.max': `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`,
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Password confirmation does not match',
            'string.empty': 'Password confirmation is required'
        })
}).with('new_password', 'confirm_password');

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

/**
 * Generic validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 */
const createValidationMiddleware = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return sendValidationError(res, errors);
        }

        // Replace request data with validated and sanitized data
        req[source] = value;
        next();
    };
};

// ==========================================
// EXPORTED MIDDLEWARE FUNCTIONS
// ==========================================

export const validateLogin = createValidationMiddleware(loginSchema);
export const validateRefreshToken = createValidationMiddleware(refreshTokenSchema);  
export const validateChangePassword = createValidationMiddleware(changePasswordSchema);
export const validateUpdateProfile = createValidationMiddleware(updateProfileSchema);
export const validateResetPassword = createValidationMiddleware(resetPasswordSchema);

/**
 * Validate query parameters
 */
export const validateQuery = (schema) => createValidationMiddleware(schema, 'query');

/**
 * Validate URL parameters  
 */
export const validateParams = (schema) => createValidationMiddleware(schema, 'params');