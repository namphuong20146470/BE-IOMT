import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sessionService from './auth.service.js';
import auditService from '../../shared/services/AuditService.js';

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
 * 🔑 LOGIN - Return tokens for localStorage + Optional HttpOnly cookies
 */
export const login = async (req, res) => {
    const { username, password } = req.body;
    const { ipAddress, userAgent, deviceInfo } = extractClientInfo(req);

    try {
        // Validate input
        if (!username || !password) {
            await auditService.logActivity(null, 'failed_login', 'auth', null, {
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
            await auditService.logActivity(null, 'failed_login', 'auth', null, {
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
            await auditService.logActivity(user.id, 'failed_login', 'auth', null, {
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

        // ✅ Set HttpOnly cookies (optional/fallback)
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
                loginMethod: 'localStorage'
            },
            user.organization_id
        );

        console.log(`✅ Login successful: ${username}`);

        // Prepare safe response
        const { password_hash, ...userResponse } = user;
        userResponse.roles = roles;

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    avatar: user.avatar || null,
                    organization_id: user.organization_id,
                    department_id: user.department_id,
                    is_active: user.is_active,
                    organization_name: user.organization_name,
                    department_name: user.department_name,
                    // ✅ Basic role info only
                    role_name: roles[0]?.name || 'Unknown',
                    role_color: roles[0]?.color || '#6B7280',
                    role_icon: roles[0]?.icon || 'user'
                },
                tokens: {
                    access_token: sessionData.data.access_token,
                    refresh_token: sessionData.data.refresh_token,  // ✅ Add this
                    access_token_expires_in: sessionData.data.expires_in, // ✅ Use from SessionService
                    refresh_token_expires_in: sessionData.data.refresh_expires_in,  // ✅ Use from SessionService
                    token_type: 'Bearer'
                },
                session: {
                    session_id: sessionData.data.session_id,
                    device_id: deviceInfo.user_agent || 'unknown-device',
                    ip_address: ipAddress,
                    created_at: sessionData.data.created_at || new Date().toISOString(),
                    expires_at: sessionData.data.expires_at
                },
                permissions_summary: {
                    total: roles.reduce((total, role) => total + (role.permissions?.length || 0), 0),
                    has_admin_access: roles.some(role => 
                        role.permissions?.includes('system.admin') || false
                    )
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
        // ✅ Support multiple refresh token sources
        let refreshToken = null;
        let refreshSource = null;

        // Priority 1: Check request body (most common for frontend)
        if (req.body?.refresh_token) {
            refreshToken = req.body.refresh_token;
            refreshSource = 'body';
        }
        // Priority 2: Check Authorization header (Bearer token)
        else if (req.headers.authorization?.startsWith('Bearer ')) {
            refreshToken = req.headers.authorization.substring(7);
            refreshSource = 'bearer';
        }
        // Priority 3: Check cookie (fallback)
        else if (req.cookies?.refresh_token) {
            refreshToken = req.cookies.refresh_token;
            refreshSource = 'cookie';
        }

        const { ipAddress } = extractClientInfo(req);

        console.log('🔄 Refresh token request:', {
            hasRefreshToken: !!refreshToken,
            refreshSource,
            hasBodyToken: !!req.body?.refresh_token,
            hasSessionId: !!req.body?.session_id,
            cookies: Object.keys(req.cookies || {}),
            hasAuthHeader: !!req.headers.authorization,
            ipAddress
        });

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required',
                code: 'AUTH_REFRESH_TOKEN_MISSING',
                hint: 'Provide refresh token via request body, Authorization header, or cookie'
            });
        }

        // ✅ Fix: Use refreshAccessToken with optional session_id
        const sessionId = req.body?.session_id || null;
        const result = await sessionService.refreshAccessToken(refreshToken, ipAddress, sessionId);

        if (!result.success) {
            console.log('❌ Refresh failed:', result.error);
            
            // Clear cookies only if using cookie-based refresh
            if (refreshSource === 'cookie') {
                clearAuthCookies(res);
            }
            
            return res.status(401).json({
                success: false,
                message: result.error || 'Invalid or expired refresh token',
                code: '98c7eb759800637b3c21c0cb2b2ad56e891f05967484fd239a70759b9dae5872460270687be3634830b771847fc9c456f2e7328880ea9d4b5c61f2caeb89d3e9'
            });
        }

        // ✅ Update access token cookie (for cookie-based clients)
        if (refreshSource === 'cookie') {
            res.cookie('access_token', result.data.access_token, COOKIE_OPTIONS.access);
        }

        console.log('✅ Token refreshed successfully for user:', result.data.user.username);

        return res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                user: {
                    id: result.data.user.id,
                    username: result.data.user.username,
                    full_name: result.data.user.full_name,
                    email: result.data.user.email,
                    avatar: result.data.user.avatar || null,
                    organization_id: result.data.user.organization_id,
                    department_id: result.data.user.department_id,
                    is_active: result.data.user.is_active,
                    organization_name: result.data.user.organization_name,
                    department_name: result.data.user.department_name,
                    // ✅ Basic role info only
                    role_name: result.data.user.roles?.[0]?.name || 'Unknown',
                    role_color: result.data.user.roles?.[0]?.color || '#6B7280',
                    role_icon: result.data.user.roles?.[0]?.icon || 'user'
                },
                tokens: {
                    access_token: result.data.access_token,
                    // ✅ Optional: Return new refresh_token if rotated
                    access_token_expires_in: result.data.expires_in, // ✅ Use from SessionService
                    token_type: 'Bearer'
                },
                session: {
                    session_id: result.data.session_id,
                    device_id: result.data.device_id || 'unknown-device',
                    ip_address: ipAddress,
                    created_at: result.data.created_at || new Date().toISOString(),
                    expires_at: result.data.expires_at
                },
                permissions_summary: {
                    total: result.data.user.roles?.reduce((total, role) => total + (role.permissions?.length || 0), 0) || 0,
                    has_admin_access: result.data.user.roles?.some(role => 
                        role.permissions?.includes('system.admin') || false
                    ) || false
                }
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        
        // Clear cookies on error (if using cookies)
        if (req.cookies?.refresh_token) {
            clearAuthCookies(res);
        }
        
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
        let bearerToken = null;
        if (req.headers.authorization?.startsWith('Bearer ')) {
            bearerToken = req.headers.authorization.substring(7);
        }
        const accessToken = req.cookies?.access_token;
        const sessionId = req.session?.session_id;
        const userId = req.user?.id;

        const logoutMethod = refreshToken ? 'refresh_token' : 
                           bearerToken ? 'bearer_token' :
                           accessToken ? 'access_token' : 
                           sessionId ? 'session_id' : 'no_auth';

        console.log('🚪 Logout request:', {
            hasRefreshToken: !!refreshToken,
            hasBearerToken: !!bearerToken,
            hasAccessToken: !!accessToken,
            sessionId,
            userId,
            logoutMethod
        });

        // Try to invalidate session (non-blocking)
        let logoutResult = null;
        try {
            if (refreshToken) {
                logoutResult = await sessionService.logout(refreshToken);
            } else if (bearerToken) {
                logoutResult = await sessionService.logout(bearerToken);
            } else if (accessToken) {
                logoutResult = await sessionService.logout(accessToken);
            } else if (sessionId) {
                await sessionService.deactivateSession(sessionId);
                logoutResult = { success: true };
            } else {
                logoutResult = { success: true, message: 'No active session found' };
            }
        } catch (sessionError) {
            console.warn('⚠️ Session invalidation failed:', sessionError.message);
            logoutResult = { success: false, error: sessionError.message };
        }

        // Log logout activity (non-blocking)
        if (userId) {
            auditService.logActivity(
                userId,
                'LOGOUT',
                'auth',
                sessionId,
                {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    logoutMethod,
                    sessionInvalidated: logoutResult?.success ?? false
                },
                req.user?.organization_id
            ).catch(err => {
                console.error('❌ Failed to log logout activity:', err);
            });
        }

        // Always clear cookies
        clearAuthCookies(res);

        // ✅ FIX: Clear cache headers to force permission refresh
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Clear-Site-Data': '"cache", "cookies", "storage"' // ✅ Clear all client-side data
        });

        console.log('✅ Logout completed:', { logoutMethod, result: logoutResult });

        return res.json({
            success: true,
            message: 'Logged out successfully',
            data: {
                session: {
                    session_id: sessionId || null,
                    logged_out_at: new Date().toISOString(),
                    ip_address: req.ip,
                    logout_method: logoutMethod,
                    session_invalidated: logoutResult?.success ?? false
                },
                user: userId ? {
                    id: userId,
                    username: req.user?.username
                } : null,
                // ✅ Instruct client to clear all cache
                cache_cleared: true,
                force_refresh: true
            }
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        
        // Always clear cookies even on error
        clearAuthCookies(res);
        
        // Clear cache headers even on error
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
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
            message: 'User profile retrieved successfully',
            data: {
                user: {
                    id: userProfile.id,
                    username: userProfile.username,
                    full_name: userProfile.full_name,
                    email: userProfile.email,
                    avatar: userProfile.avatar || null,
                    organization_id: userProfile.organization_id,
                    department_id: userProfile.department_id,
                    organization_name: userProfile.organization_name,
                    department_name: userProfile.department_name,
                    created_at: userProfile.created_at,
                    last_login_at: userProfile.last_login_at,
                    is_active: userProfile.is_active || true,
                    roles: userProfile.roles || [],
                    permissions: userProfile.permissions || []
                },
                session: {
                    session_id: req.session?.session_id,
                    expires_at: req.session?.expires_at,
                    auth_source: req.authSource
                },
                permissions_summary: {
                    total: userProfile.permissions?.length || 0,
                    roles_count: userProfile.roles?.length || 0
                }
            }
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
                user: {
                    id: req.user?.id,
                    username: req.user?.username,
                    full_name: req.user?.full_name,
                    organization_id: req.user?.organization_id,
                    department_id: req.user?.department_id,
                    roles: req.user?.roles || []
                },
                session: {
                    session_id: req.session?.session_id,
                    expires_at: req.session?.expires_at,
                    auth_source: req.authSource,
                    verified_at: new Date().toISOString()
                },
                token_info: {
                    token_type: req.authSource === 'bearer' ? 'Bearer' : 'Cookie',
                    is_active: true
                }
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
            message: 'Password changed successfully',
            data: {
                user: {
                    id: userId,
                    username: user.username,
                    password_updated_at: new Date().toISOString()
                },
                session: {
                    current_session_preserved: true,
                    other_sessions_invalidated: true,
                    requires_reauth: false
                },
                security: {
                    password_strength: 'strong', // Could implement actual strength check
                    last_password_change: new Date().toISOString(),
                    ip_address: req.ip
                }
            }
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

// ✅ Full profile endpoint for app initialization
export const getMe = async (req, res) => {
    try {
        // ✅ Debug JWT payload
        console.log('🔍 JWT Payload:', req.user);
        
        const userId = req.user.sub || req.user.id || req.user.user_id;
        
        if (!userId) {
            console.error('❌ No user ID found in JWT:', req.user);
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user ID not found',
                debug: process.env.NODE_ENV === 'development' ? req.user : undefined
            });
        }
        
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
                organizations: {
                    select: { 
                        id: true, 
                        name: true, 
                        type: true,
                        address: true,
                        phone: true,
                        email: true,
                        license_number: true,
                        is_active: true
                    }
                },
                departments: {
                    select: { 
                        id: true, 
                        name: true, 
                        description: true,
                        code: true
                    }
                },
                user_roles: {
                    where: { 
                        is_active: true,
                        valid_from: { lte: new Date() },
                        OR: [
                            { valid_until: null },
                            { valid_until: { gte: new Date() } }
                        ]
                    },
                    include: {
                        roles: {
                            include: {
                                role_permissions: {
                                    include: {
                                        permissions: {
                                            select: { name: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get all permissions from all roles
        const roles = user.user_roles.map(userRole => ({
            id: userRole.roles.id,
            name: userRole.roles.name,
            description: userRole.roles.description,
            color: userRole.roles.color,
            icon: userRole.roles.icon,
            permissions: userRole.roles.role_permissions.map(rp => rp.permissions.name)
        }));

        return res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    avatar: user.avatar,
                    phone: user.phone,
                    address: user.address,
                    organization_id: user.organization_id,
                    department_id: user.department_id,
                    is_active: user.is_active,
                    created_at: user.created_at,
                    last_login: user.last_login,
                    // ✅ Full organization & department info
                    organization: user.organizations,
                    department: user.departments,
                    // ✅ Complete role information
                    roles: roles
                },
                permissions_summary: {
                    total: roles.reduce((total, role) => total + role.permissions.length, 0),
                    scopes: [...new Set(roles.flatMap(role => 
                        role.permissions.map(p => {
                            if (p.includes('system.')) return 'global';
                            if (p.includes('organization.')) return 'organization';  
                            if (p.includes('department.')) return 'department';
                            return 'project';
                        })
                    ))],
                    has_admin_access: roles.some(role => 
                        role.permissions.includes('system.admin')
                    )
                }
            }
        });

    } catch (error) {
        console.error('❌ Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ Permissions endpoint with caching support  
/**
 * ✅ Permissions endpoint with USER-SPECIFIC caching
 */
export const getPermissions = async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id || req.user.user_id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user ID not found'
            });
        }

        const users = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, 
                   u.organization_id, u.department_id,
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
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE u.id = ${userId}::uuid
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, 
                     u.organization_id, u.department_id
        `;

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];
        const roles = typeof user.roles === 'string' 
            ? JSON.parse(user.roles) 
            : (user.roles || []);

        const allPermissions = [...new Set(
            roles.flatMap(role => role.permissions || [])
        )];

        const permissionMap = {};
        allPermissions.forEach(permission => {
            permissionMap[permission] = true;
        });

        const permissionsByScope = {
            global: allPermissions.filter(p => p.includes('system.')),
            organization: allPermissions.filter(p => p.includes('organization.')),
            department: allPermissions.filter(p => p.includes('department.')),
            project: allPermissions.filter(p => p.includes('project.')),
            device: allPermissions.filter(p => p.includes('device.')),
            report: allPermissions.filter(p => p.includes('report.')),
            user: allPermissions.filter(p => p.includes('user.')),
            role: allPermissions.filter(p => p.includes('role.')),
            other: allPermissions.filter(p => 
                !p.includes('system.') && 
                !p.includes('organization.') && 
                !p.includes('department.') && 
                !p.includes('project.') && 
                !p.includes('device.') && 
                !p.includes('report.') && 
                !p.includes('user.') && 
                !p.includes('role.')
            )
        };

        // ✅ USER-SPECIFIC cache with ETag
        const cacheKey = `${userId}-${JSON.stringify(allPermissions)}`;
        const etag = Buffer.from(cacheKey).toString('base64');

        // ✅ Check if client has same permissions (ETag)
        if (req.headers['if-none-match'] === `"${etag}"`) {
            return res.status(304).send(); // Not Modified
        }

        // ✅ Set cache headers with USER-SPECIFIC ETag
        res.set({
            'Cache-Control': 'private, max-age=900', // 15 minutes
            'ETag': `"${etag}"`,
            'Last-Modified': new Date().toUTCString(),
            'Vary': 'Authorization' // ✅ Cache varies by user token
        });

        return res.json({
            success: true,
            message: 'Permissions retrieved successfully',
            data: {
                permissions: allPermissions,
                permission_map: permissionMap,
                permissions_by_scope: permissionsByScope,
                total: allPermissions.length,
                cached_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                user_id: userId, // ✅ Include user ID for verification
                cache_key: etag.substring(0, 16) + '...' // Partial cache key for debugging
            }
        });

    } catch (error) {
        console.error('❌ Get permissions error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * 📝 UPDATE PROFILE - User updates their own profile
 */
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id || req.user.user_id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user ID not found',
                code: 'AUTH_USER_ID_NOT_FOUND'
            });
        }

        // Extract allowed fields from request body
        const { full_name, email, phone } = req.body;

        // Validate input - at least one field is required
        if (!full_name && !email && !phone) {
            return res.status(400).json({
                success: false,
                message: 'At least one field (full_name, email, phone) is required',
                code: 'VALIDATION_EMPTY_UPDATE'
            });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
                code: 'VALIDATION_INVALID_EMAIL'
            });
        }

        // Validate phone format if provided (Vietnamese phone numbers)
        if (phone && !/^(\+84|84|0)?[3|5|7|8|9][0-9]{8,9}$/.test(phone.replace(/\s+/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format',
                code: 'VALIDATION_INVALID_PHONE'
            });
        }

        // Check if user exists and is active
        const existingUser = await prisma.users.findUnique({
            where: { 
                id: userId,
                is_active: true 
            },
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true
            }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found or inactive',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if email is already taken by another user
        if (email && email !== existingUser.email) {
            const emailExists = await prisma.users.findFirst({
                where: {
                    email,
                    id: { not: userId },
                    is_active: true
                }
            });

            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Email is already taken by another user',
                    code: 'EMAIL_ALREADY_EXISTS'
                });
            }
        }

        // Prepare update data (only include fields that are provided)
        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        updateData.updated_at = new Date();

        // Update user profile
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true,
                updated_at: true,
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        console.log(`✅ Profile updated successfully for user: ${userId}`);

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser,
                updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
                updated_at: updatedUser.updated_at
            },
            code: 'PROFILE_UPDATE_SUCCESS'
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Email or phone number already exists',
                code: 'UNIQUE_CONSTRAINT_VIOLATION'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            code: 'PROFILE_UPDATE_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};