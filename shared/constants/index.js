/**
 * Shared Constants
 * Centralized constants used across the application
 */

// ==========================================
// HTTP STATUS CODES
// ==========================================
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500
};

// ==========================================
// PERMISSION ACTIONS
// ==========================================
export const PERMISSIONS = {
    // User permissions
    USER: {
        READ: 'user.read',
        CREATE: 'user.create', 
        UPDATE: 'user.update',
        DELETE: 'user.delete',
        MANAGE: 'user.manage'
    },
    
    // Device permissions
    DEVICE: {
        READ: 'device.read',
        CREATE: 'device.create',
        UPDATE: 'device.update',
        DELETE: 'device.delete',
        CALIBRATE: 'device.calibrate',
        CONTROL: 'device.control'
    },
    
    // Permission management
    PERMISSION: {
        READ: 'permission.read',
        CREATE: 'permission.create',
        UPDATE: 'permission.update',
        DELETE: 'permission.delete'
    },
    
    // Role management
    ROLE: {
        READ: 'role.read',
        CREATE: 'role.create',
        UPDATE: 'role.update', 
        DELETE: 'role.delete',
        ASSIGN: 'role.assign'
    },
    
    // Organization management
    ORGANIZATION: {
        READ: 'organization.read',
        CREATE: 'organization.create',
        UPDATE: 'organization.update',
        DELETE: 'organization.delete'
    },
    
    // Specification management
    SPECIFICATION: {
        READ: 'specification.read',
        CREATE: 'specification.create',
        UPDATE: 'specification.update',
        DELETE: 'specification.delete'
    }
};

// ==========================================
// USER ROLES
// ==========================================
export const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    GUEST: 'guest'
};

// ==========================================
// DEVICE STATUS
// ==========================================
export const DEVICE_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    MAINTENANCE: 'maintenance',
    ERROR: 'error',
    OFFLINE: 'offline'
};

// ==========================================
// USER STATUS
// ==========================================
export const USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    PENDING: 'pending'
};

// ==========================================
// API RESPONSE MESSAGES
// ==========================================
export const MESSAGES = {
    // Success messages
    SUCCESS: {
        CREATED: 'Resource created successfully',
        UPDATED: 'Resource updated successfully',
        DELETED: 'Resource deleted successfully',
        RETRIEVED: 'Data retrieved successfully'
    },
    
    // Error messages
    ERROR: {
        INTERNAL: 'Internal server error',
        NOT_FOUND: 'Resource not found',
        UNAUTHORIZED: 'Authentication required',
        FORBIDDEN: 'Insufficient permissions',
        VALIDATION: 'Validation error',
        DUPLICATE: 'Resource already exists'
    }
};

// ==========================================
// PAGINATION DEFAULTS
// ==========================================
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
};

// ==========================================
// JWT CONFIG
// ==========================================
export const JWT_CONFIG = {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    ALGORITHM: 'HS256'
};

// ==========================================
// VALIDATION RULES
// ==========================================
export const VALIDATION_RULES = {
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 50
    },
    PASSWORD: {
        MIN_LENGTH: 6,
        MAX_LENGTH: 128
    },
    EMAIL: {
        MAX_LENGTH: 255
    },
    PHONE: {
        MIN_LENGTH: 10,
        MAX_LENGTH: 11
    }
};