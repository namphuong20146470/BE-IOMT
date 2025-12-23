/**
 * Auth Validator
 * Centralized validation logic for authentication
 */

import { VALIDATION_PATTERNS, PASSWORD_CONFIG, AUTH_ERROR_CODES } from './auth.constants.js';

export class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR', statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

export class AuthValidator {
    /**
     * Validate login credentials
     */
    static validateLoginInput(username, password) {
        if (!username || !password) {
            throw new ValidationError(
                'Username and password are required',
                AUTH_ERROR_CODES.MISSING_CREDENTIALS,
                400
            );
        }

        if (typeof username !== 'string' || typeof password !== 'string') {
            throw new ValidationError(
                'Username and password must be strings',
                'VALIDATION_INVALID_TYPE',
                400
            );
        }

        if (username.trim().length === 0) {
            throw new ValidationError(
                'Username cannot be empty',
                'VALIDATION_EMPTY_USERNAME',
                400
            );
        }

        if (password.length === 0) {
            throw new ValidationError(
                'Password cannot be empty',
                'VALIDATION_EMPTY_PASSWORD',
                400
            );
        }
    }

    /**
     * Validate password change input
     */
    static validatePasswordChange(currentPassword, newPassword) {
        if (!currentPassword || !newPassword) {
            throw new ValidationError(
                'Current and new password are required',
                AUTH_ERROR_CODES.MISSING_PASSWORDS,
                400
            );
        }

        if (newPassword.length < PASSWORD_CONFIG.MIN_LENGTH) {
            throw new ValidationError(
                `Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`,
                AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
                400
            );
        }

        if (currentPassword === newPassword) {
            throw new ValidationError(
                'New password must be different from current password',
                'VALIDATION_SAME_PASSWORD',
                400
            );
        }
    }

    /**
     * Validate email format
     */
    static validateEmail(email) {
        if (!email) {
            throw new ValidationError(
                'Email is required',
                'VALIDATION_EMAIL_REQUIRED',
                400
            );
        }

        if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
            throw new ValidationError(
                'Invalid email format',
                AUTH_ERROR_CODES.INVALID_EMAIL,
                400
            );
        }

        return email.toLowerCase().trim();
    }

    /**
     * Validate phone number (Vietnamese format)
     */
    static validatePhone(phone) {
        if (!phone) {
            return null; // Phone is optional
        }

        const cleanPhone = phone.replace(/\s+/g, '');
        
        if (!VALIDATION_PATTERNS.PHONE_VN.test(cleanPhone)) {
            throw new ValidationError(
                'Invalid phone number format',
                AUTH_ERROR_CODES.INVALID_PHONE,
                400
            );
        }

        return cleanPhone;
    }

    /**
     * Validate profile update data
     */
    static validateProfileUpdate(data) {
        const { full_name, email, phone } = data;

        // At least one field is required
        if (!full_name && !email && !phone) {
            throw new ValidationError(
                'At least one field (full_name, email, phone) is required',
                'VALIDATION_EMPTY_UPDATE',
                400
            );
        }

        const validated = {};

        // Validate full_name if provided
        if (full_name !== undefined) {
            if (typeof full_name !== 'string') {
                throw new ValidationError(
                    'Full name must be a string',
                    'VALIDATION_INVALID_FULL_NAME',
                    400
                );
            }
            validated.full_name = full_name.trim();
        }

        // Validate email if provided
        if (email !== undefined) {
            validated.email = this.validateEmail(email);
        }

        // Validate phone if provided
        if (phone !== undefined) {
            validated.phone = this.validatePhone(phone);
        }

        return validated;
    }

    /**
     * Validate user ID (UUID format)
     */
    static validateUserId(userId) {
        if (!userId) {
            throw new ValidationError(
                'User ID is required',
                AUTH_ERROR_CODES.USER_ID_NOT_FOUND,
                401
            );
        }

        // Check if it's a valid UUID format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(userId)) {
            throw new ValidationError(
                'Invalid user ID format',
                'VALIDATION_INVALID_USER_ID',
                401
            );
        }

        return userId;
    }

    /**
     * Validate refresh token
     */
    static validateRefreshToken(refreshToken, source = 'unknown') {
        if (!refreshToken) {
            throw new ValidationError(
                'Refresh token required',
                AUTH_ERROR_CODES.REFRESH_TOKEN_MISSING,
                401
            );
        }

        if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
            throw new ValidationError(
                'Invalid refresh token format',
                'VALIDATION_INVALID_REFRESH_TOKEN',
                401
            );
        }

        return refreshToken.trim();
    }

    /**
     * Sanitize string input (prevent XSS)
     */
    static sanitizeString(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]+>/g, '');
    }

    /**
     * Validate and sanitize profile update fields
     */
    static sanitizeProfileUpdate(data) {
        const sanitized = {};

        if (data.full_name !== undefined) {
            sanitized.full_name = this.sanitizeString(data.full_name);
        }

        if (data.email !== undefined) {
            sanitized.email = data.email.toLowerCase().trim();
        }

        if (data.phone !== undefined) {
            sanitized.phone = data.phone.replace(/\s+/g, '');
        }

        return sanitized;
    }
}

export default AuthValidator;

// ========== MIDDLEWARE WRAPPERS ==========

/**
 * Middleware: Validate login request
 */
export const validateLogin = (req, res, next) => {
    try {
        const { username, password } = req.body;
        AuthValidator.validateLoginInput(username, password);
        next();
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        next(error);
    }
};

/**
 * Middleware: Validate change password request
 */
export const validateChangePassword = (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        AuthValidator.validatePasswordChange(currentPassword, newPassword);
        next();
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        next(error);
    }
};

/**
 * Middleware: Validate update profile request
 */
export const validateUpdateProfile = (req, res, next) => {
    try {
        const validated = AuthValidator.validateProfileUpdate(req.body);
        const sanitized = AuthValidator.sanitizeProfileUpdate(validated);
        req.validatedData = sanitized; // Store validated data
        next();
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        next(error);
    }
};

/**
 * Middleware: Validate refresh token request
 */
export const validateRefreshToken = (req, res, next) => {
    try {
        // ✅ Fix: Use refresh_token (with underscore) to match auth.controller.old
        const refreshToken = req.cookies?.refresh_token || 
                           req.body?.refresh_token ||
                           (req.headers.authorization?.startsWith('Bearer ') 
                               ? req.headers.authorization.substring(7) 
                               : null);
        
        const validated = AuthValidator.validateRefreshToken(
            refreshToken, 
            req.cookies?.refresh_token ? 'cookie' : 
            req.headers.authorization ? 'bearer' : 'body'
        );
        req.validatedRefreshToken = validated;
        next();
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        next(error);
    }
};
