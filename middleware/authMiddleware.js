import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 🔐 AUTHENTICATE - Middleware đọc token từ HTTP-Only Cookie
 */
export const authMiddleware = async (req, res, next) => {
    try {
        // ✅ Đọc token từ cookie
        const token = req.cookies?.access_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_TOKEN_MISSING'
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Validate session trong database
        const sessions = await prisma.$queryRaw`
            SELECT session_id, user_id, expires_at, is_valid
            FROM user_sessions
            WHERE session_id = ${decoded.jti}::uuid
            AND is_valid = true
            AND expires_at > NOW()
        `;

        if (sessions.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid',
                code: 'AUTH_SESSION_INVALID'
            });
        }

        // Attach user data vào request
        req.user = {
            id: decoded.sub || decoded.id,
            username: decoded.username,
            full_name: decoded.full_name,
            email: decoded.email,
            organization_id: decoded.organization_id,
            department_id: decoded.department_id,
            roles: decoded.roles || []
        };

        req.session = {
            session_id: decoded.jti,
            expires_at: sessions[0].expires_at
        };

        next();

    } catch (error) {
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

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * 🔓 OPTIONAL AUTH - Cho phép request không có token
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.access_token;

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
 * 🛡️ REQUIRE PERMISSION - Check user có permission không
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
 * 🎭 REQUIRE ROLE - Check user có role không
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

// 🔐 Export default cho backward compatibility
export default authMiddleware;