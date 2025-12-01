// features/roles/role.model.js
import { z } from 'zod';

/**
 * Role data validation schemas
 */

// Base role schema
const roleSchema = z.object({
    name: z.string()
        .min(1, 'Role name is required')
        .max(50, 'Role name must be less than 50 characters')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Role name contains invalid characters'),
    
    description: z.string()
        .max(255, 'Description must be less than 255 characters')
        .optional(),
    
    organization_id: z.number()
        .int()
        .positive('Organization ID must be a positive integer')
        .optional(),
    
    is_system_role: z.boolean()
        .default(false),
    
    is_active: z.boolean()
        .default(true)
});

// Create role schema
const createRoleSchema = roleSchema.omit({ is_system_role: true });

// Update role schema (partial)
const updateRoleSchema = roleSchema.partial().omit({ is_system_role: true });

// Query parameters schema
const queryParamsSchema = z.object({
    page: z.string()
        .transform(val => parseInt(val))
        .refine(val => val > 0, 'Page must be positive')
        .default('1'),
    
    limit: z.string()
        .transform(val => parseInt(val))
        .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
        .default('20'),
    
    organization_id: z.string()
        .transform(val => parseInt(val))
        .optional(),
    
    include_system: z.string()
        .transform(val => val === 'true')
        .default('false'),
    
    include_permissions: z.string()
        .transform(val => val === 'true')
        .default('false'),
    
    search: z.string()
        .max(100, 'Search term too long')
        .optional(),
    
    sort_by: z.enum(['name', 'created_at', 'updated_at'])
        .default('name'),
    
    sort_order: z.enum(['asc', 'desc'])
        .default('asc')
});

// Permission IDs schema
const permissionIdsSchema = z.array(
    z.string().uuid('Permission ID must be a valid UUID')
).min(1, 'At least one permission ID required');

// Single ID validation schemas
const roleIdSchema = z.string()
    .uuid('Role ID must be a valid UUID');

const permissionIdSchema = z.string()
    .uuid('Permission ID must be a valid UUID');

class RoleModel {
    /**
     * Validate role ID
     */
    validateRoleId(roleId) {
        const result = roleIdSchema.safeParse(roleId);
        
        if (!result.success) {
            throw new Error(`Invalid role ID: ${result.error.errors[0].message}`);
        }
        
        return result.data;
    }

    /**
     * Validate permission ID
     */
    validatePermissionId(permissionId) {
        const result = permissionIdSchema.safeParse(permissionId);
        
        if (!result.success) {
            throw new Error(`Invalid permission ID: ${result.error.errors[0].message}`);
        }
        
        return result.data;
    }

    /**
     * Validate permission IDs array
     */
    validatePermissionIds(permissionIds) {
        const result = permissionIdsSchema.safeParse(permissionIds);
        
        if (!result.success) {
            throw new Error(`Invalid permission IDs: ${result.error.errors[0].message}`);
        }
        
        return result.data;
    }

    /**
     * Validate create role data
     */
    validateCreateRole(data) {
        const result = createRoleSchema.safeParse(data);
        
        if (!result.success) {
            const errors = result.error.errors.map(err => 
                `${err.path.join('.')}: ${err.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${errors}`);
        }
        
        return result.data;
    }

    /**
     * Validate update role data
     */
    validateUpdateRole(data) {
        const result = updateRoleSchema.safeParse(data);
        
        if (!result.success) {
            const errors = result.error.errors.map(err => 
                `${err.path.join('.')}: ${err.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${errors}`);
        }
        
        return result.data;
    }

    /**
     * Validate query parameters
     */
    validateQueryParams(params) {
        const result = queryParamsSchema.safeParse(params);
        
        if (!result.success) {
            const errors = result.error.errors.map(err => 
                `${err.path.join('.')}: ${err.message}`
            ).join(', ');
            throw new Error(`Invalid query parameters: ${errors}`);
        }
        
        return result.data;
    }

    /**
     * Sanitize role data for response
     */
    sanitizeRole(role, includePermissions = false) {
        if (!role) return null;

        const sanitized = {
            id: role.id,
            name: role.name,
            description: role.description,
            is_system_role: role.is_system_role,
            organization_id: role.organization_id,
            is_custom: role.is_custom,
            color: role.color,
            icon: role.icon,
            sort_order: role.sort_order,
            is_active: role.is_active,
            created_by: role.created_by,
            created_at: role.created_at,
            updated_at: role.updated_at,
            organizations: role.organizations ? {
                id: role.organizations.id,
                name: role.organizations.name
            } : null,
            _count: {
                user_roles: role._count?.user_roles || 0
            }
        };

        // Only include role_permissions if explicitly requested
        if (includePermissions) {
            sanitized.role_permissions = role.role_permissions ? 
                role.role_permissions.map(rp => ({
                    id: rp.id,
                    role_id: rp.role_id,
                    permission_id: rp.permission_id,
                    permissions: {
                        id: rp.permissions.id,
                        name: rp.permissions.name,
                        description: rp.permissions.description
                    }
                })) : [];
        }

        return sanitized;
    }

    /**
     * Sanitize roles array for response
     */
    sanitizeRoles(roles) {
        if (!Array.isArray(roles)) return [];
        
        return roles.map(role => this.sanitizeRole(role));
    }

    /**
     * Transform role for audit logging
     */
    transformForAudit(role, action, user) {
        return {
            action,
            resource: 'role',
            resource_id: role.id,
            details: {
                role_name: role.name,
                organization_id: role.organization_id,
                is_system_role: role.is_system_role,
                performed_by: user.id,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get role display name
     */
    getDisplayName(role) {
        if (!role) return 'Unknown Role';
        
        let displayName = role.name;
        
        if (role.is_system_role) {
            displayName += ' (System)';
        }
        
        if (role.organization?.name) {
            displayName += ` - ${role.organization.name}`;
        }
        
        return displayName;
    }

    /**
     * Check if role is editable by user
     */
    isEditableBy(role, user) {
        // System admin can edit everything
        if (user.permissions.includes('system.admin')) {
            return true;
        }
        
        // Cannot edit system roles unless system admin
        if (role.is_system_role) {
            return false;
        }
        
        // Must have role management permission
        if (!user.permissions.includes('role.manage')) {
            return false;
        }
        
        // Must be in same organization
        if (role.organization_id && user.organization_id !== role.organization_id) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if role is deletable
     */
    isDeletableBy(role, user) {
        // Cannot delete system roles
        if (role.is_system_role) {
            return false;
        }
        
        // Must be editable first
        return this.isEditableBy(role, user);
    }

    /**
     * Get allowed permissions for role creation
     */
    getAllowedPermissionsFor(user, organizationId = null) {
        const allowedResources = [];
        
        if (user.permissions.includes('system.admin')) {
            // System admin can assign any permission
            return ['*'];
        }
        
        // Organization admin can assign organization-level permissions
        if (user.permissions.includes('organization.admin') && organizationId === user.organization_id) {
            allowedResources.push('user', 'role', 'device', 'organization');
        }
        
        // Role admin can assign basic permissions
        if (user.permissions.includes('role.manage')) {
            allowedResources.push('user.read', 'device.read');
        }
        
        return allowedResources;
    }
}

export default new RoleModel();