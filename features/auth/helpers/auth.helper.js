/**
 * 🔐 Authentication Helper Functions
 * Common utility functions for authentication
 */

import useragent from 'express-useragent';
import { COOKIE_OPTIONS, DEVICE_INFO_FIELDS } from '../constants/auth.constants.js';

/**
 * Extract client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client info object
 */
export const extractClientInfo = (req) => {
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     'Unknown';
    
    // Parse user agent
    const ua = useragent.parse(userAgent);
    
    return {
        [DEVICE_INFO_FIELDS.USER_AGENT]: userAgent,
        [DEVICE_INFO_FIELDS.IP_ADDRESS]: ipAddress,
        [DEVICE_INFO_FIELDS.PLATFORM]: ua.platform || 'Unknown',
        [DEVICE_INFO_FIELDS.BROWSER]: ua.browser || 'Unknown',
        [DEVICE_INFO_FIELDS.VERSION]: ua.version || 'Unknown',
        ipAddress, // Keep legacy field for backward compatibility
        userAgent // Keep legacy field for backward compatibility
    };
};

/**
 * Generate device ID from client info
 * @param {Object} clientInfo - Client information
 * @returns {string} Unique device identifier
 */
export const generateDeviceId = (clientInfo) => {
    const {
        user_agent = 'Unknown',
        platform = 'Unknown', 
        browser = 'Unknown'
    } = clientInfo;
    
    return JSON.stringify({
        user_agent,
        platform,
        browser
    });
};

/**
 * Set authentication cookies
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token
 */
export const setAuthCookies = (res, accessToken, refreshToken) => {
    if (accessToken) {
        res.cookie('access_token', accessToken, COOKIE_OPTIONS.access);
    }
    
    if (refreshToken) {
        res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS.refresh);
    }
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
export const clearAuthCookies = (res) => {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth' });
    res.clearCookie('session_id', { path: '/' });
};

/**
 * Validate password against policy
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
export const validatePassword = (password) => {
    const errors = [];
    
    if (!password) {
        errors.push('Password is required');
        return { valid: false, errors };
    }
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
        errors.push('Password must not exceed 128 characters');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Sanitize user data for client response
 * @param {Object} user - User object from database
 * @returns {Object} Sanitized user object
 */
export const sanitizeUserData = (user) => {
    if (!user) return null;
    
    const {
        password_hash,
        password_salt,
        reset_token,
        reset_token_expires,
        email_verification_token,
        two_fa_secret,
        ...sanitizedUser
    } = user;
    
    return sanitizedUser;
};

/**
 * Format user data for JWT token
 * @param {Object} user - User object
 * @returns {Object} User data for JWT
 */
export const formatUserForToken = (user) => {
    if (!user) return null;
    
    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        organization_id: user.organization_id,
        department_id: user.department_id,
        roles: user.roles || [],
        is_active: user.is_active
    };
};

/**
 * Check if user has required permission
 * @param {Object} user - User object with roles
 * @param {string} requiredPermission - Required permission
 * @returns {boolean} Has permission
 */
export const hasPermission = (user, requiredPermission) => {
    if (!user || !user.roles) return false;
    
    // Super admin has all permissions
    const isSuperAdmin = user.roles.some(role => 
        role.name?.toLowerCase() === 'super admin' || 
        role.name?.toLowerCase() === 'superadmin'
    );
    
    if (isSuperAdmin) return true;
    
    // Check specific permission
    return user.roles.some(role => 
        role.permissions && 
        role.permissions.includes(requiredPermission)
    );
};

/**
 * Calculate token expiry date
 * @param {number} expiresInSeconds - Expiry in seconds
 * @returns {Date} Expiry date
 */
export const calculateExpiryDate = (expiresInSeconds) => {
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + expiresInSeconds);
    return expiry;
};

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Random hex token
 */
export const generateSecureToken = (length = 32) => {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Rate limiting helper
 * @param {string} key - Unique key for rate limiting
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} Rate limit status
 */
const rateLimitStore = new Map();

export const checkRateLimit = (key, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const now = Date.now();
    const record = rateLimitStore.get(key) || { attempts: 0, resetTime: now + windowMs };
    
    // Reset if window has passed
    if (now >= record.resetTime) {
        record.attempts = 0;
        record.resetTime = now + windowMs;
    }
    
    record.attempts++;
    rateLimitStore.set(key, record);
    
    return {
        allowed: record.attempts <= maxAttempts,
        attempts: record.attempts,
        maxAttempts,
        resetTime: record.resetTime,
        timeUntilReset: Math.max(0, record.resetTime - now)
    };
};