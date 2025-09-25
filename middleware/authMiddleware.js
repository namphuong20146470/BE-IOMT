import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import permissionService from '../services/PermissionService.js';
import sessionService from '../services/SessionService.js';
import auditService from '../services/AuditService.js';

const prisma = new PrismaClient();

/**
 * Authentication Middleware - JWT Token Validation & User Loading
 * Focuses ONLY on authentication, not authorization
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next function
 */
export default async function authMiddleware(req, res, next) {
    try {
        console.log('🔐 Starting authentication...');
        
        // Extract token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ No Bearer token found');
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required',
                code: 'AUTH_TOKEN_MISSING'
            });
        }

        const token = authHeader.substring(7);
        console.log('🎫 Token extracted:', token.substring(0, 20) + '...');

        // Validate token using SessionService
        const sessionValidation = await sessionService.validateAccessToken(token);
        if (!sessionValidation) {
            console.log('❌ Invalid session: token validation failed');
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired token',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        console.log('✅ Session validated for user:', sessionValidation.user.id);
        
        // Get user with complete information
        const user = await prisma.users.findUnique({
            where: { id: sessionValidation.user.id },
            include: {
                user_roles: {
                    include: {
                        roles: {
                            include: {
                                role_permissions: {
                                    include: {
                                        permissions: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            console.log('❌ User not found:', sessionValidation.user.id);
            return res.status(401).json({ 
                success: false, 
                message: 'User not found',
                code: 'AUTH_USER_NOT_FOUND'
            });
        }

        console.log('✅ User loaded:', user.username);

        // Load permissions using PermissionService
        const permissions = await permissionService.getUserPermissions(user.id);
        console.log('🔑 Permissions loaded:', permissions.length);

        // Attach user and session info to request
        req.user = user;
        req.session = sessionValidation;
        req.permissions = permissions;
        req.userRoles = user.user_roles.map(ur => ur.roles.name);
        
        // Authentication success
        console.log('👤 User authenticated successfully:', {
            userId: user.id,
            userName: user.username,
            organizationId: user.organization_id,
            roles: req.userRoles,
            permissions: permissions.length
        });

        // Log successful authentication (optional)
        try {
            await auditService.logUserActivity({
                user_id: user.id,
                action: 'AUTH_SUCCESS',
                details: {
                    session_id: sessionValidation.session_id,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            });
        } catch (auditError) {
            console.error('Audit log error:', auditError);
        }

        next();

    } catch (error) {
        console.error('💥 Authentication error:', error);
        
        // Log authentication failure (optional)
        try {
            await auditService.logUserActivity({
                user_id: req.ip, // fallback
                action: 'AUTH_FAILED',
                details: {
                    error: error.message,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            });
        } catch (auditError) {
            console.error('Audit log error:', auditError);
        }

        return res.status(401).json({ 
            success: false, 
            message: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
}



// Export session service for use in controllers
export { sessionService };