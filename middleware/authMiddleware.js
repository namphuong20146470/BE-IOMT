import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getUserAllPermissions } from '../shared/utils/permissionHelpers.js';

const prisma = new PrismaClient();

/**
 * 🔐 AUTHENTICATE - Support both HttpOnly Cookie và Bearer Token
 */
export const authMiddleware = async (req, res, next) => {
    try {
        let token = null;
        let tokenSource = null;

        // ✅ Priority 1: Check Authorization Header (localStorage)
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
            tokenSource = 'bearer';
        }
        // ✅ Priority 2: Check HttpOnly Cookie (fallback)
        else if (req.cookies?.access_token) {
            token = req.cookies.access_token;
            tokenSource = 'cookie';
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_TOKEN_MISSING',
                hint: 'Provide token via Authorization header or HttpOnly cookie'
            });
        }

        // ✅ Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 JWT Decoded:', {
            jti: decoded.jti,
            sub: decoded.sub,
            username: decoded.username,
            tokenSource,
            exp: new Date(decoded.exp * 1000).toISOString()
        });

        // ✅ Session validation (only for cookie-based auth)
        if (tokenSource === 'cookie') {
            if (!decoded.jti) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token structure - missing session ID',
                    code: 'AUTH_TOKEN_INVALID'
                });
            }

            // ✅ FIXED: Correct variable names and validation
            const session = await prisma.user_sessions.findUnique({
                where: {
                    id: decoded.jti
                },
                select: {
                    id: true,
                    user_id: true,
                    expires_at: true,
                    is_active: true,
                    last_activity: true
                }
            });

            console.log('🔍 Session found:', session);

            // ✅ FIXED: Check for null and validate session
            if (!session || !session.is_active || new Date() > session.expires_at) {
                return res.status(401).json({
                    success: false,
                    message: 'Session expired or invalid',
                    code: 'AUTH_SESSION_INVALID'
                });
            }

            // ✅ Update session activity
            await prisma.user_sessions.update({
                where: { id: session.id },
                data: { last_activity: new Date() }
            });

            req.session = {
                session_id: decoded.jti,
                expires_at: session.expires_at
            };
        }

        // ✅ Load full user permissions from database
        const userId = decoded.sub || decoded.id;
        const allPermissions = await getUserAllPermissions(userId);

        // ✅ Attach user data to request
        req.user = {
            id: userId,
            username: decoded.username,
            full_name: decoded.full_name,
            email: decoded.email,
            organization_id: decoded.organization_id,
            department_id: decoded.department_id,
            roles: decoded.roles || [],
            permissions: allPermissions // Include all permissions (from roles + direct)
        };

        req.authSource = tokenSource;

        console.log('✅ Authentication successful:', {
            username: decoded.username,
            source: tokenSource,
            hasSession: !!req.session
        });

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
            code: 'AUTH_ERROR',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
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