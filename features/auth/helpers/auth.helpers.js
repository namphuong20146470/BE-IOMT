/**
 * Auth Helpers
 * Utility functions for auth controller
 */

import { COOKIE_OPTIONS, DEFAULT_VALUES } from '../auth.constants.js';

/**
 * Extract client information from request
 */
export const extractClientInfo = (req) => ({
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'Unknown',
    deviceInfo: {
        user_agent: req.headers['user-agent'] || 'Unknown',
        platform: req.get('sec-ch-ua-platform') || DEFAULT_VALUES.PLATFORM,
        browser: req.get('sec-ch-ua') || DEFAULT_VALUES.BROWSER
    }
});

/**
 * Set authentication cookies (HttpOnly)
 */
export const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, COOKIE_OPTIONS.access);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS.refresh);
};

/**
 * Clear authentication cookies
 */
export const clearAuthCookies = (res) => {
    // Don't pass maxAge to clearCookie (deprecated in Express v5)
    const clearOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/'
    };
    res.clearCookie('access_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);
};

/**
 * Set cache control headers to prevent caching (alias for setCacheControlHeaders)
 */
export const setCacheClearingHeaders = (res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Clear-Site-Data': '"cache", "cookies", "storage"'
    });
};

/**
 * Set cache control headers to prevent caching
 */
export const setCacheControlHeaders = (res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Clear-Site-Data': '"cache", "cookies", "storage"'
    });
};

/**
 * Handle authentication errors consistently
 */
export const handleAuthError = (res, error, req = null) => {
    console.error('❌ Auth error:', error);

    // Log audit for authentication failures
    if (req && error.code?.includes('FAILED')) {
        // Non-blocking audit log
        import('../../shared/services/AuditService.js')
            .then(({ default: auditService }) => {
                auditService.logActivity(
                    null,
                    error.code || 'AUTH_ERROR',
                    'auth',
                    null,
                    {
                        error: error.message,
                        ip: req.ip,
                        userAgent: req.headers['user-agent']
                    }
                ).catch(console.error);
            })
            .catch(console.error);
    }

    // Determine status code
    const statusCode = error.statusCode || 
                      (error.name === 'ValidationError' ? 400 : 500);

    // Send error response
    return res.status(statusCode).json({
        success: false,
        message: error.message || 'Authentication failed',
        code: error.code || 'AUTH_ERROR',
        debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
};

/**
 * Extract refresh token from multiple sources
 */
export const extractRefreshToken = (req) => {
    let refreshToken = null;
    let refreshSource = null;

    // Priority 1: Request body
    if (req.body?.refresh_token) {
        refreshToken = req.body.refresh_token;
        refreshSource = 'body';
    }
    // Priority 2: Authorization header
    else if (req.headers.authorization?.startsWith('Bearer ')) {
        refreshToken = req.headers.authorization.substring(7);
        refreshSource = 'bearer';
    }
    // Priority 3: Cookie
    else if (req.cookies?.refresh_token) {
        refreshToken = req.cookies.refresh_token;
        refreshSource = 'cookie';
    }

    return { refreshToken, refreshSource };
};

/**
 * Extract logout tokens from multiple sources
 */
export const extractLogoutTokens = (req) => {
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

    return {
        refreshToken,
        bearerToken,
        accessToken,
        sessionId,
        userId,
        logoutMethod
    };
};

/**
 * Set permission cache headers (USER-SPECIFIC)
 */
export const setPermissionCacheHeaders = (res, etag) => {
    res.set({
        'Cache-Control': 'private, max-age=900', // 15 minutes
        'ETag': `"${etag}"`,
        'Last-Modified': new Date().toUTCString(),
        'Vary': 'Authorization' // Cache varies by user token
    });
};

/**
 * Generate permission cache key (USER-SPECIFIC)
 */
export const generatePermissionCacheKey = (userId, permissions) => {
    const cacheKey = `${userId}-${JSON.stringify(permissions)}`;
    return Buffer.from(cacheKey).toString('base64');
};

export default {
    extractClientInfo,
    setAuthCookies,
    clearAuthCookies,
    setCacheControlHeaders,
    setCacheClearingHeaders,
    handleAuthError,
    extractRefreshToken,
    extractLogoutTokens,
    setPermissionCacheHeaders,
    generatePermissionCacheKey
};
