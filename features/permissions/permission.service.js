// features/permissions/permission.service.js
import { PrismaClient } from '@prisma/client';
import PermissionRepository from './permission.repository.js';
import { PermissionModel } from './permission.model.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import { 
    hasPermissionEnhanced as checkPermission,
    validateOrganizationAccess,
    getEffectiveOrganizationId
} from '../../shared/utils/permissionHelpers.js';
import { filterHiddenPermissions } from '../../shared/constants/permissions.constants.js';

const prisma = new PrismaClient();
const permissionRepository = new PermissionRepository();

// Helper function to get accessible organization IDs
async function getAccessibleOrganizationIds(userId) {
    // For now, return empty array to allow all access
    // This should be implemented based on user's organization membership
    return [];
}

// Helper to check permissions with proper error handling
async function checkPermissionWithError(user, permission) {
    const hasPermission = await checkPermission(user, permission);
    if (!hasPermission) {
        throw new AppError('Insufficient permissions', 403);
    }
}

class PermissionService {
    /**
     * Get all permissions with filtering and pagination
     */
    async getAllPermissions(queryParams, user) {
        try {
            // Check permission to view permissions
            await checkPermissionWithError(user, 'permission.read');
            
            // Validate and sanitize query parameters
            const sanitizedQuery = PermissionModel.sanitizeGetAllQuery(queryParams);
            
            // Apply organization access control
            const accessibleOrganizations = await getAccessibleOrganizationIds(user.id);
            
            // Get permissions from repository
            const result = await permissionRepository.findPermissions({
                ...sanitizedQuery,
                organizationIds: accessibleOrganizations,
                includeRoles: sanitizedQuery.include_roles,
                includeUsers: sanitizedQuery.include_users
            });
            
            // ✅ Filter out hidden permissions at service layer
            const filteredPermissions = filterHiddenPermissions(result.permissions);
            
            return {
                success: true,
                message: 'Permissions retrieved successfully',
                data: filteredPermissions,
                pagination: result.pagination
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to fetch permissions', error.statusCode || 500);
        }
    }

    /**
     * Get permission by ID
     */
    async getPermissionById(permissionId, user, options = {}) {
        try {
            // Check permission to view permissions
            await checkPermissionWithError(user, 'permission.read');
            
            // Validate permission ID
            const validatedId = PermissionModel.validatePermissionId(permissionId);
            
            // Get permission from repository
            const permission = await permissionRepository.findById(validatedId, {
                includeRoles: options.include_roles,
                includeUsers: options.include_users
            });
            
            if (!permission) {
                throw new AppError('Permission not found', 404);
            }
            
            // Check organization access if permission has organization context
            if (permission.organization_id) {
                const accessCheck = validateOrganizationAccess(user, permission.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            return {
                success: true,
                message: 'Permission retrieved successfully',
                data: permission
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to fetch permission', error.statusCode || 500);
        }
    }

    /**
     * Create new permission
     */
    async createPermission(permissionData, user) {
        try {
            // Check permission to create permissions
            await checkPermissionWithError(user, 'permission.create');
            
            // Validate and sanitize permission data
            const validatedData = PermissionModel.validateCreateData(permissionData);
            
            // Check if permission with same name already exists
            const existingPermission = await permissionRepository.findByName(validatedData.name);
            if (existingPermission) {
                throw new AppError('Permission with this name already exists', 409);
            }
            
            // Validate organization access if specified
            if (validatedData.organization_id) {
                const accessCheck = validateOrganizationAccess(user, validatedData.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            // Add audit fields
            const dataToCreate = {
                ...validatedData,
                created_by: user.id,
                created_at: new Date()
            };
            
            // Create permission
            const permission = await permissionRepository.create(dataToCreate);
            
            return {
                success: true,
                message: 'Permission created successfully',
                data: permission
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to create permission', error.statusCode || 400);
        }
    }

    /**
     * Update permission
     */
    async updatePermission(permissionId, updateData, user) {
        try {
            // Check permission to update permissions
            await checkPermissionWithError(user, 'permission.update');
            
            // Validate permission ID
            const validatedId = PermissionModel.validatePermissionId(permissionId);
            
            // Check if permission exists
            const existingPermission = await permissionRepository.findById(validatedId);
            if (!existingPermission) {
                throw new AppError('Permission not found', 404);
            }
            
            // Check organization access
            if (existingPermission.organization_id) {
                const accessCheck = validateOrganizationAccess(user, existingPermission.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            // Validate and sanitize update data
            const validatedData = PermissionModel.validateUpdateData(updateData);
            
            // Check for name conflicts if name is being updated
            if (validatedData.name && validatedData.name !== existingPermission.name) {
                const conflictingPermission = await permissionRepository.findByName(validatedData.name);
                if (conflictingPermission) {
                    throw new AppError('Permission with this name already exists', 409);
                }
            }
            
            // Validate organization access for new organization if being changed
            if (validatedData.organization_id && validatedData.organization_id !== existingPermission.organization_id) {
                const accessCheck = validateOrganizationAccess(user, validatedData.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            // Add audit fields
            const dataToUpdate = {
                ...validatedData,
                updated_by: user.id,
                updated_at: new Date()
            };
            
            // Update permission
            const permission = await permissionRepository.update(validatedId, dataToUpdate);
            
            return {
                success: true,
                message: 'Permission updated successfully',
                data: permission
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to update permission', error.statusCode || 400);
        }
    }

    /**
     * Delete permission
     */
    async deletePermission(permissionId, user) {
        try {
            // Check permission to delete permissions
            await checkPermissionWithError(user, 'permission.delete');
            
            // Validate permission ID
            const validatedId = PermissionModel.validatePermissionId(permissionId);
            
            // Check if permission exists
            const existingPermission = await permissionRepository.findById(validatedId, {
                includeRoles: true,
                includeUsers: true
            });
            
            if (!existingPermission) {
                throw new AppError('Permission not found', 404);
            }
            
            // Check organization access
            if (existingPermission.organization_id) {
                const accessCheck = validateOrganizationAccess(user, existingPermission.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            // Check if permission is system permission (cannot be deleted)
            if (existingPermission.is_system) {
                throw new AppError('System permissions cannot be deleted', 403);
            }
            
            // Check if permission is still assigned to roles
            if (existingPermission.roles && existingPermission.roles.length > 0) {
                throw new AppError(
                    `Permission is still assigned to ${existingPermission.roles.length} role(s). Remove from roles first.`,
                    400
                );
            }
            
            // Delete permission
            await permissionRepository.delete(validatedId);
            
            return {
                success: true,
                message: 'Permission deleted successfully'
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to delete permission', error.statusCode || 400);
        }
    }

    /**
     * Get permissions by category
     */
    async getPermissionsByCategory(category, user, options = {}) {
        try {
            // Check permission to view permissions
            await checkPermissionWithError(user, 'permission.read');
            
            // Validate category
            const validatedCategory = PermissionModel.validateCategory(category);
            
            // Apply organization access control
            const accessibleOrganizations = await getAccessibleOrganizationIds(user.id);
            
            // Get permissions by category
            const permissions = await permissionRepository.findByCategory(validatedCategory, {
                organizationIds: accessibleOrganizations,
                includeRoles: options.include_roles,
                includeUsers: options.include_users
            });
            
            // ✅ Filter out hidden permissions at service layer
            const filteredPermissions = filterHiddenPermissions(permissions);
            
            return {
                success: true,
                message: 'Permissions retrieved successfully',
                data: filteredPermissions,
                category: validatedCategory
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to fetch permissions by category', error.statusCode || 500);
        }
    }

    /**
     * Get permission statistics
     */
    async getPermissionStats(user) {
        try {
            // Check permission to view permission statistics
            await checkPermissionWithError(user, 'permission.read');
            
            // Apply organization access control
            const accessibleOrganizations = await getAccessibleOrganizationIds(user.id);
            
            // Get statistics from repository
            const stats = await permissionRepository.getStatistics(accessibleOrganizations);
            
            return {
                success: true,
                message: 'Permission statistics retrieved successfully',
                data: stats
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to fetch permission statistics', error.statusCode || 500);
        }
    }

    /**
     * Search permissions
     */
    async searchPermissions(searchTerm, user, options = {}) {
        try {
            // Check permission to view permissions
            await checkPermissionWithError(user, 'permission.read');
            
            // Validate search term
            const validatedTerm = PermissionModel.validateSearchTerm(searchTerm);
            
            // Apply organization access control
            const accessibleOrganizations = await getAccessibleOrganizationIds(user.id);
            
            // Search permissions
            const permissions = await permissionRepository.search(validatedTerm, {
                organizationIds: accessibleOrganizations,
                category: options.category,
                includeRoles: options.include_roles,
                limit: options.limit || 50
            });
            
            return {
                success: true,
                message: 'Permission search completed successfully',
                data: permissions,
                searchTerm: validatedTerm
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to search permissions', error.statusCode || 500);
        }
    }

    /**
     * Get permissions hierarchy (grouped by category and resource)
     */
    async getPermissionsHierarchy(user) {
        try {
            // Check permission to view permissions
            await checkPermissionWithError(user, 'permission.read');
            
            // Apply organization access control
            const accessibleOrganizations = await getAccessibleOrganizationIds(user.id);
            
            // Get permissions hierarchy
            const hierarchy = await permissionRepository.getHierarchy(accessibleOrganizations);
            
            // ✅ Filter out hidden permissions from hierarchy at service layer
            const filteredHierarchy = {};
            for (const [category, resources] of Object.entries(hierarchy)) {
                filteredHierarchy[category] = {};
                for (const [resource, permissions] of Object.entries(resources)) {
                    filteredHierarchy[category][resource] = filterHiddenPermissions(permissions);
                }
            }
            
            return {
                success: true,
                message: 'Permissions hierarchy retrieved successfully',
                data: filteredHierarchy
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Failed to fetch permissions hierarchy', error.statusCode || 500);
        }
    }

    /**
     * Validate permission assignment (check if permission exists and user can assign it)
     */
    async validatePermissionAssignment(permissionId, user) {
        try {
            // Validate permission ID
            const validatedId = PermissionModel.validatePermissionId(permissionId);
            
            // Check if permission exists
            const permission = await permissionRepository.findById(validatedId);
            if (!permission) {
                throw new AppError('Permission not found', 404);
            }
            
            // Check organization access
            if (permission.organization_id) {
                const accessCheck = validateOrganizationAccess(user, permission.organization_id);
                if (!accessCheck.allowed) {
                    throw new AppError(accessCheck.message || 'Organization access denied', 403);
                }
            }
            
            // Check if user can assign this permission
            await checkPermissionWithError(user, 'role.manage_permissions');
            
            return {
                success: true,
                message: 'Permission can be assigned',
                data: permission
            };
            
        } catch (error) {
            throw new AppError(error.message || 'Permission assignment validation failed', error.statusCode || 400);
        }
    }
}

export default new PermissionService();