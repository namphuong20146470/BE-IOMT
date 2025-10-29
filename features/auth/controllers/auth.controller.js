/**
 * 🔐 Main Authentication Controller
 * Handles core authentication operations (login, logout)
 */

import sessionService from '../../../shared/services/SessionService.js';
import auditService from '../../../shared/services/AuditService.js';
import { extractClientInfo, generateDeviceId, setAuthCookies, clearAuthCookies, checkRateLimit } from '../helpers/auth.helper.js';
import { sendLoginSuccess, sendError, sendSuccess, sendInvalidCredentials, sendAccountLocked, sendAccountInactive, sendInternalError } from '../helpers/response.helper.js';
import { AUTH_ERROR_CODES, AUTH_MESSAGES, LOGIN_ATTEMPT_CONFIG, AUTH_AUDIT_EVENTS } from '../constants/auth.constants.js';
import prisma from '../../../config/db.js';
import bcrypt from 'bcryptjs';

/**
 * 🚪 LOGIN - Authenticate user and create session
 * @route POST /auth/login
 */
export const login = async (req, res) => {
    try {
        const { username, password, remember_me = false, device_id } = req.body;
        const clientInfo = extractClientInfo(req);
        const ipAddress = clientInfo.ipAddress;

        console.log('🔑 Login attempt:', { 
            username, 
            ipAddress,
            userAgent: clientInfo.user_agent?.substring(0, 50) + '...'
        });

        // Rate limiting by IP and username
        const ipRateLimit = checkRateLimit(`ip:${ipAddress}`, LOGIN_ATTEMPT_CONFIG.MAX_ATTEMPTS);
        const userRateLimit = checkRateLimit(`user:${username}`, LOGIN_ATTEMPT_CONFIG.MAX_ATTEMPTS);

        if (!ipRateLimit.allowed || !userRateLimit.allowed) {
            const timeUntilReset = Math.max(ipRateLimit.timeUntilReset, userRateLimit.timeUntilReset);
            
            await auditService.logActivity(null, AUTH_AUDIT_EVENTS.LOGIN_FAILED, 'auth', null, {
                username,
                reason: 'Rate limit exceeded',
                ip_address: ipAddress,
                attempts: Math.max(ipRateLimit.attempts, userRateLimit.attempts)
            });

            return sendAccountLocked(res, timeUntilReset);
        }

        // Find user with roles and permissions
        const users = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.password_hash,
                   u.organization_id, u.department_id, u.is_active,
                   u.created_at, u.updated_at,
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
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.username = ${username} AND u.is_active = true
            GROUP BY u.id, o.name, d.name
        `;

        const user = users[0];

        if (!user) {
            await auditService.logActivity(null, AUTH_AUDIT_EVENTS.LOGIN_FAILED, 'auth', null, {
                username,
                reason: 'User not found',
                ip_address: ipAddress
            });

            return sendInvalidCredentials(res);
        }

        // Check if user is active
        if (!user.is_active) {
            await auditService.logActivity(user.id, AUTH_AUDIT_EVENTS.LOGIN_FAILED, 'auth', null, {
                username,
                reason: 'Account inactive',
                ip_address: ipAddress
            });

            return sendAccountInactive(res);
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            await auditService.logActivity(user.id, AUTH_AUDIT_EVENTS.LOGIN_FAILED, 'auth', null, {
                username,
                reason: 'Invalid password',
                ip_address: ipAddress
            });

            return sendInvalidCredentials(res);
        }

        // Create session and tokens
        const deviceInfo = device_id ? { device_id } : generateDeviceId(clientInfo);
        const sessionResult = await sessionService.createSession(
            user.id, 
            deviceInfo, 
            ipAddress, 
            user
        );

        if (!sessionResult.success) {
            console.error('❌ Session creation failed:', sessionResult.error);
            return sendInternalError(res, 'Failed to create session');
        }

        // Set cookies for web clients
        setAuthCookies(res, sessionResult.data.access_token, sessionResult.data.refresh_token);

        // Calculate permissions summary
        const allPermissions = user.roles.flatMap(role => role.permissions || []);
        const uniquePermissions = [...new Set(allPermissions)];
        const hasAdminAccess = user.roles.some(role => 
            role.name?.toLowerCase().includes('admin') || 
            role.name?.toLowerCase().includes('super')
        );

        // Log successful login
        await auditService.logActivity(user.id, AUTH_AUDIT_EVENTS.LOGIN_SUCCESS, 'auth', null, {
            session_id: sessionResult.data.session_id,
            device_info: deviceInfo,
            ip_address: ipAddress,
            user_agent: clientInfo.user_agent
        });

        console.log('✅ Login successful for user:', user.username);

        return sendLoginSuccess(res, {
            user,
            tokens: sessionResult.data,
            session: sessionResult.data,
            permissions: {
                total: uniquePermissions.length,
                has_admin_access: hasAdminAccess
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        
        await auditService.logActivity(null, AUTH_AUDIT_EVENTS.LOGIN_FAILED, 'auth', null, {
            username: req.body?.username,
            reason: 'Internal server error',
            error: error.message,
            ip_address: extractClientInfo(req).ipAddress
        });

        return sendInternalError(res);
    }
};

/**
 * 🚪 LOGOUT - End user session and clear cookies
 * @route POST /auth/logout
 */
export const logout = async (req, res) => {
    try {
        const user = req.user;
        const { ipAddress } = extractClientInfo(req);

        // Support multiple logout token sources
        let refreshToken = null;
        
        if (req.body?.refresh_token) {
            refreshToken = req.body.refresh_token;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            refreshToken = req.headers.authorization.substring(7);
        } else if (req.cookies?.refresh_token) {
            refreshToken = req.cookies.refresh_token;
        }

        const logoutMethod = refreshToken ? 'refresh_token' : 
                            req.cookies?.access_token ? 'cookie' : 
                            req.headers.authorization ? 'bearer_token' : 
                            'session_cleanup';

        console.log('🚪 Logout request:', {
            user_id: user?.id,
            username: user?.username,
            hasRefreshToken: !!refreshToken,
            hasCookies: !!req.cookies?.access_token,
            ipAddress,
            logoutMethod
        });

        let logoutResult = null;
        
        try {
            if (refreshToken && refreshToken.length > 50) {
                logoutResult = await sessionService.logout(refreshToken);
            } else if (req.cookies?.access_token) {
                logoutResult = await sessionService.logout(req.cookies.access_token);
            } else if (req.headers.authorization) {
                const accessToken = req.headers.authorization.substring(7);
                logoutResult = await sessionService.logout(accessToken);
            } else {
                // Fallback: just clear cookies
                logoutResult = { success: true };
            }
        } catch (sessionError) {
            console.error('⚠️ Session logout error:', sessionError);
            logoutResult = { success: false, error: sessionError.message };
        }

        // Log logout activity (non-blocking)
        if (user?.id) {
            try {
                await auditService.logActivity(
                    user.id,
                    AUTH_AUDIT_EVENTS.LOGOUT,
                    'auth',
                    null,
                    {
                        logoutMethod,
                        sessionInvalidated: logoutResult?.success ?? false
                    }
                );
            } catch (err) {
                console.error('❌ Failed to log logout activity:', err);
            }
        }

        // Always clear cookies regardless of session invalidation result
        clearAuthCookies(res);

        console.log('✅ Logout completed:', { logoutMethod, result: logoutResult });

        return sendSuccess(res, {
            session_invalidated: logoutResult?.success ?? false,
            method: logoutMethod
        }, AUTH_MESSAGES.LOGOUT_SUCCESS);

    } catch (error) {
        console.error('❌ Logout error:', error);
        
        // Still clear cookies even if logout fails
        clearAuthCookies(res);
        
        return sendInternalError(res);
    }
};