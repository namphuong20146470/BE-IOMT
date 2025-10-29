/**
 * 🔐 Authentication Constants
 * Centralized constants for authentication features
 */

// Session Configuration
export const SESSION_CONFIG = {
    ACCESS_TOKEN_EXPIRES_IN: 30 * 60, // 30 minutes in seconds
    REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7 days in seconds
    SESSION_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    MAX_SESSIONS_PER_USER: 5
};

// Cookie Configuration
export const COOKIE_OPTIONS = {
    access: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_CONFIG.ACCESS_TOKEN_EXPIRES_IN * 1000,
        path: '/'
    },
    refresh: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'strict',
        maxAge: SESSION_CONFIG.REFRESH_TOKEN_EXPIRES_IN * 1000,
        path: '/auth'
    }
};

// Authentication Error Codes
export const AUTH_ERROR_CODES = {
    // Login Errors
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
    ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
    TOO_MANY_ATTEMPTS: 'AUTH_TOO_MANY_ATTEMPTS',
    
    // Token Errors
    TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
    REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
    
    // Session Errors
    SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
    SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
    MAX_SESSIONS_EXCEEDED: 'AUTH_MAX_SESSIONS_EXCEEDED',
    
    // Permission Errors
    INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
    ACCESS_DENIED: 'AUTH_ACCESS_DENIED',
    
    // General
    INTERNAL_ERROR: 'AUTH_INTERNAL_ERROR',
    VALIDATION_ERROR: 'AUTH_VALIDATION_ERROR'
};

// Authentication Messages
export const AUTH_MESSAGES = {
    // Success Messages
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful', 
    TOKEN_REFRESHED: 'Token refreshed successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    
    // Error Messages
    INVALID_CREDENTIALS: 'Invalid username or password',
    ACCOUNT_LOCKED: 'Account is locked due to multiple failed login attempts',
    ACCOUNT_INACTIVE: 'Account is inactive. Please contact administrator',
    TOKEN_EXPIRED: 'Access token has expired. Please refresh or login again',
    REFRESH_TOKEN_INVALID: 'Invalid or expired refresh token',
    SESSION_EXPIRED: 'Session has expired. Please login again',
    INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
    INTERNAL_ERROR: 'Internal server error. Please try again later'
};

// Password Policy
export const PASSWORD_POLICY = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    MAX_HISTORY: 5, // Remember last 5 passwords
    EXPIRY_DAYS: 90 // Password expires after 90 days
};

// Login Attempt Configuration
export const LOGIN_ATTEMPT_CONFIG = {
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    RESET_ATTEMPTS_AFTER: 60 * 60 * 1000, // 1 hour
    TRACK_BY_IP: true,
    TRACK_BY_USERNAME: true
};

// JWT Configuration
export const JWT_CONFIG = {
    ALGORITHM: 'HS256',
    ISSUER: 'iomt-system',
    AUDIENCE: 'iomt-users',
    CLOCK_TOLERANCE: 30, // 30 seconds
    MAX_AGE: SESSION_CONFIG.ACCESS_TOKEN_EXPIRES_IN
};

// Device Detection
export const DEVICE_INFO_FIELDS = {
    USER_AGENT: 'user_agent',
    IP_ADDRESS: 'ip_address',
    PLATFORM: 'platform',
    BROWSER: 'browser',
    VERSION: 'version',
    DEVICE_ID: 'device_id'
};

// Audit Events
export const AUTH_AUDIT_EVENTS = {
    LOGIN_SUCCESS: 'login',
    LOGIN_FAILED: 'failed_login',
    LOGOUT: 'logout',
    TOKEN_REFRESH: 'login', // Treat refresh as login activity
    PASSWORD_CHANGE: 'password_changed',
    PROFILE_UPDATE: 'update',
    SESSION_EXPIRED: 'logout',
    ACCOUNT_LOCKED: 'access_denied',
    PERMISSION_DENIED: 'access_denied'
};