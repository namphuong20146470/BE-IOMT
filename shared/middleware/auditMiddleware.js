/**
 * Audit Middleware - Automatically logs API calls for audit purposes
 */

import AuditLogger from '../services/AuditLogger.js';

/**
 * Middleware to automatically audit API requests
 */
export const auditMiddleware = (options = {}) => {
    const {
        skipPaths = ['/health', '/metrics', '/favicon.ico'],
        skipMethods = ['OPTIONS'],
        logOnlyAuthenticatedUsers = true,
        includeRequestBody = false,
        includeResponseData = false
    } = options;

    return async (req, res, next) => {
        // Skip certain paths and methods
        if (skipPaths.some(path => req.path.includes(path)) || 
            skipMethods.includes(req.method)) {
            return next();
        }

        // Skip if only logging authenticated users and user is not authenticated
        if (logOnlyAuthenticatedUsers && !req.user) {
            return next();
        }

        const startTime = Date.now();
        
        // Store original res.json to capture response
        const originalJson = res.json.bind(res);
        let responseData = null;
        
        if (includeResponseData) {
            res.json = function(data) {
                responseData = data;
                return originalJson(data);
            };
        }

        // Continue with request processing
        next();

        // Log after response is sent
        res.on('finish', async () => {
            try {
                const duration = Date.now() - startTime;
                const success = res.statusCode < 400;
                
                // Determine action based on HTTP method
                const actionMap = {
                    'GET': 'read',
                    'POST': 'create', 
                    'PUT': 'update',
                    'PATCH': 'update',
                    'DELETE': 'delete'
                };
                
                const action = actionMap[req.method] || 'unknown';
                
                // Extract resource info from path
                const pathSegments = req.path.split('/').filter(Boolean);
                let resource_type = null;
                let resource_id = null;
                
                if (pathSegments.length > 0) {
                    // Try to identify resource type and ID from path
                    // Example: /api/devices/123 -> resource_type: 'device', resource_id: '123'
                    for (let i = 0; i < pathSegments.length; i++) {
                        const segment = pathSegments[i];
                        
                        // Skip 'api' and version segments
                        if (segment === 'api' || segment.match(/^v\d+$/)) {
                            continue;
                        }
                        
                        // Resource type (plural to singular)
                        if (!resource_type) {
                            resource_type = segment.endsWith('s') ? 
                                segment.slice(0, -1) : segment;
                        }
                        
                        // Resource ID (UUID or numeric)
                        if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
                            segment.match(/^\d+$/)) {
                            resource_id = segment;
                            break;
                        }
                    }
                }
                
                // Prepare audit data
                const auditData = {
                    method: req.method,
                    path: req.path,
                    query: Object.keys(req.query).length > 0 ? req.query : undefined,
                    status_code: res.statusCode,
                    duration_ms: duration,
                    content_length: res.get('content-length') || 0
                };
                
                // Add request body if enabled (be careful with sensitive data)
                if (includeRequestBody && req.body && Object.keys(req.body).length > 0) {
                    auditData.request_body = req.body;
                }
                
                // Add response data if enabled and successful
                if (includeResponseData && success && responseData) {
                    auditData.response_data = responseData;
                }
                
                // Add error info for failed requests
                if (!success) {
                    auditData.error_details = {
                        status_code: res.statusCode,
                        status_message: res.statusMessage
                    };
                }

                // Log the API call
                await AuditLogger.log({
                    req,
                    action: `api_${action}`,
                    resource_type: resource_type || 'api',
                    resource_id: resource_id,
                    new_values: auditData,
                    success,
                    error_message: !success ? `HTTP ${res.statusCode}: ${res.statusMessage}` : null
                });
                
            } catch (error) {
                console.error('❌ Audit middleware error:', error);
                // Don't throw error to avoid breaking application
            }
        });
    };
};

/**
 * Audit specific operations (for manual logging)
 */
export const auditOperation = {
    /**
     * Log authentication events
     */
    auth: async (req, { action, user_id, username, success, error_message, additional_data = {} }) => {
        return await AuditLogger.logAuth({
            req,
            user_id,
            username,
            action,
            success,
            error_message,
            additional_data
        });
    },

    /**
     * Log CRUD operations
     */
    crud: async (req, { action, resource_type, resource_id, old_values, new_values, success = true, error_message }) => {
        return await AuditLogger.logCRUD({
            req,
            action,
            resource_type,
            resource_id,
            old_values,
            new_values,
            success,
            error_message
        });
    },

    /**
     * Log security events
     */
    security: async (req, { event_type, target_user_id, details, success = true, error_message }) => {
        return await AuditLogger.logSecurity({
            req,
            event_type,
            target_user_id,
            details,
            success,
            error_message
        });
    },

    /**
     * Log custom events
     */
    custom: async (req, auditData) => {
        return await AuditLogger.log({
            req,
            ...auditData
        });
    }
};

/**
 * Middleware for specific operations
 */
export const auditAuth = (req, res, next) => {
    // Add audit helper to request
    req.audit = {
        logAuth: (data) => auditOperation.auth(req, data),
        logCRUD: (data) => auditOperation.crud(req, data),
        logSecurity: (data) => auditOperation.security(req, data),
        log: (data) => auditOperation.custom(req, data)
    };
    
    next();
};

export default {
    auditMiddleware,
    auditOperation,
    auditAuth
};