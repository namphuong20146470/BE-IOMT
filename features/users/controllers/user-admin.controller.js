/**
 * 🔍 User Search & Statistics Controller  
 * Handles user search, filtering, and statistical operations
 */

import userService from '../user.service.js';
import { HTTP_STATUS, MESSAGES } from '../../../shared/constants/index.js';

/**
 * Search users with advanced filtering
 * @route POST /users/search
 */
export const searchUsers = async (req, res) => {
    try {
        const searchCriteria = req.body;
        const requestingUser = req.user;

        const result = await userService.searchUsers(searchCriteria, requestingUser);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            total: result.total,
            message: 'User search completed successfully'
        });

    } catch (error) {
        console.error('Error searching users:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Get user statistics
 * @route GET /users/statistics
 */
export const getUserStatistics = async (req, res) => {
    try {
        const { organization_id, department_id, date_range } = req.query;
        const requestingUser = req.user;

        const result = await userService.getUserStatistics({
            organization_id,
            department_id,
            date_range
        }, requestingUser);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: 'User statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user statistics:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Export users data
 * @route GET /users/export
 */
export const exportUsers = async (req, res) => {
    try {
        const { format = 'csv', filters = {} } = req.query;
        const requestingUser = req.user;

        const result = await userService.exportUsers(format, filters, requestingUser);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Set appropriate headers for file download
        const filename = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', result.mimeType);

        res.send(result.data);

    } catch (error) {
        console.error('Error exporting users:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Bulk update users
 * @route PATCH /users/bulk-update
 */
export const bulkUpdateUsers = async (req, res) => {
    try {
        const { user_ids, update_data, reason } = req.body;
        const requestingUser = req.user;

        const result = await userService.bulkUpdateUsers(user_ids, update_data, requestingUser.id, reason);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: `Successfully updated ${result.data.updated_count} users`
        });

    } catch (error) {
        console.error('Error bulk updating users:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Delete all users except admin (dangerous operation)
 * @route DELETE /users/all-except-admin
 */
export const deleteAllUsersExceptAdmin = async (req, res) => {
    try {
        const { confirmation, reason } = req.body;
        const requestingUser = req.user;

        // Require explicit confirmation
        if (confirmation !== 'DELETE_ALL_USERS') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Invalid confirmation. Required: "DELETE_ALL_USERS"'
            });
        }

        const result = await userService.deleteAllUsersExceptAdmin(requestingUser.id, reason);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: `Successfully deleted ${result.data.deleted_count} users`
        });

    } catch (error) {
        console.error('Error deleting all users except admin:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};