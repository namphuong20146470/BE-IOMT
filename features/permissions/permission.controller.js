// features/permissions/permission.controller.js
import permissionService from './permission.service.js';

/**
 * Get all permissions with filtering and pagination
 */
export const getAllPermissions = async (req, res) => {
    try {
        const result = await permissionService.getAllPermissions(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permissions',
            error: error.message
        });
    }
};

/**
 * Get permission by ID
 */
export const getPermissionById = async (req, res) => {
    try {
        const options = {
            include_roles: req.query.include_roles === 'true',
            include_users: req.query.include_users === 'true'
        };
        
        const result = await permissionService.getPermissionById(
            req.params.id || req.params.permissionId, 
            req.user, 
            options
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permission:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permission',
            error: error.message
        });
    }
};

/**
 * Create new permission
 */
export const createPermission = async (req, res) => {
    try {
        const result = await permissionService.createPermission(req.body, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to create permission',
            error: error.message
        });
    }
};

/**
 * Update permission
 */
export const updatePermission = async (req, res) => {
    try {
        const result = await permissionService.updatePermission(
            req.params.id_permission || req.params.id || req.params.permissionId, 
            req.body, 
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to update permission',
            error: error.message
        });
    }
};

/**
 * Delete permission
 */
export const deletePermission = async (req, res) => {
    try {
        const result = await permissionService.deletePermission(
            req.params.id_permission || req.params.id || req.params.permissionId, 
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to delete permission',
            error: error.message
        });
    }
};

/**
 * Get permissions by category
 */
export const getPermissionsByCategory = async (req, res) => {
    try {
        const options = {
            include_roles: req.query.include_roles === 'true',
            include_users: req.query.include_users === 'true'
        };
        
        const result = await permissionService.getPermissionsByCategory(
            req.params.category, 
            req.user, 
            options
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permissions by category:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permissions by category',
            error: error.message
        });
    }
};

/**
 * Search permissions
 */
export const searchPermissions = async (req, res) => {
    try {
        const { search } = req.query;
        if (!search) {
            return res.status(400).json({
                success: false,
                message: 'Search term is required',
                error: 'Search term is required'
            });
        }
        
        const options = {
            category: req.query.category,
            include_roles: req.query.include_roles === 'true',
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        
        const result = await permissionService.searchPermissions(search, req.user, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error searching permissions:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to search permissions',
            error: error.message
        });
    }
};

/**
 * Get permissions hierarchy
 */
export const getPermissionsHierarchy = async (req, res) => {
    try {
        const result = await permissionService.getPermissionsHierarchy(req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permissions hierarchy:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permissions hierarchy',
            error: error.message
        });
    }
};

/**
 * Get permission statistics
 */
export const getPermissionStats = async (req, res) => {
    try {
        const result = await permissionService.getPermissionStats(req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permission statistics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permission statistics',
            error: error.message
        });
    }
};

/**
 * Validate permission assignment
 */
export const validatePermissionAssignment = async (req, res) => {
    try {
        const result = await permissionService.validatePermissionAssignment(
            req.params.permissionId, 
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error validating permission assignment:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Permission assignment validation failed',
            error: error.message
        });
    }
};

/**
 * Get available categories
 */
export const getCategories = async (req, res) => {
    try {
        // This could be moved to a separate service method if needed
        const categories = [
            'system', 'user', 'role', 'permission', 'device',
            'organization', 'department', 'audit', 'report',
            'maintenance', 'pdu', 'outlet', 'iot'
        ];
        
        res.status(200).json({
            success: true,
            message: 'Permission categories retrieved successfully',
            data: categories
        });
    } catch (error) {
        console.error('Error fetching permission categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch permission categories',
            error: error.message
        });
    }
};

/**
 * Get available actions
 */
export const getActions = async (req, res) => {
    try {
        // This could be moved to a separate service method if needed
        const actions = [
            'create', 'read', 'update', 'delete', 'manage',
            'assign', 'unassign', 'view', 'edit', 'control',
            'monitor', 'configure'
        ];
        
        res.status(200).json({
            success: true,
            message: 'Permission actions retrieved successfully',
            data: actions
        });
    } catch (error) {
        console.error('Error fetching permission actions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch permission actions',
            error: error.message
        });
    }
};

/**
 * Legacy endpoints compatibility
 */

// Get permission groups (deprecated - use categories instead)
export const getPermissionGroups = async (req, res) => {
    res.status(301).json({
        success: false,
        message: 'This endpoint has been deprecated. Use /api/v1/permissions/categories instead',
        redirect: '/api/v1/permissions/categories'
    });
};

// Get permissions for role (redirect to role management)
export const getPermissionsForRole = async (req, res) => {
    res.status(301).json({
        success: false,
        message: 'This endpoint has been moved to /api/v1/roles/{roleId}/permissions',
        redirect: `/api/v1/roles/${req.params.roleId}/permissions`
    });
};

export default {
    getAllPermissions,
    getPermissionById,
    createPermission,
    updatePermission,
    deletePermission,
    getPermissionsByCategory,
    searchPermissions,
    getPermissionsHierarchy,
    getPermissionStats,
    validatePermissionAssignment,
    getCategories,
    getActions,
    getPermissionGroups,
    getPermissionsForRole
};