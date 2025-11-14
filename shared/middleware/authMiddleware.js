import jwt from 'jsonwebtoken';
import prisma from '../../config/db.js';
import permissionService from '../services/PermissionService.js';

/**
 * 🔐 AUTHENTICATE - Support both HttpOnly Cookie và Bearer Token
 * Uses JWT for identity + DB for permissions (best practice)
 */
const authMiddleware = async (req, res, next) => {
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

            // ✅ Validate active session
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

        // ✅ Validate user exists and is active
        const userId = decoded.sub || decoded.id;
        
        const userCheck = await prisma.users.findUnique({
            where: { id: userId },
            select: { 
                id: true, 
                is_active: true,
                updated_at: true
            }
        });

        if (!userCheck || !userCheck.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive',
                code: 'AUTH_USER_INACTIVE'
            });
        }

        // ✅ BEST PRACTICE: Load permissions fresh from DB (real-time revocation)
        const userPermissions = await permissionService.getUserPermissions(userId);
        console.log(`🔍 DB: Loaded ${userPermissions.permissions.length} permissions for ${decoded.username}`);

        // ✅ Set user context with DB-loaded permissions
        req.user = {
            id: userId,
            username: decoded.username,
            full_name: decoded.full_name,
            email: decoded.email,
            organization_id: decoded.organization_id,
            department_id: decoded.department_id,
            
            // ✅ FRESH from database - real-time permission revocation
            permissions: userPermissions.permissions,
            roles: userPermissions.roles,
            
            perm_version: decoded.perm_version || 0
        };

        req.authSource = tokenSource;

        console.log('✅ Authentication successful (DB permissions):', {
            username: decoded.username,
            source: tokenSource,
            permissionCount: userPermissions.permissions.length,
            roleCount: userPermissions.roles.length,
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
const optionalAuth = async (req, res, next) => {
    try {
        let token = null;

        if (req.cookies?.access_token) {
            token = req.cookies.access_token;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Load permissions from DB if token is valid
            const userId = decoded.sub || decoded.id;
            const userPermissions = await permissionService.getUserPermissions(userId);
            
            req.user = {
                id: userId,
                username: decoded.username,
                full_name: decoded.full_name,
                permissions: userPermissions.permissions,
                roles: userPermissions.roles
            };
        }

        next();
    } catch (error) {
        // Ignore errors, continue as guest
        next();
    }
};

/**
 * 🛡️ REQUIRE PERMISSION - Check DB-loaded permissions
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // ✅ Check permissions loaded from DB (not JWT)
        if (!req.user.permissions.includes(permission)) {
            console.log(`❌ Permission denied: User ${req.user.username} lacks '${permission}'`);
            console.log(`Available permissions: [${req.user.permissions.join(', ')}]`);
            
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                code: 'AUTH_FORBIDDEN',
                required: permission,
                available: req.user.permissions.length
            });
        }

        console.log(`✅ Permission granted: ${req.user.username} has '${permission}'`);
        next();
    };
};

/**
 * 🎭 REQUIRE ROLE - Check DB-loaded roles
 */
const requireRole = (roleName) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // ✅ Check roles loaded from DB (not JWT)
        if (!req.user.roles.includes(roleName)) {
            console.log(`❌ Role denied: User ${req.user.username} lacks role '${roleName}'`);
            console.log(`Available roles: [${req.user.roles.join(', ')}]`);
            
            return res.status(403).json({
                success: false,
                message: 'Insufficient role',
                code: 'AUTH_FORBIDDEN',
                required: roleName,
                available: req.user.roles
            });
        }

        console.log(`✅ Role granted: ${req.user.username} has role '${roleName}'`);
        next();
    };
};

/**
 * 🔧 Require any of multiple permissions
 */
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const hasAny = permissions.some(permission => 
            req.user.permissions.includes(permission)
        );

        if (!hasAny) {
            console.log(`❌ Permission denied: User ${req.user.username} lacks any of: [${permissions.join(', ')}]`);
            
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                code: 'AUTH_FORBIDDEN',
                required_any: permissions,
                available: req.user.permissions.length
            });
        }

        next();
    };
};

/**
 * 🧹 Invalidate user permission cache (call when user permissions change)
 */
const invalidateUserPermissions = (userId) => {
    permissionService.invalidateUserCache(userId);
};

export {
    authMiddleware,
    optionalAuth,
    requirePermission,
    requireRole,
    requireAnyPermission,
    invalidateUserPermissions
};

// Default export for compatibility
export default authMiddleware;