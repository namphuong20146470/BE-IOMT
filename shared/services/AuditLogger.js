/**
 * Enhanced Audit Logger Service
 * Provides standardized audit logging across the application
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class AuditLogger {
    /**
     * Log an audit event with enhanced data validation and standardization
     */
    static async log({
        req = null,
        user_id = null,
        organization_id = null,
        action,
        resource_type = null,
        resource_id = null,
        old_values = null,
        new_values = null,
        success = true,
        error_message = null,
        ip_address = null,
        user_agent = null
    }) {
        try {
            // Extract metadata from request if provided
            let extractedIP = ip_address;
            let extractedUA = user_agent;
            
            if (req) {
                // Enhanced IP detection with debugging
                const ipSources = {
                    req_ip: req.ip,
                    connection_remote: req.connection?.remoteAddress,
                    socket_remote: req.socket?.remoteAddress,
                    x_forwarded_for: req.headers['x-forwarded-for'],
                    x_real_ip: req.headers['x-real-ip'],
                    x_client_ip: req.headers['x-client-ip'],
                    cf_connecting_ip: req.headers['cf-connecting-ip'] // Cloudflare
                };

                extractedIP = extractedIP || 
                             req.ip || 
                             req.connection?.remoteAddress || 
                             req.socket?.remoteAddress ||
                             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                             req.headers['x-real-ip'] ||
                             req.headers['x-client-ip'] ||
                             req.headers['cf-connecting-ip'] ||
                             '127.0.0.1';
                
                // Clean IPv6 mapped IPv4 addresses
                if (extractedIP && extractedIP.startsWith('::ffff:')) {
                    extractedIP = extractedIP.substring(7);
                }

                extractedUA = extractedUA || 
                             req.get('User-Agent') || 
                             req.headers['user-agent'] || 
                             'Unknown-Agent';

                // Debug IP detection in development
                if (process.env.NODE_ENV === 'development' && !ip_address) {
                    console.log('🔍 IP Detection Debug:', {
                        final_ip: extractedIP,
                        sources: ipSources,
                        headers_subset: {
                            'x-forwarded-for': req.headers['x-forwarded-for'],
                            'x-real-ip': req.headers['x-real-ip'],
                            'user-agent': req.headers['user-agent']
                        }
                    });
                }
            }

            // Extract user info from request if user_id not provided
            if (req?.user && !user_id) {
                user_id = req.user.id;
                organization_id = organization_id || req.user.organization_id;
            }

            // Validate required fields
            if (!action || typeof action !== 'string') {
                throw new Error('Action is required and must be a string');
            }

            // Normalize and validate data
            const normalizedData = {
                user_id: user_id || null,
                organization_id: organization_id || null,
                action: this.normalizeAction(action),
                resource_type: resource_type ? this.normalizeResourceType(resource_type) : null,
                resource_id: resource_id || null,
                old_values: this.sanitizeJSON(old_values),
                new_values: this.sanitizeJSON(new_values),
                ip_address: extractedIP || 'unknown',
                user_agent: this.sanitizeUserAgent(extractedUA),
                success: Boolean(success),
                error_message: error_message ? String(error_message).substring(0, 1000) : null
            };

            // Create audit log entry
            const auditLog = await prisma.audit_logs.create({
                data: normalizedData,
                include: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            full_name: true,
                            email: true
                        }
                    },
                    organizations: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                }
            });

            return auditLog;

        } catch (error) {
            console.error('❌ Audit logging failed:', error);
            
            // Try to log the error itself (without causing infinite loop)
            try {
                await prisma.audit_logs.create({
                    data: {
                        user_id: user_id || null,
                        organization_id: organization_id || null,
                        action: 'audit_error',
                        resource_type: 'audit_system',
                        resource_id: null,
                        old_values: null,
                        new_values: { 
                            original_action: action,
                            error_details: error.message 
                        },
                        ip_address: extractedIP || 'unknown',
                        user_agent: extractedUA || 'Unknown-Agent',
                        success: false,
                        error_message: `Audit logging failed: ${error.message}`
                    }
                });
            } catch (metaError) {
                console.error('❌ Meta-audit logging failed:', metaError);
            }
            
            // Don't throw error to avoid breaking main application flow
            return null;
        }
    }

    /**
     * Normalize action to standard format
     */
    static normalizeAction(action) {
        const validActions = [
            'create', 'read', 'update', 'delete',
            'login', 'logout', 'failed_login',
            'permission_granted', 'permission_revoked',
            'role_assigned', 'role_removed',
            'export', 'import', 'backup', 'restore'
        ];

        const normalized = String(action).toLowerCase().trim();
        
        // Map common variations
        const actionMap = {
            'insert': 'create',
            'add': 'create',
            'new': 'create',
            'view': 'read',
            'get': 'read',
            'fetch': 'read',
            'list': 'read',
            'modify': 'update',
            'edit': 'update',
            'change': 'update',
            'remove': 'delete',
            'destroy': 'delete',
            'signin': 'login',
            'authenticate': 'login',
            'signout': 'logout',
            'logoff': 'logout',
            'failed_auth': 'failed_login',
            'auth_failed': 'failed_login'
        };

        const mappedAction = actionMap[normalized] || normalized;
        
        // Validate against allowed actions
        if (!validActions.includes(mappedAction)) {
            console.warn(`⚠️ Unknown action: ${action}, using as-is`);
            return mappedAction;
        }
        
        return mappedAction;
    }

    /**
     * Normalize resource type
     */
    static normalizeResourceType(resourceType) {
        if (!resourceType) return null;
        
        const normalized = String(resourceType).toLowerCase().trim();
        
        // Common resource type mappings
        const typeMap = {
            'devices': 'device',
            'users': 'user',
            'organizations': 'organization',
            'departments': 'department',
            'roles': 'role',
            'permissions': 'permission',
            'sessions': 'session',
            'auth': 'authentication',
            'authentication': 'auth'
        };
        
        return typeMap[normalized] || normalized;
    }

    /**
     * Sanitize JSON objects for storage
     */
    static sanitizeJSON(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }

        try {
            // Remove null/undefined values and sensitive data
            const sanitized = {};
            const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
            
            for (const [key, value] of Object.entries(data)) {
                // Skip sensitive keys
                if (sensitiveKeys.some(sensitive => 
                    key.toLowerCase().includes(sensitive))) {
                    sanitized[key] = '[REDACTED]';
                    continue;
                }
                
                // Skip null/undefined values
                if (value === null || value === undefined) {
                    continue;
                }
                
                // Limit string length
                if (typeof value === 'string' && value.length > 500) {
                    sanitized[key] = value.substring(0, 500) + '... [TRUNCATED]';
                } else {
                    sanitized[key] = value;
                }
            }
            
            return Object.keys(sanitized).length > 0 ? sanitized : null;
        } catch (error) {
            console.warn('⚠️ JSON sanitization failed:', error);
            return { error: 'Failed to sanitize data' };
        }
    }

    /**
     * Sanitize user agent string
     */
    static sanitizeUserAgent(userAgent) {
        if (!userAgent) return 'Unknown-Agent';
        
        const sanitized = String(userAgent)
            .substring(0, 500)
            .replace(/[<>]/g, '') // Remove potential XSS chars
            .trim();
            
        return sanitized || 'Unknown-Agent';
    }

    /**
     * Log authentication events
     */
    static async logAuth({
        req,
        user_id,
        username,
        action, // 'login', 'logout', 'failed_login'
        success = true,
        error_message = null,
        additional_data = {}
    }) {
        const authData = {
            username: username,
            ip: req?.ip || 'unknown',
            userAgent: req?.get('User-Agent') || 'Unknown',
            timestamp: new Date().toISOString(),
            ...additional_data
        };

        return await this.log({
            req,
            user_id,
            action,
            resource_type: 'auth',
            resource_id: user_id,
            new_values: authData,
            success,
            error_message
        });
    }

    /**
     * Log CRUD operations
     */
    static async logCRUD({
        req,
        action, // 'create', 'read', 'update', 'delete'
        resource_type,
        resource_id,
        old_values = null,
        new_values = null,
        success = true,
        error_message = null
    }) {
        return await this.log({
            req,
            action,
            resource_type,
            resource_id,
            old_values,
            new_values,
            success,
            error_message
        });
    }

    /**
     * Log security events
     */
    static async logSecurity({
        req,
        event_type, // 'permission_granted', 'role_assigned', etc.
        target_user_id = null,
        details = {},
        success = true,
        error_message = null
    }) {
        return await this.log({
            req,
            action: event_type,
            resource_type: 'security',
            resource_id: target_user_id,
            new_values: details,
            success,
            error_message
        });
    }

    /**
     * Bulk log multiple events (for batch operations)
     */
    static async logBatch(events) {
        const results = [];
        
        for (const event of events) {
            try {
                const result = await this.log(event);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Get audit statistics for monitoring
     */
    static async getStats(days = 1) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        try {
            const [totalLogs, successLogs, failureLogs, topActions] = await Promise.all([
                prisma.audit_logs.count({
                    where: { created_at: { gte: fromDate } }
                }),
                prisma.audit_logs.count({
                    where: { 
                        created_at: { gte: fromDate },
                        success: true 
                    }
                }),
                prisma.audit_logs.count({
                    where: { 
                        created_at: { gte: fromDate },
                        success: false 
                    }
                }),
                prisma.audit_logs.groupBy({
                    by: ['action'],
                    where: { created_at: { gte: fromDate } },
                    _count: { action: true },
                    orderBy: { _count: { action: 'desc' } },
                    take: 5
                })
            ]);

            return {
                period_days: days,
                total_logs: totalLogs,
                success_logs: successLogs,
                failure_logs: failureLogs,
                success_rate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(2) : 0,
                top_actions: topActions.map(item => ({
                    action: item.action,
                    count: item._count.action
                }))
            };
        } catch (error) {
            console.error('❌ Failed to get audit stats:', error);
            return null;
        }
    }
}

export default AuditLogger;