// features/roles/role.controller.js
import roleService from './role.service.js';

/**
 * Get all roles with filtering and pagination
 */
export const getAllRoles = async (req, res) => {
    try {
        const result = await roleService.getAllRoles(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch roles',
            error: error.message
        });
    }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req, res) => {
    try {
        const options = {
            include_permissions: req.query.include_permissions === 'true',
            include_users: req.query.include_users === 'true'
        };
        
        const result = await roleService.getRoleById(req.params.id || req.params.roleId, req.user, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch role',
            error: error.message
        });
    }
};

/**
 * Create new role
 */
export const createRole = async (req, res) => {
    try {
        const result = await roleService.createRole(req.body, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to create role',
            error: error.message
        });
    }
};

/**
 * Update role
 */
export const updateRole = async (req, res) => {
    try {
        const result = await roleService.updateRole(req.params.id_role || req.params.id || req.params.roleId, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to update role',
            error: error.message
        });
    }
};

/**
 * Delete role
 */
export const deleteRole = async (req, res) => {
    try {
        const result = await roleService.deleteRole(req.params.id_role || req.params.id || req.params.roleId, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to delete role',
            error: error.message
        });
    }
};

/**
 * Get role permissions
 */
/**
 * Get role permissions (with optional grouping)
 */
export const getRolePermissions = async (req, res) => {
    try {
        const options = {
            grouped: req.query.grouped
        };
        const result = await roleService.getRolePermissions(req.params.roleId, req.user, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch role permissions',
            error: error.message
        });
    }
};

/**
 * Update role permissions
 */
export const updateRolePermissions = async (req, res) => {
    try {
        const { permission_ids } = req.body;
        const result = await roleService.updateRolePermissions(req.params.roleId, permission_ids, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating role permissions:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to update role permissions',
            error: error.message
        });
    }
};

/**
 * Assign permission to role
 */
export const assignPermissionToRole = async (req, res) => {
    try {
        const { permission_id } = req.body;
        const result = await roleService.assignPermissionToRole(req.params.roleId, permission_id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error assigning permission to role:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to assign permission to role',
            error: error.message
        });
    }
};

/**
 * Remove permission from role
 */
export const removePermissionFromRole = async (req, res) => {
    try {
        const result = await roleService.removePermissionFromRole(
            req.params.roleId, 
            req.params.permissionId, 
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error removing permission from role:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to remove permission from role',
            error: error.message
        });
    }
};

/**
 * Get role statistics
 */
export const getRoleStats = async (req, res) => {
    try {
        const result = await roleService.getRoleStats(req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching role statistics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch role statistics',
            error: error.message
        });
    }
};

/**
 * Bulk assign permissions to role
 */
export const bulkAssignPermissions = async (req, res) => {
    try {
        const result = await roleService.bulkAssignPermissions(req.params.roleId, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error bulk assigning permissions:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to assign permissions',
            error: error.message
        });
    }
};

/**
 * Bulk remove permissions from role
 */
export const bulkRemovePermissions = async (req, res) => {
    try {
        const result = await roleService.bulkRemovePermissions(req.params.roleId, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error bulk removing permissions:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to remove permissions',
            error: error.message
        });
    }
};

/**
 * Legacy endpoints compatibility
 */

// Assign role to user (redirect to user management)
export const assignRoleToUser = async (req, res) => {
    res.status(301).json({
        success: false,
        message: 'This endpoint has been moved to /api/v1/users/{userId}/roles',
        redirect: `/api/v1/users/${req.params.userId}/roles`
    });
};

// Get user roles (redirect to user management)
export const getUserActiveRoles = async (req, res) => {
    res.status(301).json({
        success: false,
        message: 'This endpoint has been moved to /api/v1/users/{userId}/roles',
        redirect: `/api/v1/users/${req.params.userId}/roles`
    });
};

export default {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getRolePermissions,
    updateRolePermissions,
    assignPermissionToRole,
    removePermissionFromRole,
    bulkAssignPermissions,
    bulkRemovePermissions,
    getRoleStats,
    assignRoleToUser,
    getUserActiveRoles
};