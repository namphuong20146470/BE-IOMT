/**
 * Auth Controller (REFACTORED)
 * Thin layer - delegates to service layer
 * Only handles HTTP request/response
 */

import { AuthService } from './auth.service.js';
import { AuthValidator } from './auth.validator.js';
import {
    extractClientInfo,
    setAuthCookies,
    clearAuthCookies,
    setCacheClearingHeaders,
    setPermissionCacheHeaders,
    generatePermissionCacheKey,
    extractRefreshToken,
    extractLogoutTokens,
    handleAuthError
} from './helpers/auth.helpers.js';

/**
 * 🔑 LOGIN
 */
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientInfo = extractClientInfo(req);
        
        // Delegate to service
        const result = await AuthService.login(username, password, clientInfo);
        
        // Set cookies (optional)
        setAuthCookies(res, result.tokens.access_token, result.tokens.refresh_token);
        
        console.log(`✅ Login successful: ${username}`);
        
        return res.json({
            success: true,
            message: 'Login successful',
            data: result
        });
        
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 🔄 REFRESH TOKEN
 */
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken, refreshSource } = extractRefreshToken(req);
        const { ipAddress } = extractClientInfo(req);
        const sessionId = req.body?.session_id || null;

        console.log('🔄 Refresh token request:', {
            hasRefreshToken: !!refreshToken,
            refreshSource,
            ipAddress
        });

        // Delegate to service
        const result = await AuthService.refreshAccessToken(refreshToken, ipAddress, sessionId);
        
        // Update access token cookie if using cookie-based auth
        if (refreshSource === 'cookie') {
            res.cookie('access_token', result.tokens.access_token);
        }
        
        console.log('✅ Token refreshed successfully');
        
        return res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: result
        });
        
    } catch (error) {
        // Clear cookies on error if using cookie-based refresh
        const { refreshSource } = extractRefreshToken(req);
        if (refreshSource === 'cookie') {
            clearAuthCookies(res);
        }
        
        return handleAuthError(res, error, req);
    }
};

/**
 * 🚪 LOGOUT
 */
export const logout = async (req, res) => {
    try {
        const tokens = extractLogoutTokens(req);
        const sessionId = req.session?.session_id;
        const userId = req.user?.id;
        const username = req.user?.username;
        const clientInfo = extractClientInfo(req);

        // Delegate to service
        const result = await AuthService.logout(
            tokens,
            sessionId,
            userId,
            username,
            clientInfo
        );

        // Clear cookies
        clearAuthCookies(res);
        setCacheClearingHeaders(res);

        console.log('✅ Logout completed');

        return res.json({
            success: true,
            message: 'Logged out successfully',
            data: result
        });

    } catch (error) {
        // Always clear cookies even on error
        clearAuthCookies(res);
        setCacheClearingHeaders(res);
        
        return handleAuthError(res, error, req);
    }
};

/**
 * 👤 GET PROFILE (getMe endpoint)
 */
export const getMe = async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id || req.user.user_id;
        
        // Delegate to service
        const result = await AuthService.getProfile(userId);
        
        return res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: result
        });
        
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 🔍 GET PERMISSIONS
 */
export const getPermissions = async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id || req.user.user_id;
        
        // Delegate to service
        const result = await AuthService.getUserPermissions(userId);
        
        // Generate ETag for caching
        const etag = generatePermissionCacheKey(userId, result.permissions);
        
        // Check if client has same permissions (ETag)
        if (req.headers['if-none-match'] === `"${etag}"`) {
            return res.status(304).send(); // Not Modified
        }
        
        // Set cache headers
        setPermissionCacheHeaders(res, etag);
        
        return res.json({
            success: true,
            message: 'Permissions retrieved successfully',
            data: {
                ...result,
                cached_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                cache_key: etag.substring(0, 16) + '...'
            }
        });
        
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 🔒 CHANGE PASSWORD
 */
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.id;
        const sessionId = req.session?.session_id;
        const clientInfo = extractClientInfo(req);
        
        // Delegate to service
        const result = await AuthService.changePassword(
            userId,
            currentPassword,
            newPassword,
            sessionId,
            clientInfo
        );
        
        return res.json({
            success: true,
            message: 'Password changed successfully',
            data: result
        });
        
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 📝 UPDATE PROFILE
 */
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id || req.user.user_id;
        const updateData = req.body;
        
        // Delegate to service
        const result = await AuthService.updateProfile(userId, updateData);
        
        console.log(`✅ Profile updated for user: ${userId}`);
        
        return res.json({
            success: true,
            message: 'Profile updated successfully',
            data: result,
            code: 'PROFILE_UPDATE_SUCCESS'
        });
        
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 🔍 VERIFY SESSION
 */
export const verifySession = async (req, res) => {
    try {
        const user = req.user;
        const session = req.session;
        const authSource = req.authSource;

        return res.json({
            success: true,
            message: 'Session is valid',
            data: {
                user: {
                    id: user?.id,
                    username: user?.username,
                    full_name: user?.full_name,
                    organization_id: user?.organization_id,
                    department_id: user?.department_id,
                    role: user?.role || null
                },
                session: {
                    session_id: session?.session_id,
                    expires_at: session?.expires_at,
                    auth_source: authSource,
                    verified_at: new Date().toISOString()
                },
                token_info: {
                    token_type: authSource === 'bearer' ? 'Bearer' : 'Cookie',
                    is_active: true
                }
            }
        });
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 👤 GET PROFILE (legacy endpoint)
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

        return res.json({
            success: true,
            message: 'User profile retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    avatar: user.avatar || null,
                    organization_id: user.organization_id,
                    department_id: user.department_id,
                    role: user.role || null,
                    permissions: user.permissions || []
                },
                session: {
                    session_id: req.session?.session_id,
                    expires_at: req.session?.expires_at,
                    auth_source: req.authSource
                },
                permissions_summary: {
                    total: user.permissions?.length || 0,
                    roles_count: user.role ? 1 : 0
                }
            }
        });

    } catch (error) {
        return handleAuthError(res, error, req);
    }
};

/**
 * 🐛 DEBUG TOKEN (Development only)
 */
export const debugToken = async (req, res) => {
    try {
        const crypto = await import('crypto');
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        const { refresh_token, simulate_refresh = false } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                message: 'refresh_token is required for debugging'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(refresh_token).digest('hex');

        const sessions = await prisma.user_sessions.findMany({
            where: { refresh_token: hashedToken },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        is_active: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const activeSessions = await prisma.user_sessions.findMany({
            where: {
                is_active: true,
                expires_at: { gt: new Date() }
            },
            select: {
                id: true,
                refresh_token: true,
                expires_at: true,
                is_active: true,
                created_at: true,
                users: { select: { username: true } }
            },
            orderBy: { created_at: 'desc' },
            take: 5
        });

        let simulateResult = null;
        if (simulate_refresh) {
            const sessionService = (await import('../../shared/services/SessionService.js')).default;
            try {
                simulateResult = await sessionService.refreshAccessToken(refresh_token);
            } catch (error) {
                simulateResult = { success: false, error: error.message };
            }
        }

        return res.json({
            success: true,
            debug_info: {
                input: {
                    token_length: refresh_token.length,
                    token_preview: refresh_token.substring(0, 30) + '...'
                },
                hashing: {
                    algorithm: 'sha256',
                    hashed_token: hashedToken,
                    hashed_preview: hashedToken.substring(0, 30) + '...'
                },
                database_query: {
                    sessions_with_hash: sessions.length,
                    all_sessions_found: sessions.map(s => ({
                        id: s.id,
                        is_active: s.is_active,
                        expires_at: s.expires_at,
                        expired: new Date() > s.expires_at,
                        username: s.users?.username
                    })),
                    active_sessions_sample: activeSessions.map(s => ({
                        id: s.id,
                        expires_at: s.expires_at,
                        username: s.users?.username
                    }))
                },
                validation: {
                    current_time: new Date().toISOString(),
                    simulate_refresh_result: simulateResult
                }
            }
        });

    } catch (error) {
        console.error('Debug token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Debug failed',
            error: error.message
        });
    }
};

export default {
    login,
    refreshToken,
    logout,
    getMe,
    getProfile,
    getPermissions,
    changePassword,
    updateProfile,
    verifySession,
    debugToken
};
