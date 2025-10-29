/**
 * 🔄 Session Management Controller  
 * Handles token refresh and session verification
 */

import sessionService from '../../../shared/services/SessionService.js';
import auditService from '../../../shared/services/AuditService.js';
import { extractClientInfo, setAuthCookies, clearAuthCookies } from '../helpers/auth.helper.js';
import { sendRefreshSuccess, sendError, sendSuccess, sendInvalidRefreshToken, sendInternalError } from '../helpers/response.helper.js';
import { AUTH_ERROR_CODES, AUTH_MESSAGES, AUTH_AUDIT_EVENTS } from '../constants/auth.constants.js';

/**
 * 🔄 REFRESH TOKEN - Get new access token using refresh token
 * @route POST /auth/refresh
 */
export const refreshToken = async (req, res) => {
    try {
        // Support multiple refresh token sources
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
            return sendError(res, 'Refresh token required', 401, AUTH_ERROR_CODES.REFRESH_TOKEN_MISSING, {
                hint: 'Provide refresh token via request body, Authorization header, or cookie'
            });
        }

        // Use refreshAccessToken with optional session_id
        const sessionId = req.body?.session_id || null;
        const result = await sessionService.refreshAccessToken(refreshToken, ipAddress, sessionId);

        if (!result.success) {
            console.log('❌ Refresh failed:', result.error);
            
            // Clear cookies only if using cookie-based refresh
            if (refreshSource === 'cookie') {
                clearAuthCookies(res);
            }
            
            return sendInvalidRefreshToken(res);
        }

        // Update access token cookie (for cookie-based clients)
        if (refreshSource === 'cookie') {
            setAuthCookies(res, result.data.access_token);
        }

        // Log token refresh activity
        if (result.data.user?.id) {
            try {
                await auditService.logActivity(
                    result.data.user.id,
                    AUTH_AUDIT_EVENTS.TOKEN_REFRESH,
                    'auth',
                    null,
                    {
                        session_id: result.data.session_id,
                        refresh_source: refreshSource,
                        ip_address: ipAddress
                    }
                );
            } catch (err) {
                console.error('❌ Failed to log token refresh activity:', err);
            }
        }

        console.log('✅ Token refreshed successfully for user:', result.data.user.username);

        return sendRefreshSuccess(res, {
            user: result.data.user,
            tokens: result.data,
            session: result.data
        });

    } catch (error) {
        console.error('❌ Refresh token error:', error);
        return sendInternalError(res);
    }
};

/**
 * 🔍 VERIFY SESSION - Check if current session is valid
 * @route GET /auth/verify
 */
export const verifySession = async (req, res) => {
    try {
        const user = req.user;
        const sessionId = req.sessionId;

        console.log('🔍 Session verification:', {
            user_id: user?.id,
            username: user?.username,
            session_id: sessionId
        });

        // If we reach here, the auth middleware has already verified the token
        // Just return the current user info
        return sendSuccess(res, {
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                is_active: user.is_active,
                organization_id: user.organization_id,
                department_id: user.department_id
            },
            session: {
                session_id: sessionId,
                verified_at: new Date().toISOString()
            }
        }, 'Session is valid');

    } catch (error) {
        console.error('❌ Session verification error:', error);
        return sendInternalError(res);
    }
};

/**
 * 🗑️ TERMINATE SESSION - End a specific session
 * @route DELETE /auth/sessions/:sessionId
 */
export const terminateSession = async (req, res) => {
    try {
        const user = req.user;
        const { sessionId } = req.params;
        const { ipAddress } = extractClientInfo(req);

        if (!user) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        console.log('🗑️ Terminating session:', {
            user_id: user.id,
            session_id: sessionId,
            ip_address: ipAddress
        });

        const terminateResult = await sessionService.terminateSession(sessionId, user.id);

        // Log session termination
        try {
            await auditService.logActivity(
                user.id,
                'SESSION_TERMINATED',
                'auth',
                sessionId,
                {
                    terminated_session: sessionId,
                    ip_address: ipAddress,
                    success: terminateResult.success
                }
            );
        } catch (err) {
            console.error('❌ Failed to log session termination:', err);
        }

        if (!terminateResult.success) {
            return sendError(res, terminateResult.error || 'Failed to terminate session', 400);
        }

        return sendSuccess(res, {
            session_id: sessionId,
            terminated_at: new Date().toISOString()
        }, 'Session terminated successfully');

    } catch (error) {
        console.error('❌ Session termination error:', error);
        return sendInternalError(res);
    }
};

/**
 * 📊 GET SESSION STATISTICS - Get user session analytics
 * @route GET /auth/sessions/statistics
 */
export const getSessionStatistics = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        const stats = await sessionService.getSessionStatistics(user.id);

        return sendSuccess(res, stats, 'Session statistics retrieved successfully');

    } catch (error) {
        console.error('❌ Session statistics error:', error);
        return sendInternalError(res);
    }
};