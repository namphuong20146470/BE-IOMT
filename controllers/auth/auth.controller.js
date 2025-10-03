import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sessionService from '../../services/SessionService.js';
import auditService from '../../services/AuditService.js';

const prisma = new PrismaClient();

// ========== CONFIGURATION ==========
const hashPasswordLegacy = (password) => 
    crypto.createHash('sha256').update(password).digest('hex');

const COOKIE_OPTIONS = {
    access: {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
        path: '/',
       domain: undefined
    },
    refresh: {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        path: '/'
    }
};

// ========== HELPER FUNCTIONS ==========

const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, COOKIE_OPTIONS.access);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS.refresh);
};

const clearAuthCookies = (res) => {
    res.clearCookie('access_token', COOKIE_OPTIONS.access);
    res.clearCookie('refresh_token', COOKIE_OPTIONS.refresh);
};

const extractClientInfo = (req) => ({
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'] || 'Unknown',
    deviceInfo: {
        user_agent: req.headers['user-agent'] || 'Unknown',
        platform: req.get('sec-ch-ua-platform') || 'Unknown',
        browser: req.get('sec-ch-ua') || 'Unknown'
    }
});

// ========== MAIN CONTROLLERS ==========

/**
 * 🔑 LOGIN - Pure HTTP-Only Cookie authentication
 */
export const login = async (req, res) => {
    const { username, password } = req.body;
    const { ipAddress, userAgent, deviceInfo } = extractClientInfo(req);

    try {
        // Validate input
        if (!username || !password) {
            await auditService.logActivity(null, 'FAILED_LOGIN', 'auth', null, {
                reason: 'Missing credentials',
                ip: ipAddress
            });

            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
                code: 'AUTH_MISSING_CREDENTIALS'
            });
        }

        // Find user with complete info
        const users = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, 
                   u.organization_id, u.department_id,
                   u.password_hash, u.is_active,
                   o.name as organization_name,
                   d.name as department_name,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
                               'description', r.description,
                               'color', r.color,
                               'icon', r.icon,
                               'permissions', COALESCE(
                                   (
                                       SELECT JSON_AGG(p.name)
                                       FROM role_permissions rp
                                       JOIN permissions p ON rp.permission_id = p.id
                                       WHERE rp.role_id = r.id
                                   ),
                                   '[]'::json
                               )
                           )
                       ) FILTER (WHERE r.id IS NOT NULL),
                       '[]'::json
                   ) as roles
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE (u.username = ${username} OR u.email = ${username})
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, 
                     u.organization_id, u.department_id,
                     u.password_hash, u.is_active, o.name, d.name
        `;

        if (users.length === 0) {
            await auditService.logActivity(null, 'FAILED_LOGIN', 'auth', null, {
                reason: 'User not found',
                username,
                ip: ipAddress
            });

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                code: 'AUTH_INVALID_CREDENTIALS'
            });
        }

        const user = users[0];

        // Verify password (support legacy + bcrypt)
        let isValidPassword = false;
        if (user.password_hash.startsWith('$2b$')) {
            isValidPassword = await bcrypt.compare(password, user.password_hash);
        } else {
            isValidPassword = hashPasswordLegacy(password) === user.password_hash;
            
            // Auto-migrate to bcrypt
            if (isValidPassword) {
                try {
                    const newHash = await bcrypt.hash(password, 10);
                    await prisma.$queryRaw`
                        UPDATE users 
                        SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ${user.id}::uuid
                    `;
                    console.log(`🔄 Password migrated for: ${user.username}`);
                } catch (err) {
                    console.error('Migration error:', err.message);
                }
            }
        }

        if (!isValidPassword) {
            await auditService.logActivity(user.id, 'FAILED_LOGIN', 'auth', null, {
                reason: 'Invalid password',
                username,
                ip: ipAddress
            });

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                code: 'AUTH_INVALID_CREDENTIALS'
            });
        }

        // Parse roles
        const roles = typeof user.roles === 'string' 
            ? JSON.parse(user.roles) 
            : (user.roles || []);

        // Security check
        const securityCheck = await sessionService.detectSuspiciousActivity(
            user.id, 
            ipAddress
        );

        if (securityCheck?.is_suspicious) {
            console.log(`⚠️ Suspicious login: ${user.username}`, securityCheck.analysis);
        }

        // Prepare user data for token
        const userForToken = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            organization_id: user.organization_id,
            department_id: user.department_id,
            roles
        };

        // Create session
        const sessionData = await sessionService.createSession(
            user.id,
            deviceInfo,
            ipAddress,
            userForToken
        );

        if (!sessionData?.success) {
            console.error('Failed to create session');
            return res.status(500).json({
                success: false,
                message: 'Failed to create session',
                code: 'AUTH_SESSION_ERROR'
            });
        }

        // ✅ Set HTTP-Only cookies ONLY
        setAuthCookies(
            res,
            sessionData.data.access_token,
            sessionData.data.refresh_token
        );

        // Log successful login
        await auditService.logActivity(
            user.id,
            'LOGIN',
            'auth',
            sessionData.data.session_id,
            {
                username: user.username,
                ip: ipAddress,
                userAgent,
                loginMethod: 'cookie'
            },
            user.organization_id
        );

        console.log(`✅ Login successful: ${username}`);

        // Prepare safe response (NO TOKENS)
        const { password_hash, ...userResponse } = user;
        userResponse.roles = roles;

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userResponse,
                session: {
                    session_id: sessionData.data.session_id,
                    expires_at: sessionData.data.expires_at
                    // ✅ NO TOKENS in response
                }
            },
            security_info: securityCheck?.is_suspicious ? {
                new_ip: securityCheck.new_ip,
                risk_level: securityCheck.analysis.risk_level,
                recommendations: securityCheck.analysis.recommendations
            } : null
        });

    } catch (error) {
        console.error('Login error:', error);
        
        await auditService.logActivity(null, 'LOGIN_ERROR', 'auth', null, {
            error: error.message,
            ip: ipAddress
        }).catch(console.error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'AUTH_INTERNAL_ERROR'
        });
    }
};

/**
 * 🔄 REFRESH TOKEN - Get new access token
 */
export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;
        const { ipAddress } = extractClientInfo(req);

        console.log('🔄 Refresh token request:', {
            hasRefreshToken: !!refreshToken,
            cookies: Object.keys(req.cookies || {}),
            ipAddress
        });

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required',
                code: 'AUTH_REFRESH_TOKEN_MISSING'
            });
        }

        // ✅ Fix: Use refreshAccessToken instead of refreshSession
        const result = await sessionService.refreshAccessToken(refreshToken, ipAddress);

        if (!result.success) {
            console.log('❌ Refresh failed:', result.error);
            clearAuthCookies(res);
            
            return res.status(401).json({
                success: false,
                message: result.error || 'Invalid or expired refresh token',
                code: 'AUTH_REFRESH_TOKEN_INVALID'
            });
        }

        // Update access token cookie
        res.cookie('access_token', result.data.access_token, COOKIE_OPTIONS.access);

        console.log('✅ Token refreshed successfully for user:', result.data.user.username);

        return res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                expires_in: result.data.expires_in,
                user: {
                    id: result.data.user.id,
                    username: result.data.user.username,
                    full_name: result.data.user.full_name
                }
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        
        // Clear cookies on error
        clearAuthCookies(res);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to refresh token',
            code: 'AUTH_REFRESH_ERROR',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * 🚪 LOGOUT - Clear session and cookies
 */
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;
        const accessToken = req.cookies?.access_token;
        const sessionId = req.session?.session_id;
        const userId = req.user?.id;

        console.log('🚪 Logout request:', {
            hasRefreshToken: !!refreshToken,
            hasAccessToken: !!accessToken,
            sessionId,
            userId
        });

        // Try to invalidate session using available tokens
        let logoutResult = null;
        
        if (refreshToken) {
            // ✅ Fix: Use logout method with refresh token
            logoutResult = await sessionService.logout(refreshToken);
        } else if (accessToken) {
            // Fallback to access token
            logoutResult = await sessionService.logout(accessToken);
        } else if (sessionId) {
            // Direct session deactivation
            await sessionService.deactivateSession(sessionId);
            logoutResult = { success: true };
        }

        // Log logout activity
        if (userId) {
            await auditService.logActivity(
                userId,
                'LOGOUT',
                'auth',
                sessionId,
                {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    logoutMethod: refreshToken ? 'refresh_token' : 
                                 accessToken ? 'access_token' : 'session_id'
                },
                req.user?.organization_id
            );
        }

        // Always clear cookies regardless of result
        clearAuthCookies(res);

        console.log('✅ Logout completed:', logoutResult);

        return res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        
        // Always clear cookies even on error
        clearAuthCookies(res);
        
        return res.status(500).json({
            success: false,
            message: 'Logout failed',
            code: 'AUTH_LOGOUT_ERROR',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * 👤 GET PROFILE - Current user info
 */
export const getProfile = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
                code: 'AUTH_USER_NOT_FOUND'
            });
        }

        // Fetch fresh user data
        const userData = await prisma.$queryRaw`
            SELECT u.id, u.username, u.email, u.full_name,
                   u.organization_id, u.department_id,
                   u.created_at, u.last_login_at,
                   o.name as organization_name,
                   d.name as department_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ${user.id}::uuid
        `;

        if (userData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'AUTH_USER_NOT_FOUND'
            });
        }

        const userProfile = {
            ...userData[0],
            roles: user.roles || [],
            permissions: user.permissions || []
        };

        return res.json({
            success: true,
            data: userProfile
        });

    } catch (error) {
        console.error('Get profile error:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            code: 'AUTH_PROFILE_ERROR'
        });
    }
};

/**
 * 🔍 VERIFY SESSION - Check if session is valid
 */
export const verifySession = async (req, res) => {
    try {
        return res.json({
            success: true,
            message: 'Session is valid',
            data: {
                user_id: req.user?.id,
                username: req.user?.username,
                session_id: req.session?.session_id,
                expires_at: req.session?.expires_at
            }
        });
    } catch (error) {
        console.error('Verify session error:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to verify session',
            code: 'AUTH_VERIFY_ERROR'
        });
    }
};

/**
 * 🔒 CHANGE PASSWORD - Update user password
 */
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password required',
                code: 'AUTH_MISSING_PASSWORDS'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
                code: 'AUTH_PASSWORD_TOO_SHORT'
            });
        }

        // Get user
        const users = await prisma.$queryRaw`
            SELECT id, username, password_hash
            FROM users
            WHERE id = ${userId}::uuid
        `;

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'AUTH_USER_NOT_FOUND'
            });
        }

        const user = users[0];

        // Verify current password
        let isValid = false;
        if (user.password_hash.startsWith('$2b$')) {
            isValid = await bcrypt.compare(currentPassword, user.password_hash);
        } else {
            isValid = hashPasswordLegacy(currentPassword) === user.password_hash;
        }

        if (!isValid) {
            await auditService.logActivity(userId, 'FAILED_PASSWORD_CHANGE', 'auth', null, {
                reason: 'Invalid current password',
                ip: req.ip
            });

            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
                code: 'AUTH_INVALID_PASSWORD'
            });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.$queryRaw`
            UPDATE users
            SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId}::uuid
        `;

        // Invalidate all sessions except current
        await sessionService.invalidateAllUserSessions(userId, req.session?.session_id);

        // Log activity
        await auditService.logActivity(userId, 'PASSWORD_CHANGED', 'auth', null, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to change password',
            code: 'AUTH_PASSWORD_CHANGE_ERROR'
        });
    }
};