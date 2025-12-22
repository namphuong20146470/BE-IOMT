/**
 * Auth Constants & Configuration
 * Single source of truth for auth-related constants
 */

// ========== COOKIE CONFIGURATION ==========
export const COOKIE_OPTIONS = {
    access: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
        domain: undefined
    },
    refresh: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
    }
};

// ========== PASSWORD CONFIGURATION ==========
export const PASSWORD_CONFIG = {
    MIN_LENGTH: 8,
    BCRYPT_ROUNDS: 10,
    HASH_ALGORITHM: 'sha256' // For legacy password
};

// ========== SESSION CONFIGURATION ==========
export const SESSION_CONFIG = {
    ACCESS_TOKEN_EXPIRES_IN: 15 * 60, // 15 minutes in seconds
    REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7 days in seconds
    INVALIDATE_OTHER_SESSIONS_ON_PASSWORD_CHANGE: true
};

// ========== VALIDATION PATTERNS ==========
export const VALIDATION_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_VN: /^(\+84|84|0)?[3|5|7|8|9][0-9]{8,9}$/
};

// ========== ERROR CODES ==========
export const AUTH_ERROR_CODES = {
    // Missing data
    MISSING_CREDENTIALS: 'AUTH_MISSING_CREDENTIALS',
    MISSING_PASSWORDS: 'AUTH_MISSING_PASSWORDS',
    TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
    REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
    USER_ID_NOT_FOUND: 'AUTH_USER_ID_NOT_FOUND',
    
    // Invalid data
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
    INVALID_EMAIL: 'VALIDATION_INVALID_EMAIL',
    INVALID_PHONE: 'VALIDATION_INVALID_PHONE',
    PASSWORD_TOO_SHORT: 'AUTH_PASSWORD_TOO_SHORT',
    
    // Not found
    USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
    USER_INACTIVE: 'AUTH_USER_INACTIVE',
    
    // Session errors
    SESSION_ERROR: 'AUTH_SESSION_ERROR',
    SESSION_INVALID: 'AUTH_SESSION_INVALID',
    TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    
    // General errors
    INTERNAL_ERROR: 'AUTH_INTERNAL_ERROR',
    LOGOUT_ERROR: 'AUTH_LOGOUT_ERROR',
    REFRESH_ERROR: 'AUTH_REFRESH_ERROR',
    PROFILE_ERROR: 'AUTH_PROFILE_ERROR',
    PASSWORD_CHANGE_ERROR: 'AUTH_PASSWORD_CHANGE_ERROR',
    VERIFY_ERROR: 'AUTH_VERIFY_ERROR'
};

// ========== AUDIT ACTIONS ==========
export const AUDIT_ACTIONS = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    FAILED_LOGIN: 'FAILED_LOGIN',
    LOGIN_ERROR: 'LOGIN_ERROR',
    PASSWORD_CHANGED: 'PASSWORD_CHANGED',
    FAILED_PASSWORD_CHANGE: 'FAILED_PASSWORD_CHANGE',
    PROFILE_UPDATED: 'PROFILE_UPDATED',
    TOKEN_REFRESHED: 'TOKEN_REFRESHED'
};

// ========== CACHE CONFIGURATION ==========
export const CACHE_CONFIG = {
    PERMISSIONS_CACHE_MAX_AGE: 900, // 15 minutes in seconds
    ETAG_ENABLED: true
};

// ========== DEFAULT VALUES ==========
export const DEFAULT_VALUES = {
    ROLE: {
        name: 'Unknown',
        color: '#6B7280',
        icon: 'user'
    },
    DEVICE_ID: 'unknown-device',
    PLATFORM: 'Unknown',
    BROWSER: 'Unknown'
};

export default {
    COOKIE_OPTIONS,
    PASSWORD_CONFIG,
    SESSION_CONFIG,
    VALIDATION_PATTERNS,
    AUTH_ERROR_CODES,
    AUDIT_ACTIONS,
    CACHE_CONFIG,
    DEFAULT_VALUES
};
