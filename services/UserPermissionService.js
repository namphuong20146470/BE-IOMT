import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * 🚀 Comprehensive User Permission Service
 * Handles complex permission logic with user_permissions override table
 * 
 * Logic Flow:
 * 1. Get base permissions from user's roles
 * 2. Apply user_permissions overrides (grant/revoke)
 * 3. Check time validity (valid_from/valid_until)
 * 4. Return final effective permissions
 */
class UserPermissionService {

    /**
     * 🎯 Get all effective permissions for a user
     * @param {string} userId - User UUID
     * @returns {Promise<string[]>} Array of permission codes
     */
    async getUserPermissions(userId) {
        try {
            const query = `
                WITH 
                -- 1. Get permissions from user roles
                role_perms AS (
                    SELECT DISTINCT p.name as code, p.id
                    FROM user_roles ur
                    JOIN role_permissions rp ON ur.role_id = rp.role_id
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur.user_id = $1 
                      AND ur.is_active = true
                      AND p.is_active = true
                      AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
                      AND (ur.valid_until IS NULL OR ur.valid_until >= NOW())
                ),
                -- 2. Get user permission overrides
                user_overrides AS (
                    SELECT 
                        p.name as code,
                        p.id,
                        up.is_active,
                        up.notes
                    FROM user_permissions up
                    JOIN permissions p ON up.permission_id = p.id
                    WHERE up.user_id = $1
                      AND (up.valid_from IS NULL OR up.valid_from <= NOW())
                      AND (up.valid_until IS NULL OR up.valid_until >= NOW())
                ),
                -- 3. Permissions revoked by user_permissions
                revoked_perms AS (
                    SELECT id FROM user_overrides WHERE is_active = false
                ),
                -- 4. Permissions granted by user_permissions  
                granted_perms AS (
                    SELECT code, id FROM user_overrides WHERE is_active = true
                )
                -- Final result: Role permissions - Revoked + Granted
                SELECT DISTINCT name as code FROM role_perms
                WHERE id NOT IN (SELECT id FROM revoked_perms)
                UNION
                SELECT DISTINCT name as code FROM granted_perms;
            `;

            const result = await prisma.$queryRawUnsafe(query, userId);
            return result.map(row => row.code);
        } catch (error) {
            console.error('❌ Error getting user permissions:', error);
            throw new Error(`Failed to get user permissions: ${error.message}`);
        }
    }

    /**
     * 🔍 Get detailed permissions with metadata
     * @param {string} userId - User UUID
     * @returns {Promise<Object[]>} Detailed permission objects
     */
    async getUserPermissionsDetailed(userId) {
        try {
            const query = `
                WITH 
                role_perms AS (
                    SELECT DISTINCT 
                        p.name as code, 
                        p.name,
                        p.description,
                        p.id,
                        'role' as source,
                        r.name as source_name
                    FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    JOIN role_permissions rp ON r.id = rp.role_id
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur.user_id = $1 
                      AND ur.is_active = true
                      AND p.is_active = true
                      AND (ur.valid_from IS NULL OR ur.valid_from <= NOW())
                      AND (ur.valid_until IS NULL OR ur.valid_until >= NOW())
                ),
                user_overrides AS (
                    SELECT 
                        p.name as code,
                        p.name,
                        p.description,
                        p.id,
                        CASE WHEN up.is_active THEN 'granted' ELSE 'revoked' END as source,
                        up.notes as source_name,
                        up.is_active,
                        up.valid_until,
                        up.granted_at,
                        granter.username as granted_by_name
                    FROM user_permissions up
                    JOIN permissions p ON up.permission_id = p.id
                    LEFT JOIN users granter ON up.granted_by = granter.id
                    WHERE up.user_id = $1
                      AND (up.valid_from IS NULL OR up.valid_from <= NOW())
                      AND (up.valid_until IS NULL OR up.valid_until >= NOW())
                ),
                revoked_ids AS (
                    SELECT id FROM user_overrides WHERE is_active = false
                )
                -- Role permissions (not revoked)
                SELECT 
                    code, name, description, source, source_name,
                    null as granted_at, null as valid_until, null as granted_by_name
                FROM role_perms
                WHERE id NOT IN (SELECT id FROM revoked_ids)
                UNION ALL
                -- Granted permissions
                SELECT 
                    code, name, description, source, source_name,
                    granted_at, valid_until, granted_by_name
                FROM user_overrides 
                WHERE is_active = true
                ORDER BY code;
            `;

            const result = await prisma.$queryRawUnsafe(query, userId);
            return result;
        } catch (error) {
            console.error('❌ Error getting detailed permissions:', error);
            throw new Error(`Failed to get detailed permissions: ${error.message}`);
        }
    }

    /**
     * ✅ Check if user has specific permission
     * @param {string} userId - User UUID
     * @param {string} permissionCode - Permission code to check
     * @returns {Promise<boolean>}
     */
    async hasPermission(userId, permissionCode) {
        try {
            const permissions = await this.getUserPermissions(userId);
            return permissions.includes(permissionCode);
        } catch (error) {
            console.error(`❌ Error checking permission ${permissionCode}:`, error);
            return false;
        }
    }

    /**
     * 🎁 Grant additional permission to user
     * @param {Object} params - Grant parameters
     * @returns {Promise<Object>} Created permission record
     */
    async grantPermission({
        userId,
        permissionCode,
        grantedBy,
        validUntil = null,
        notes = null
    }) {
        try {
            // Get permission ID by name (used as code)
            const permission = await prisma.permissions.findFirst({
                where: { name: permissionCode, is_active: true }
            });

            if (!permission) {
                throw new Error(`Permission '${permissionCode}' not found`);
            }

            // Check if override already exists
            const existing = await prisma.user_permissions.findFirst({
                where: {
                    user_id: userId,
                    permission_id: permission.id
                }
            });

            if (existing) {
                // Update existing record
                const updated = await prisma.user_permissions.update({
                    where: { id: existing.id },
                    data: {
                        is_active: true,
                        granted_by: grantedBy,
                        granted_at: new Date(),
                        valid_until: validUntil,
                        notes: notes || `Updated: Grant permission ${permissionCode}`
                    },
                    include: {
                        permissions: true,
                        granted_by_user: {
                            select: { username: true, email: true }
                        }
                    }
                });
                return updated;
            } else {
                // Create new record
                const created = await prisma.user_permissions.create({
                    data: {
                        user_id: userId,
                        permission_id: permission.id,
                        granted_by: grantedBy,
                        granted_at: new Date(),
                        valid_from: new Date(),
                        valid_until: validUntil,
                        is_active: true,
                        notes: notes || `Grant permission: ${permissionCode}`
                    },
                    include: {
                        permissions: true,
                        granted_by_user: {
                            select: { username: true, email: true }
                        }
                    }
                });
                return created;
            }
        } catch (error) {
            console.error('❌ Error granting permission:', error);
            throw new Error(`Failed to grant permission: ${error.message}`);
        }
    }

    /**
     * 🚫 Revoke permission from user
     * @param {Object} params - Revoke parameters
     * @returns {Promise<Object>} Updated permission record
     */
    async revokePermission({
        userId,
        permissionCode,
        revokedBy,
        notes = null
    }) {
        try {
            // Get permission ID by name (used as code)
            const permission = await prisma.permissions.findFirst({
                where: { name: permissionCode, is_active: true }
            });

            if (!permission) {
                throw new Error(`Permission '${permissionCode}' not found`);
            }

            // Check if override exists
            const existing = await prisma.user_permissions.findFirst({
                where: {
                    user_id: userId,
                    permission_id: permission.id
                }
            });

            if (existing) {
                // Update existing record to revoke
                const updated = await prisma.user_permissions.update({
                    where: { id: existing.id },
                    data: {
                        is_active: false,
                        granted_by: revokedBy,
                        granted_at: new Date(),
                        notes: notes || `Revoke permission: ${permissionCode}`
                    },
                    include: {
                        permissions: true,
                        granted_by_user: {
                            select: { username: true, email: true }
                        }
                    }
                });
                return updated;
            } else {
                // Create new revoke record
                const created = await prisma.user_permissions.create({
                    data: {
                        user_id: userId,
                        permission_id: permission.id,
                        granted_by: revokedBy,
                        granted_at: new Date(),
                        valid_from: new Date(),
                        is_active: false, // KEY: false = revoke
                        notes: notes || `Revoke permission: ${permissionCode}`
                    },
                    include: {
                        permissions: true,
                        granted_by_user: {
                            select: { username: true, email: true }
                        }
                    }
                });
                return created;
            }
        } catch (error) {
            console.error('❌ Error revoking permission:', error);
            throw new Error(`Failed to revoke permission: ${error.message}`);
        }
    }

    /**
     * 📋 Get user's permission overrides (grants/revokes)
     * @param {string} userId - User UUID
     * @returns {Promise<Object[]>} Permission overrides
     */
    async getUserPermissionOverrides(userId) {
        try {
            const overrides = await prisma.user_permissions.findMany({
                where: { user_id: userId },
                include: {
                    permissions: true,
                    granted_by_user: {
                        select: { username: true, email: true }
                    }
                },
                orderBy: { granted_at: 'desc' }
            });

            return overrides.map(override => ({
                id: override.id,
                permission: {
                    code: override.permissions.code,
                    name: override.permissions.name,
                    description: override.permissions.description
                },
                action: override.is_active ? 'granted' : 'revoked',
                granted_by: override.granted_by_user,
                granted_at: override.granted_at,
                valid_from: override.valid_from,
                valid_until: override.valid_until,
                is_active: override.is_active,
                notes: override.notes,
                is_expired: override.valid_until ? new Date() > new Date(override.valid_until) : false
            }));
        } catch (error) {
            console.error('❌ Error getting user overrides:', error);
            throw new Error(`Failed to get user overrides: ${error.message}`);
        }
    }

    /**
     * 🔄 Bulk grant/revoke permissions
     * @param {Object} params - Bulk operation parameters
     * @returns {Promise<Object[]>} Results
     */
    async bulkUpdatePermissions({
        userId,
        grants = [],
        revokes = [],
        grantedBy,
        notes = null
    }) {
        try {
            const results = [];

            // Process grants
            for (const permissionCode of grants) {
                try {
                    const result = await this.grantPermission({
                        userId,
                        permissionCode,
                        grantedBy,
                        notes
                    });
                    results.push({ action: 'granted', permission: permissionCode, success: true, result });
                } catch (error) {
                    results.push({ action: 'granted', permission: permissionCode, success: false, error: error.message });
                }
            }

            // Process revokes
            for (const permissionCode of revokes) {
                try {
                    const result = await this.revokePermission({
                        userId,
                        permissionCode,
                        revokedBy: grantedBy,
                        notes
                    });
                    results.push({ action: 'revoked', permission: permissionCode, success: true, result });
                } catch (error) {
                    results.push({ action: 'revoked', permission: permissionCode, success: false, error: error.message });
                }
            }

            return results;
        } catch (error) {
            console.error('❌ Error in bulk update:', error);
            throw new Error(`Bulk update failed: ${error.message}`);
        }
    }
}

export default new UserPermissionService();