/**
 * Auth Service
 * Business logic layer for authentication
 * Coordinates between repository, validator, and external services
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRepository } from './repositories/auth.repository.js';
import { AuthValidator, ValidationError } from './auth.validator.js';
import { AuthTransformer } from './auth.transformer.js';
import { PASSWORD_CONFIG, AUTH_ERROR_CODES, AUDIT_ACTIONS } from './auth.constants.js';
import sessionService from '../../shared/services/SessionService.js';
import auditService from '../../shared/services/AuditService.js';

export class AuthError extends Error {
    constructor(message, code = 'AUTH_ERROR', statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

export class AuthService {
    /**
     * Login user - Complete authentication flow
     */
    static async login(username, password, clientInfo) {
        // 1. Validate input
        AuthValidator.validateLoginInput(username, password);
        
        // 2. Find user
        const users = await AuthRepository.findUserWithFullInfo(username);
        
        if (users.length === 0) {
            throw new AuthError(
                'Invalid credentials',
                AUTH_ERROR_CODES.INVALID_CREDENTIALS,
                401
            );
        }
        
        const user = users[0];
        
        // 3. Verify password (with auto-migration)
        const isValid = await this.verifyPassword(password, user.password_hash, user.id);
        
        if (!isValid) {
            throw new AuthError(
                'Invalid credentials',
                AUTH_ERROR_CODES.INVALID_CREDENTIALS,
                401
            );
        }
        
        // 4. Parse role (user only has 1 role)
        const role = this.parseUserRole(user.roles);
        
        // 5. Security check
        const securityCheck = await sessionService.detectSuspiciousActivity(
            user.id, 
            clientInfo.ipAddress
        );
        
        if (securityCheck?.is_suspicious) {
            console.log(`⚠️ Suspicious login: ${user.username}`, securityCheck.analysis);
        }
        
        // 6. Create session
        const userForToken = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            organization_id: user.organization_id,
            department_id: user.department_id,
            role
        };
        
        const sessionData = await sessionService.createSession(
            user.id,
            clientInfo.deviceInfo,
            clientInfo.ipAddress,
            userForToken
        );
        
        if (!sessionData?.success) {
            throw new AuthError(
                'Failed to create session',
                AUTH_ERROR_CODES.SESSION_ERROR,
                500
            );
        }
        
        // 7. Log audit
        await auditService.logActivity(
            user.id,
            AUDIT_ACTIONS.LOGIN,
            'auth',
            sessionData.data.session_id,
            {
                username: user.username,
                ip: clientInfo.ipAddress,
                userAgent: clientInfo.userAgent,
                loginMethod: 'localStorage'
            },
            user.organization_id
        ).catch(console.error);
        
        // 8. Transform and return
        return {
            user: AuthTransformer.transformUser(user, role),
            tokens: AuthTransformer.transformTokens(sessionData.data),
            session: AuthTransformer.transformSession(sessionData.data, clientInfo),
            permissions_summary: AuthTransformer.transformPermissionsSummary(role),
            security_info: AuthTransformer.transformSecurityInfo(securityCheck)
        };
    }

    /**
     * Refresh access token
     */
    static async refreshAccessToken(refreshToken, ipAddress, sessionId = null) {
        // 1. Validate refresh token
        AuthValidator.validateRefreshToken(refreshToken);
        
        // 2. Refresh via session service
        const result = await sessionService.refreshAccessToken(refreshToken, ipAddress, sessionId);
        
        if (!result.success) {
            throw new AuthError(
                result.error || 'Invalid or expired refresh token',
                AUTH_ERROR_CODES.TOKEN_INVALID,
                401
            );
        }
        
        // 3. Transform and return
        return {
            user: AuthTransformer.transformUser(result.data.user, result.data.user.role),
            tokens: {
                access_token: result.data.access_token,
                access_token_expires_in: result.data.expires_in,
                token_type: 'Bearer'
            },
            session: {
                session_id: result.data.session_id,
                device_id: result.data.device_id || 'unknown-device',
                ip_address: ipAddress,
                created_at: result.data.created_at || new Date().toISOString(),
                expires_at: result.data.expires_at
            },
            permissions_summary: AuthTransformer.transformPermissionsSummary(result.data.user.role)
        };
    }

    /**
     * Logout user
     */
    static async logout(tokens, sessionId, userId, username, clientInfo) {
        const { refreshToken, bearerToken, accessToken } = tokens;
        
        const logoutMethod = refreshToken ? 'refresh_token' : 
                           bearerToken ? 'bearer_token' :
                           accessToken ? 'access_token' : 
                           sessionId ? 'session_id' : 'no_auth';

        // Try to invalidate session
        let logoutResult = { success: false };
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
            }
        } catch (error) {
            console.warn('⚠️ Session invalidation failed:', error.message);
        }

        // Log logout activity
        if (userId) {
            auditService.logActivity(
                userId,
                AUDIT_ACTIONS.LOGOUT,
                'auth',
                sessionId,
                {
                    ip: clientInfo.ipAddress,
                    userAgent: clientInfo.userAgent,
                    logoutMethod,
                    sessionInvalidated: logoutResult?.success ?? false
                }
            ).catch(console.error);
        }

        return AuthTransformer.transformLogoutResponse(
            sessionId,
            userId,
            username,
            logoutMethod,
            logoutResult?.success ?? false
        );
    }

    /**
     * Get user profile with role and permissions
     */
    static async getProfile(userId) {
        // Validate user ID
        AuthValidator.validateUserId(userId);
        
        // Get user with full details
        const user = await AuthRepository.findUserById(userId);
        
        if (!user) {
            throw new AuthError(
                'User not found',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        // Extract role with permissions
        const userRole = user.user_roles[0];
        const role = userRole ? {
            id: userRole.roles.id,
            name: userRole.roles.name,
            description: userRole.roles.description,
            color: userRole.roles.color,
            icon: userRole.roles.icon,
            permissions: userRole.roles.role_permissions.map(rp => rp.permissions.name)
        } : null;

        return {
            user: AuthTransformer.transformUserWithFullDetails(user, role),
            permissions_summary: AuthTransformer.transformPermissionsSummaryWithScopes(role)
        };
    }

    /**
     * Get user permissions for permission check endpoint
     */
    static async getUserPermissions(userId) {
        // Validate user ID
        AuthValidator.validateUserId(userId);
        
        // Get user with permissions
        const users = await AuthRepository.findUserWithPermissions(userId);
        
        if (users.length === 0) {
            throw new AuthError(
                'User not found',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        const user = users[0];
        const role = this.parseUserRole(user.roles);
        const permissions = role?.permissions || [];

        return {
            permissions,
            permission_map: AuthTransformer.transformPermissionMap(permissions),
            permissions_by_scope: AuthTransformer.transformPermissionsByScope(permissions),
            total: permissions.length,
            user_id: userId
        };
    }

    /**
     * Change user password
     */
    static async changePassword(userId, currentPassword, newPassword, sessionId, clientInfo) {
        // 1. Validate input
        AuthValidator.validatePasswordChange(currentPassword, newPassword);
        
        // 2. Get user
        const users = await AuthRepository.findUserWithFullInfo(userId);
        
        if (users.length === 0) {
            throw new AuthError(
                'User not found',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        const user = users[0];

        // 3. Verify current password
        const isValid = await this.verifyPasswordOnly(currentPassword, user.password_hash);
        
        if (!isValid) {
            // Log failed attempt
            await auditService.logActivity(
                userId,
                AUDIT_ACTIONS.FAILED_PASSWORD_CHANGE,
                'auth',
                null,
                {
                    reason: 'Invalid current password',
                    ip: clientInfo.ipAddress
                }
            ).catch(console.error);

            throw new AuthError(
                'Current password is incorrect',
                AUTH_ERROR_CODES.INVALID_PASSWORD,
                401
            );
        }

        // 4. Hash new password
        const newHash = await bcrypt.hash(newPassword, PASSWORD_CONFIG.BCRYPT_ROUNDS);

        // 5. Update password
        await AuthRepository.updatePassword(userId, newHash);

        // 6. Invalidate all sessions except current
        await sessionService.invalidateAllUserSessions(userId, sessionId);

        // 7. Log activity
        await auditService.logActivity(
            userId,
            AUDIT_ACTIONS.PASSWORD_CHANGED,
            'auth',
            null,
            {
                ip: clientInfo.ipAddress,
                userAgent: clientInfo.userAgent
            }
        ).catch(console.error);

        return AuthTransformer.transformPasswordChangeResponse(user, true);
    }

    /**
     * Get user profile - Full data for /me endpoint
     */
    static async getProfile(userId) {
        // 1. Validate user ID
        AuthValidator.validateUserId(userId);
        
        // 2. Get user with full relations
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
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
            throw new AuthError(
                'User not found or inactive',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        // 3. Transform roles with permissions
        const roles = user.user_roles.map(userRole => ({
            id: userRole.roles.id,
            name: userRole.roles.name,
            description: userRole.roles.description,
            color: userRole.roles.color,
            icon: userRole.roles.icon,
            permissions: userRole.roles.role_permissions.map(rp => rp.permissions.name)
        }));

        // 4. Calculate permissions summary
        const allPermissions = [...new Set(roles.flatMap(role => role.permissions))];
        const scopes = [...new Set(allPermissions.map(p => {
            const parts = p.split('.');
            return parts.length > 1 ? parts[0] : 'system';
        }))];

        return {
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                organization_id: user.organization_id,
                department_id: user.department_id,
                is_active: user.is_active,
                created_at: user.created_at,
                organization: user.organizations,
                department: user.departments,
                roles: roles
            },
            permissions_summary: {
                total: allPermissions.length,
                scopes: scopes,
                has_admin_access: roles.some(role => 
                    role.permissions.includes('system.admin')
                )
            }
        };
    }

    /**
     * Get user permissions with caching
     */
    static async getUserPermissions(userId) {
        // 1. Validate user ID
        AuthValidator.validateUserId(userId);
        
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        // 2. Check cache first
        const cacheKey = `permissions:${userId}`;
        const cached = await prisma.user_permission_cache.findUnique({
            where: { user_id: userId }
        });

        const now = new Date();
        
        if (cached && cached.expires_at > now) {
            // Cache hit - return cached data
            return {
                permissions: cached.permissions,
                scopes: cached.scopes,
                role: cached.role_data,
                cached: true,
                version: cached.version,
                cached_at: cached.cached_at,
                expires_at: cached.expires_at
            };
        }

        // 3. Cache miss - query fresh data
        const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
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
                                        permissions: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw new AuthError(
                'User not found',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        // 4. Extract permissions
        const allPermissions = [];
        const roleData = user.user_roles.map(ur => {
            const permissions = ur.roles.role_permissions.map(rp => {
                allPermissions.push(rp.permissions.name);
                return {
                    id: rp.permissions.id,
                    name: rp.permissions.name,
                    description: rp.permissions.description,
                    resource: rp.permissions.resource,
                    action: rp.permissions.action,
                    scope: rp.permissions.scope
                };
            });

            return {
                id: ur.roles.id,
                name: ur.roles.name,
                description: ur.roles.description,
                color: ur.roles.color,
                icon: ur.roles.icon,
                permissions: permissions
            };
        });

        // 5. Calculate scopes
        const uniquePermissions = [...new Set(allPermissions)];
        const scopes = [...new Set(uniquePermissions.map(p => {
            const parts = p.split('.');
            return parts.length > 1 ? parts[0] : 'system';
        }))];

        // 6. Update cache
        const version = `v${Date.now()}`;
        await prisma.user_permission_cache.upsert({
            where: { user_id: userId },
            update: {
                permissions: uniquePermissions,
                scopes: scopes,
                role_data: roleData,
                version: version,
                cached_at: now,
                expires_at: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes
                updated_at: now
            },
            create: {
                user_id: userId,
                permissions: uniquePermissions,
                scopes: scopes,
                role_data: roleData,
                version: version,
                cached_at: now,
                expires_at: new Date(now.getTime() + 15 * 60 * 1000)
            }
        });

        return {
            permissions: uniquePermissions,
            scopes: scopes,
            role: roleData[0] || null,
            cached: false,
            version: version,
            cached_at: now,
            expires_at: new Date(now.getTime() + 15 * 60 * 1000)
        };
    }

    /**
     * Update user profile
     */
    static async updateProfile(userId, updateData) {
        // 1. Validate user ID
        AuthValidator.validateUserId(userId);
        
        // 2. Validate and sanitize input
        const validated = AuthValidator.validateProfileUpdate(updateData);
        const sanitized = AuthValidator.sanitizeProfileUpdate(validated);

        // 3. Check if user exists
        const existingUser = await AuthRepository.getBasicUserInfo(userId);
        
        if (!existingUser) {
            throw new AuthError(
                'User not found or inactive',
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                404
            );
        }

        // 4. Check if email is taken
        if (sanitized.email && sanitized.email !== existingUser.email) {
            const emailTaken = await AuthRepository.isEmailTaken(sanitized.email, userId);
            
            if (emailTaken) {
                throw new ValidationError(
                    'Email is already taken by another user',
                    'EMAIL_ALREADY_EXISTS',
                    409
                );
            }
        }

        // 5. Update profile
        const updatedUser = await AuthRepository.updateProfile(userId, sanitized);

        // 6. Return transformed response
        const updatedFields = Object.keys(sanitized);
        return AuthTransformer.transformProfileUpdateResponse(updatedUser, updatedFields);
    }

    /**
     * Verify password with auto-migration support
     */
    static async verifyPassword(password, storedHash, userId) {
        let isValid = false;
        
        if (storedHash.startsWith('$2b$')) {
            // Bcrypt hash
            isValid = await bcrypt.compare(password, storedHash);
        } else {
            // Legacy SHA256 hash
            isValid = this.hashPasswordLegacy(password) === storedHash;
            
            // Auto-migrate to bcrypt
            if (isValid) {
                await this.migratePasswordToBcrypt(userId, password);
            }
        }
        
        return isValid;
    }

    /**
     * Verify password only (no migration)
     */
    static async verifyPasswordOnly(password, storedHash) {
        if (storedHash.startsWith('$2b$')) {
            return await bcrypt.compare(password, storedHash);
        } else {
            return this.hashPasswordLegacy(password) === storedHash;
        }
    }

    /**
     * Migrate legacy password to bcrypt
     */
    static async migratePasswordToBcrypt(userId, password) {
        try {
            const newHash = await bcrypt.hash(password, PASSWORD_CONFIG.BCRYPT_ROUNDS);
            await AuthRepository.updatePassword(userId, newHash);
            console.log(`🔄 Password migrated for user: ${userId}`);
        } catch (err) {
            console.error('Migration error:', err.message);
        }
    }

    /**
     * Hash password using legacy SHA256 (for backwards compatibility)
     */
    static hashPasswordLegacy(password) {
        return crypto.createHash(PASSWORD_CONFIG.HASH_ALGORITHM)
            .update(password)
            .digest('hex');
    }

    /**
     * Parse user role - handles both string and object, array and single
     */
    static parseUserRole(roles) {
        if (!roles || (Array.isArray(roles) && roles.length === 0)) {
            return null;
        }
        
        // Parse JSON string if needed
        let parsed = typeof roles === 'string' ? JSON.parse(roles) : roles;
        
        // If array, get first element (user only has 1 role)
        if (Array.isArray(parsed)) {
            return parsed[0] || null;
        }
        
        return parsed;
    }
}

export default AuthService;
