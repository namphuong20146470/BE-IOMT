/**
 * 📝 Standardized API Response Helper
 * Consistent response format for authentication endpoints
 */

import { AUTH_MESSAGES, AUTH_ERROR_CODES } from '../constants/auth.constants.js';

/**
 * Success response helper
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
    const response = {
        success: true,
        message,
        ...(data && { data }),
        ...(meta && { meta })
    };
    
    return res.status(statusCode).json(response);
};

/**
 * Error response helper
 * @param {Object} res - Express response object  
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 */
export const sendError = (res, message = 'An error occurred', statusCode = 400, code = null, details = null) => {
    const response = {
        success: false,
        message,
        ...(code && { code }),
        ...(details && { details })
    };
    
    return res.status(statusCode).json(response);
};

/**
 * Login success response
 * @param {Object} res - Express response object
 * @param {Object} user - User data
 * @param {Object} tokens - Token information
 * @param {Object} session - Session information  
 * @param {Object} permissions - Permission summary
 * @param {Object} securityInfo - Security information (optional)
 */
export const sendLoginSuccess = (res, { user, tokens, session, permissions, securityInfo = null }) => {
    return sendSuccess(res, {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            avatar: user.avatar || null,
            organization_id: user.organization_id,
            department_id: user.department_id,
            is_active: user.is_active,
            organization_name: user.organization_name,
            department_name: user.department_name,
            role_name: user.roles?.[0]?.name || 'Unknown',
            role_color: user.roles?.[0]?.color || '#6B7280',
            role_icon: user.roles?.[0]?.icon || 'user'
        },
        tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            access_token_expires_in: tokens.access_token_expires_in || tokens.expires_in,
            refresh_token_expires_in: tokens.refresh_token_expires_in,
            token_type: tokens.token_type || 'Bearer'
        },
        session: {
            session_id: session.session_id || session.id,
            device_id: session.device_id,
            ip_address: session.ip_address,
            created_at: session.created_at,
            expires_at: session.expires_at
        },
        permissions_summary: {
            total: permissions.total || 0,
            has_admin_access: permissions.has_admin_access || false
        },
        security_info: securityInfo
    }, AUTH_MESSAGES.LOGIN_SUCCESS, 200);
};

/**
 * Token refresh success response  
 * @param {Object} res - Express response object
 * @param {Object} user - User data
 * @param {Object} tokens - New token information
 * @param {Object} session - Session information
 */
export const sendRefreshSuccess = (res, { user, tokens, session }) => {
    return sendSuccess(res, {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            avatar: user.avatar || null,
            organization_id: user.organization_id,
            department_id: user.department_id,
            is_active: user.is_active,
            organization_name: user.organization_name,
            department_name: user.department_name,
            role_name: user.roles?.[0]?.name || 'Unknown',
            role_color: user.roles?.[0]?.color || '#6B7280',
            role_icon: user.roles?.[0]?.icon || 'user'
        },
        tokens: {
            access_token: tokens.access_token,
            access_token_expires_in: tokens.expires_in || tokens.access_token_expires_in,
            token_type: tokens.token_type || 'Bearer'
        },
        session: {
            session_id: session.session_id || session.id,
            created_at: session.created_at,
            expires_at: session.expires_at
        }
    }, AUTH_MESSAGES.TOKEN_REFRESHED, 200);
};

/**
 * Profile success response
 * @param {Object} res - Express response object
 * @param {Object} user - User data with roles and permissions
 */
export const sendProfileSuccess = (res, user) => {
    return sendSuccess(res, {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            organization_id: user.organization_id,
            department_id: user.department_id,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at,
            organization_name: user.organization_name,
            department_name: user.department_name,
            roles: user.roles || [],
            permissions: user.roles?.flatMap(role => role.permissions || []) || []
        }
    }, 'Profile retrieved successfully');
};

/**
 * Authentication error responses
 */
export const sendInvalidCredentials = (res) => {
    return sendError(res, AUTH_MESSAGES.INVALID_CREDENTIALS, 401, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
};

export const sendAccountLocked = (res, timeUntilReset = null) => {
    const details = timeUntilReset ? { 
        time_until_reset: timeUntilReset,
        message: `Account locked. Try again in ${Math.ceil(timeUntilReset / 60000)} minutes.`
    } : null;
    
    return sendError(res, AUTH_MESSAGES.ACCOUNT_LOCKED, 423, AUTH_ERROR_CODES.ACCOUNT_LOCKED, details);
};

export const sendAccountInactive = (res) => {
    return sendError(res, AUTH_MESSAGES.ACCOUNT_INACTIVE, 403, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
};

export const sendTokenExpired = (res) => {
    return sendError(res, AUTH_MESSAGES.TOKEN_EXPIRED, 401, AUTH_ERROR_CODES.TOKEN_EXPIRED);
};

export const sendInvalidRefreshToken = (res) => {
    return sendError(res, AUTH_MESSAGES.REFRESH_TOKEN_INVALID, 401, AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID);
};

export const sendInsufficientPermissions = (res, requiredPermission = null) => {
    const details = requiredPermission ? { required_permission: requiredPermission } : null;
    return sendError(res, AUTH_MESSAGES.INSUFFICIENT_PERMISSIONS, 403, AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS, details);
};

export const sendValidationError = (res, errors) => {
    return sendError(res, 'Validation failed', 400, AUTH_ERROR_CODES.VALIDATION_ERROR, { errors });
};

export const sendInternalError = (res, message = AUTH_MESSAGES.INTERNAL_ERROR) => {
    return sendError(res, message, 500, AUTH_ERROR_CODES.INTERNAL_ERROR);
};