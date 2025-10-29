import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getUserAllPermissions } from '../utils/permissionHelpers.js';
import permissionCache from '../utils/permissionCache.js';

const prisma = new PrismaClient();

/**
 * 🔐 AUTHENTICATE - Support both HttpOnly Cookie và Bearer Token
 */
export const authMiddleware = async (req, res, next) => {
    try {
        let token = null;
        let tokenSource = null;

        // Get token from header or cookie
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
            tokenSource = 'bearer';
        } else if (req.cookies?.access_token) {
            token = req.cookies.access_token;
            tokenSource = 'cookie';
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_TOKEN_MISSING'
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 🚨 CRITICAL FIX: ALWAYS validate session regardless of token source
        if (!decoded.jti) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token structure - missing session ID',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        // ✅ Validate session in database (for BOTH bearer and cookie)
        const session = await prisma.user_sessions.findUnique({
            where: { id: decoded.jti },
            select: {
                id: true,
                user_id: true,
                expires_at: true,
                is_active: true,
                last_activity: true,
                ip_address: true
            }
        });

        // ✅ Check session exists and is active
        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Session not found',
                code: 'AUTH_SESSION_NOT_FOUND'
            });
        }

        if (!session.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Session has been revoked',
                code: 'AUTH_SESSION_REVOKED'
            });
        }

        if (new Date() > session.expires_at) {
            return res.status(401).json({
                success: false,
                message: 'Session expired',
                code: 'AUTH_SESSION_EXPIRED'
            });
        }

        // ✅ Check inactivity timeout (30 minutes)
        const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        const timeSinceLastActivity = Date.now() - session.last_activity.getTime();
        
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            // Auto-deactivate due to inactivity
            await prisma.user_sessions.update({
                where: { id: session.id },
                data: { is_active: false }
            });
            
            return res.status(401).json({
                success: false,
                message: 'Session timeout due to inactivity',
                code: 'AUTH_SESSION_TIMEOUT'
            });
        }

        // ✅ SECURITY: Check for IP change (optional but recommended)
        const clientIP = req.ip || req.connection.remoteAddress;
        if (session.ip_address && session.ip_address !== clientIP) {
            console.warn(`⚠️ IP changed for session ${session.id}: ${session.ip_address} → ${clientIP}`);
            
            // Option 1: Just log (less strict)
            // Option 2: Require re-auth (more secure)
            // For now, we'll just update the IP
            await prisma.user_sessions.update({
                where: { id: session.id },
                data: { 
                    ip_address: clientIP,
                    last_activity: new Date()
                }
            });
        } else {
            // ✅ Update last activity
            await prisma.user_sessions.update({
                where: { id: session.id },
                data: { last_activity: new Date() }
            });
        }

        // 🚀 Load user permissions with caching for better performance
        const userId = decoded.sub || decoded.id;
        const allPermissions = await permissionCache.getPermissions(userId);

        // ✅ Attach user data to request
        req.user = {
            id: userId,
            username: decoded.username,
            full_name: decoded.full_name,
            email: decoded.email,
            organization_id: decoded.organization_id,
            department_id: decoded.department_id,
            role_ids: decoded.role_ids || [], // ✅ Use role_ids from JWT
            permissions: allPermissions
        };

        req.session = {
            session_id: decoded.jti,
            expires_at: session.expires_at,
            ip_address: session.ip_address
        };

        req.authSource = tokenSource;

        next();

    } catch (error) {
        console.error('❌ Authentication error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Access token expired',
                code: 'AUTH_TOKEN_EXPIRED',
                hint: 'Use /auth/refresh to get new token'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * 🔓 OPTIONAL AUTH - Support both token sources
 */
export const optionalAuth = async (req, res, next) => {
    try {
        let token = null;

        if (req.cookies?.access_token) {
            token = req.cookies.access_token;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                id: decoded.sub || decoded.id,
                username: decoded.username,
                roles: decoded.roles || []
            };
        }

        next();
    } catch (error) {
        // Ignore errors, continue as guest
        next();
    }
};

/**
 * 🛡️ REQUIRE PERMISSION - Check user permissions
 */
export const requirePermission = (permission) => {
    return (req, res, next) => {
        const userPermissions = req.user?.roles
            ?.flatMap(role => role.permissions || []) || [];

        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                code: 'AUTH_FORBIDDEN',
                required: permission
            });
        }

        next();
    };
};

/**
 * 🎭 REQUIRE ROLE - Check user roles
 */
export const requireRole = (roleName) => {
    return (req, res, next) => {
        const userRoles = req.user?.roles?.map(r => r.name) || [];

        if (!userRoles.includes(roleName)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient role',
                code: 'AUTH_FORBIDDEN',
                required: roleName
            });
        }

        next();
    };
};

// 🔐 Export default for backward compatibility
export default authMiddleware;