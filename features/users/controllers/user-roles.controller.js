/**
 * 🔐 User Role Management Controller
 * Handles role assignment and role-related operations
 */

import roleService from '../../../shared/services/RoleService.js';
import auditService from '../../../shared/services/AuditService.js';
import { HTTP_STATUS, MESSAGES } from '../../../shared/constants/index.js';

/**
 * Get user roles
 * @route GET /users/:userId/roles
 */
export const getUserRoles = async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await roleService.getUserRoles(userId);

        if (!result.success) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: 'User roles retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user roles:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Assign roles to user
 * @route POST /users/:userId/roles
 */
export const assignRolesToUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role_ids, notes } = req.body;
        const assignedBy = req.user.id;

        const result = await roleService.assignRolesToUser(userId, role_ids, assignedBy, notes);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            assignedBy,
            'role.assign',
            'user_role',
            userId,
            { role_ids, notes }
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.data,
            message: 'Roles assigned successfully'
        });

    } catch (error) {
        console.error('Error assigning roles to user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Remove role from user
 * @route DELETE /users/:userId/roles/:roleId
 */
export const removeRoleFromUser = async (req, res) => {
    try {
        const { userId, roleId } = req.params;
        const { reason } = req.body;
        const removedBy = req.user.id;

        const result = await roleService.removeRoleFromUser(userId, roleId, removedBy, reason);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            removedBy,
            'role.remove',
            'user_role',
            userId,
            { role_id: roleId, reason }
        );

        res.json({
            success: true,
            message: 'Role removed successfully'
        });

    } catch (error) {
        console.error('Error removing role from user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

// Backward compatibility aliases for legacy code
export { assignRolesToUser as assignRoleToUser };