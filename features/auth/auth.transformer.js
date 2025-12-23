/**
 * Auth Transformer
 * Transform database entities to API response format
 * Single source of truth for response structure
 */

import { DEFAULT_VALUES } from './auth.constants.js';

export class AuthTransformer {
    /**
     * Transform user data for API response (multi-role system)
     */
    static transformUser(user, roles = null) {
        // Support multi-role: accept roles array
        const userRoles = roles || user.roles || [];
        
        return {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || null,
            avatar: user.avatar || null,
            organization_id: user.organization_id,
            department_id: user.department_id,
            is_active: user.is_active,
            organization_name: user.organization_name || null,
            department_name: user.department_name || null,
            created_at: user.created_at,
            last_login: user.last_login || user.last_login_at,
            // Multi-role system: return complete roles array
            roles: userRoles.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description || null,
                color: r.color || DEFAULT_VALUES.ROLE.color,
                icon: r.icon || DEFAULT_VALUES.ROLE.icon
            }))
        };
    }

    /**
     * Transform user with full details (for getMe endpoint)
     */
    static transformUserWithFullDetails(user, role = null) {
        return {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            organization_id: user.organization_id,
            department_id: user.department_id,
            is_active: user.is_active,
            created_at: user.created_at,
            last_login: user.last_login,
            // Full organization & department info
            organization: user.organizations || null,
            department: user.departments || null,
            // Single role object
            role: role
        };
    }

    /**
     * Transform tokens data
     */
    static transformTokens(sessionData) {
        return {
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
            access_token_expires_in: sessionData.expires_in,
            refresh_token_expires_in: sessionData.refresh_expires_in,
            token_type: 'Bearer'
        };
    }

    /**
     * Transform session data
     */
    static transformSession(sessionData, clientInfo = {}) {
        return {
            session_id: sessionData.session_id,
            device_id: clientInfo.deviceInfo?.user_agent || 
                      sessionData.device_id || 
                      DEFAULT_VALUES.DEVICE_ID,
            ip_address: clientInfo.ipAddress || sessionData.ip_address,
            created_at: sessionData.created_at || new Date().toISOString(),
            expires_at: sessionData.expires_at
        };
    }

    /**
     * Transform permissions summary (multi-role)
     */
    static transformPermissionsSummary(roles) {
        // Aggregate permissions from all roles
        const allPermissions = roles?.reduce((acc, role) => {
            const rolePerms = role?.permissions || [];
            return [...acc, ...rolePerms];
        }, []) || [];
        
        // Remove duplicates
        const uniquePermissions = [...new Set(allPermissions)];
        
        return {
            total: uniquePermissions.length,
            has_admin_access: uniquePermissions.includes('system.admin')
        };
    }

    /**
     * Transform permissions summary with scopes
     */
    static transformPermissionsSummaryWithScopes(role) {
        const permissions = role?.permissions || [];
        
        return {
            total: permissions.length,
            scopes: this.extractPermissionScopes(permissions),
            has_admin_access: permissions.includes('system.admin')
        };
    }

    /**
     * Extract permission scopes from permissions array
     */
    static extractPermissionScopes(permissions) {
        if (!permissions || permissions.length === 0) return [];
        
        const scopeMap = {
            'system.': 'global',
            'organization.': 'organization',
            'department.': 'department',
            'project.': 'project',
            'device.': 'device',
            'report.': 'report',
            'user.': 'user',
            'role.': 'role'
        };

        const scopes = new Set();
        
        permissions.forEach(permission => {
            let scopeFound = false;
            for (const [prefix, scope] of Object.entries(scopeMap)) {
                if (permission.includes(prefix)) {
                    scopes.add(scope);
                    scopeFound = true;
                    break;
                }
            }
            if (!scopeFound) {
                scopes.add('other');
            }
        });

        return Array.from(scopes);
    }

    /**
     * Transform permission map
     */
    static transformPermissionMap(permissions) {
        const map = {};
        (permissions || []).forEach(permission => {
            map[permission] = true;
        });
        return map;
    }

    /**
     * Transform permissions by scope
     */
    static transformPermissionsByScope(permissions) {
        if (!permissions || permissions.length === 0) {
            return {
                global: [],
                organization: [],
                department: [],
                project: [],
                device: [],
                report: [],
                user: [],
                role: [],
                other: []
            };
        }

        return {
            global: permissions.filter(p => p.includes('system.')),
            organization: permissions.filter(p => p.includes('organization.')),
            department: permissions.filter(p => p.includes('department.')),
            project: permissions.filter(p => p.includes('project.')),
            device: permissions.filter(p => p.includes('device.')),
            report: permissions.filter(p => p.includes('report.')),
            user: permissions.filter(p => p.includes('user.')),
            role: permissions.filter(p => p.includes('role.')),
            other: permissions.filter(p => 
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
    }

    /**
     * Transform security info
     */
    static transformSecurityInfo(securityCheck) {
        if (!securityCheck || !securityCheck.is_suspicious) {
            return null;
        }

        return {
            new_ip: securityCheck.new_ip,
            risk_level: securityCheck.analysis?.risk_level,
            recommendations: securityCheck.analysis?.recommendations
        };
    }

    /**
     * Transform profile update response
     */
    static transformProfileUpdateResponse(user, updatedFields) {
        return {
            user,
            updated_fields: updatedFields,
            updated_at: user.updated_at
        };
    }

    /**
     * Transform password change response
     */
    static transformPasswordChangeResponse(user, sessionPreserved = true) {
        return {
            user: {
                id: user.id,
                username: user.username,
                password_updated_at: new Date().toISOString()
            },
            session: {
                current_session_preserved: sessionPreserved,
                other_sessions_invalidated: true,
                requires_reauth: false
            },
            security: {
                password_strength: 'strong',
                last_password_change: new Date().toISOString()
            }
        };
    }

    /**
     * Transform logout response
     */
    static transformLogoutResponse(sessionId, userId, username, logoutMethod, sessionInvalidated) {
        return {
            session: {
                session_id: sessionId || null,
                logged_out_at: new Date().toISOString(),
                logout_method: logoutMethod,
                session_invalidated: sessionInvalidated
            },
            user: userId ? {
                id: userId,
                username: username
            } : null,
            cache_cleared: true,
            force_refresh: true
        };
    }

    /**
     * Transform verify session response
     */
    static transformVerifySessionResponse(user, session, authSource) {
        return {
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                organization_id: user.organization_id,
                department_id: user.department_id,
                role: user.role || null
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
        };
    }
}

export default AuthTransformer;
