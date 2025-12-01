// features/permissions/permission.model.js
import { z } from 'zod';

/**
 * Permission validation schemas and models
 */

// Available categories for permissions
const PERMISSION_CATEGORIES = [
    'system',
    'user',
    'role',
    'permission',
    'device',
    'organization',
    'department',
    'audit',
    'report',
    'maintenance',
    'pdu',
    'outlet',
    'iot'
];

// Available actions for permissions
const PERMISSION_ACTIONS = [
    'create',
    'read',
    'update',
    'delete',
    'manage',
    'assign',
    'unassign',
    'view',
    'edit',
    'control',
    'monitor',
    'configure'
];

/**
 * Base permission schema
 */
const PermissionBaseSchema = z.object({
    name: z.string()
        .min(3, 'Permission name must be at least 3 characters')
        .max(100, 'Permission name must be at most 100 characters')
        .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, 'Permission name must follow dot notation pattern (e.g., device.read)')
        .trim(),
        
    description: z.string()
        .min(5, 'Permission description must be at least 5 characters')
        .max(500, 'Permission description must be at most 500 characters')
        .trim()
        .optional(),
        
    category: z.enum(PERMISSION_CATEGORIES, {
        errorMap: () => ({ message: `Category must be one of: ${PERMISSION_CATEGORIES.join(', ')}` })
    }),
    
    resource: z.string()
        .min(3, 'Resource must be at least 3 characters')
        .max(50, 'Resource must be at most 50 characters')
        .regex(/^[a-z][a-z0-9_]*$/, 'Resource must contain only lowercase letters, numbers, and underscores')
        .trim(),
        
    action: z.enum(PERMISSION_ACTIONS, {
        errorMap: () => ({ message: `Action must be one of: ${PERMISSION_ACTIONS.join(', ')}` })
    }),
    
    organization_id: z.number()
        .int('Organization ID must be an integer')
        .positive('Organization ID must be positive')
        .optional()
        .nullable(),
        
    is_system: z.boolean()
        .default(false),
        
    is_active: z.boolean()
        .default(true)
});

/**
 * Permission creation schema
 */
const PermissionCreateSchema = PermissionBaseSchema.extend({
    // Name is required for creation and must be unique
    name: PermissionBaseSchema.shape.name,
    
    // Description is required for creation
    description: z.string()
        .min(5, 'Permission description must be at least 5 characters')
        .max(500, 'Permission description must be at most 500 characters')
        .trim()
});

/**
 * Permission update schema
 */
const PermissionUpdateSchema = PermissionBaseSchema.partial().extend({
    // System permissions cannot be modified in certain ways
    name: z.string()
        .min(3, 'Permission name must be at least 3 characters')
        .max(100, 'Permission name must be at most 100 characters')
        .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, 'Permission name must follow dot notation pattern')
        .trim()
        .optional(),
        
    is_system: z.boolean()
        .optional()
        .refine(val => val !== true, 'Cannot set permission as system permission via API')
});

/**
 * Query parameters schema for getting permissions
 */
const PermissionQuerySchema = z.object({
    page: z.string()
        .optional()
        .transform(val => val ? parseInt(val) : 1)
        .refine(val => val > 0, 'Page must be positive'),
        
    limit: z.string()
        .optional()
        .transform(val => val ? parseInt(val) : 20)
        .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
        
    search: z.string()
        .optional()
        .transform(val => val?.trim())
        .refine(val => !val || val.length >= 2, 'Search term must be at least 2 characters'),
        
    category: z.enum(PERMISSION_CATEGORIES)
        .optional(),
        
    resource: z.string()
        .optional()
        .transform(val => val?.trim()),
        
    action: z.enum(PERMISSION_ACTIONS)
        .optional(),
        
    is_system: z.string()
        .optional()
        .transform(val => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        }),
        
    include_roles: z.string()
        .optional()
        .transform(val => val === 'true'),
        
    include_users: z.string()
        .optional()
        .transform(val => val === 'true')
});

/**
 * Search schema
 */
const PermissionSearchSchema = z.object({
    search: z.string()
        .min(2, 'Search term must be at least 2 characters')
        .max(100, 'Search term must be at most 100 characters')
        .trim(),
        
    category: z.enum(PERMISSION_CATEGORIES)
        .optional(),
        
    include_roles: z.boolean()
        .default(false),
        
    limit: z.number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit must be at most 100')
        .default(50)
});

/**
 * Permission ID validation schema
 */
const PermissionIdSchema = z.union([
    z.string().transform(val => {
        const parsed = parseInt(val);
        if (isNaN(parsed)) {
            throw new Error('Invalid permission ID');
        }
        return parsed;
    }),
    z.number().int('Permission ID must be an integer')
]).refine(val => val > 0, 'Permission ID must be positive');

/**
 * Permission model class with validation methods
 */
export class PermissionModel {
    /**
     * Validate permission creation data
     */
    static validateCreateData(data) {
        try {
            const validatedData = PermissionCreateSchema.parse(data);
            
            // Ensure name follows the category.resource.action pattern
            const nameParts = validatedData.name.split('.');
            if (nameParts.length < 2) {
                throw new Error('Permission name must follow the pattern: resource.action or category.resource.action');
            }
            
            // Auto-generate description if not provided
            if (!validatedData.description) {
                const [resource, action] = nameParts.length === 2 ? nameParts : nameParts.slice(1);
                validatedData.description = `Allow ${action} operations on ${resource}`;
            }
            
            return validatedData;
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(err => err.message).join(', ');
                throw new Error(`Validation error: ${errorMessages}`);
            }
            throw error;
        }
    }

    /**
     * Validate permission update data
     */
    static validateUpdateData(data) {
        try {
            const validatedData = PermissionUpdateSchema.parse(data);
            
            // If name is being updated, ensure it follows the pattern
            if (validatedData.name) {
                const nameParts = validatedData.name.split('.');
                if (nameParts.length < 2) {
                    throw new Error('Permission name must follow the pattern: resource.action or category.resource.action');
                }
            }
            
            return validatedData;
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(err => err.message).join(', ');
                throw new Error(`Validation error: ${errorMessages}`);
            }
            throw error;
        }
    }

    /**
     * Sanitize and validate query parameters for getAllPermissions
     */
    static sanitizeGetAllQuery(query) {
        try {
            return PermissionQuerySchema.parse(query);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(err => err.message).join(', ');
                throw new Error(`Query validation error: ${errorMessages}`);
            }
            throw error;
        }
    }

    /**
     * Validate permission ID
     */
    static validatePermissionId(id) {
        try {
            return PermissionIdSchema.parse(id);
        } catch (error) {
            throw new Error('Invalid permission ID format');
        }
    }

    /**
     * Validate category
     */
    static validateCategory(category) {
        try {
            return z.enum(PERMISSION_CATEGORIES).parse(category);
        } catch (error) {
            throw new Error(`Invalid category. Must be one of: ${PERMISSION_CATEGORIES.join(', ')}`);
        }
    }

    /**
     * Validate action
     */
    static validateAction(action) {
        try {
            return z.enum(PERMISSION_ACTIONS).parse(action);
        } catch (error) {
            throw new Error(`Invalid action. Must be one of: ${PERMISSION_ACTIONS.join(', ')}`);
        }
    }

    /**
     * Validate search parameters
     */
    static validateSearchData(data) {
        try {
            return PermissionSearchSchema.parse(data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(err => err.message).join(', ');
                throw new Error(`Search validation error: ${errorMessages}`);
            }
            throw error;
        }
    }

    /**
     * Validate search term
     */
    static validateSearchTerm(searchTerm) {
        if (!searchTerm || typeof searchTerm !== 'string') {
            throw new Error('Search term is required and must be a string');
        }
        
        const trimmed = searchTerm.trim();
        if (trimmed.length < 2) {
            throw new Error('Search term must be at least 2 characters long');
        }
        
        if (trimmed.length > 100) {
            throw new Error('Search term must be at most 100 characters long');
        }
        
        return trimmed;
    }

    /**
     * Generate permission name from components
     */
    static generatePermissionName(category, resource, action) {
        // Validate components
        const validatedCategory = this.validateCategory(category);
        const validatedAction = this.validateAction(action);
        
        if (!resource || typeof resource !== 'string') {
            throw new Error('Resource is required and must be a string');
        }
        
        const cleanResource = resource.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_]*$/.test(cleanResource)) {
            throw new Error('Resource must contain only lowercase letters, numbers, and underscores');
        }
        
        return `${cleanResource}.${validatedAction}`;
    }

    /**
     * Parse permission name into components
     */
    static parsePermissionName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Permission name is required');
        }
        
        const parts = name.split('.');
        if (parts.length < 2) {
            throw new Error('Permission name must have at least resource and action');
        }
        
        if (parts.length === 2) {
            return {
                resource: parts[0],
                action: parts[1]
            };
        }
        
        return {
            category: parts[0],
            resource: parts[1],
            action: parts[2]
        };
    }

    /**
     * Check if permission name is system permission
     */
    static isSystemPermission(name) {
        const systemPermissions = [
            'system.admin',
            'system.manage',
            'user.create',
            'user.manage',
            'role.manage',
            'permission.manage'
        ];
        
        return systemPermissions.includes(name);
    }

    /**
     * Get default permissions for a category
     */
    static getDefaultPermissions(category) {
        const defaults = {
            device: ['device.read', 'device.create', 'device.update', 'device.delete', 'device.control'],
            user: ['user.read', 'user.update'],
            role: ['role.read'],
            organization: ['organization.read'],
            department: ['department.read'],
            pdu: ['pdu.read', 'pdu.control'],
            outlet: ['outlet.read', 'outlet.control'],
            iot: ['iot.read', 'iot.monitor']
        };
        
        return defaults[category] || [];
    }

    /**
     * Validate permission assignment compatibility
     */
    static validatePermissionCompatibility(permissions) {
        // Check for conflicting permissions
        const conflictRules = [
            // System admin should not be combined with restricted permissions
            {
                trigger: 'system.admin',
                conflicts: ['user.read'] // System admin already has all permissions
            }
        ];
        
        for (const rule of conflictRules) {
            if (permissions.includes(rule.trigger)) {
                for (const conflict of rule.conflicts) {
                    if (permissions.includes(conflict)) {
                        throw new Error(`Permission '${rule.trigger}' conflicts with '${conflict}'`);
                    }
                }
            }
        }
        
        return true;
    }
}

// Export schemas for external use
export {
    PermissionCreateSchema,
    PermissionUpdateSchema,
    PermissionQuerySchema,
    PermissionSearchSchema,
    PermissionIdSchema,
    PERMISSION_CATEGORIES,
    PERMISSION_ACTIONS
};