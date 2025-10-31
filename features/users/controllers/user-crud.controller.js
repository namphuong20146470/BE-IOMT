/**
 * 👥 User Basic Operations Controller
 * Handles CRUD operations for users
 */

import userService from '../user.service.js';
import auditService from '../../../shared/services/AuditService.js';
import permissionService from '../../../shared/services/PermissionService.backup.js';
import { HTTP_STATUS, MESSAGES } from '../../../shared/constants/index.js';

/**
 * Get all users with filtering and pagination
 * @route GET /users
 */
export const getAllUsers = async (req, res) => {
    try {
        const filters = req.query; 
        const pagination = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        };

        const result = await userService.getAllUsers(filters, pagination, req.user);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination,
            message: MESSAGES.SUCCESS.RETRIEVED
        });

    } catch (error) {
        console.error('Error getting all users:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Get user by ID
 * @route GET /users/:userId
 */
export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await userService.getUserById(userId, req.user);

        if (!result.success) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: MESSAGES.SUCCESS.RETRIEVED
        });

    } catch (error) {
        console.error('Error getting user by ID:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Create new user
 * @route POST /users
 */
export const createUser = async (req, res) => {
    try {
        const userData = req.body;
        const createdBy = req.user.id;

        const result = await userService.createUser(userData, createdBy);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            createdBy,
            'user.create',
            'user',
            result.data.id,
            { user_data: userData }
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.data,
            message: MESSAGES.SUCCESS.CREATED
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Update user
 * @route PUT /users/:userId
 */
export const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;
        const updatedBy = req.user.id;

        const result = await userService.updateUser(userId, updateData, updatedBy);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            updatedBy,
            'user.update',
            'user',
            userId,
            { updates: updateData }
        );

        res.json({
            success: true,
            data: result.data,
            message: MESSAGES.SUCCESS.UPDATED
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Delete user (soft delete)
 * @route DELETE /users/:userId
 */
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const deletedBy = req.user.id;

        // Cannot delete self
        if (userId === deletedBy) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const result = await userService.deleteUser(userId, deletedBy);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            deletedBy,
            'user.delete',
            'user',
            userId,
            { reason: req.body.reason || 'Admin deletion' }
        );

        res.json({
            success: true,
            message: MESSAGES.SUCCESS.DELETED
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};