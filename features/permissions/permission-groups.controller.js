/**
 * Permission Groups Controller
 * Handles HTTP requests for permission group management
 */

import permissionGroupService from './permission-groups.service.js';

/**
 * Get all permission groups
 */
export const getAllPermissionGroups = async (req, res) => {
    try {
        const result = await permissionGroupService.getAllPermissionGroups(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permission groups:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permission groups',
            error: error.message
        });
    }
};

/**
 * Get permission group by ID with permissions
 */
export const getPermissionGroupById = async (req, res) => {
    try {
        const includePermissions = req.query.include_permissions !== 'false';
        const result = await permissionGroupService.getPermissionGroupById(
            req.params.id,
            req.user,
            { includePermissions }
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching permission group:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch permission group',
            error: error.message
        });
    }
};

/**
 * Create new permission group
 */
export const createPermissionGroup = async (req, res) => {
    try {
        const result = await permissionGroupService.createPermissionGroup(req.body, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating permission group:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to create permission group',
            error: error.message
        });
    }
};

/**
 * Update permission group
 */
export const updatePermissionGroup = async (req, res) => {
    try {
        const result = await permissionGroupService.updatePermissionGroup(
            req.params.id,
            req.body,
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating permission group:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to update permission group',
            error: error.message
        });
    }
};

/**
 * Delete permission group
 */
export const deletePermissionGroup = async (req, res) => {
    try {
        const result = await permissionGroupService.deletePermissionGroup(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting permission group:', error);
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to delete permission group',
            error: error.message
        });
    }
};

/**
 * Get group statistics
 */
export const getGroupStatistics = async (req, res) => {
    try {
        const result = await permissionGroupService.getGroupStatistics(req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching group statistics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch group statistics',
            error: error.message
        });
    }
};

export default {
    getAllPermissionGroups,
    getPermissionGroupById,
    createPermissionGroup,
    updatePermissionGroup,
    deletePermissionGroup,
    getGroupStatistics
};
