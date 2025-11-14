/**
 * 👤 User Profile Management Controller
 * Handles profile viewing and user status operations
 */

import userService from '../user.service.js';
import sessionService from '../../../shared/services/SessionService.js';
import auditService from '../../../shared/services/AuditService.js';
import { HTTP_STATUS, MESSAGES } from '../../../shared/constants/index.js';

/**
 * Get user profile (safe for viewing by others)
 * @route GET /users/:userId/profile
 */
export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUser = req.user;

        // Self-viewing doesn't need permission
        const isSelf = userId === requestingUser.id;
        
        const result = await userService.getUserProfile(userId, requestingUser, isSelf);

        if (!result.success) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            viewing_self: isSelf,
            message: 'User profile retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Get user active sessions
 * @route GET /users/:userId/sessions
 */
export const getUserSessions = async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUser = req.user;

        // Can only view own sessions or require admin permission
        if (userId !== requestingUser.id) {
            // Check admin permission here
            // const hasPermission = await permissionService.hasPermission(requestingUser.id, 'user.manage');
            // if (!hasPermission) {
            //     return res.status(HTTP_STATUS.FORBIDDEN).json({
            //         success: false,
            //         message: 'Access denied: Cannot view other user sessions'
            //     });
            // }
        }

        const result = await sessionService.getUserSessions(userId);

        if (!result.success) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: result.data,
            message: 'User sessions retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting user sessions:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Deactivate user
 * @route PATCH /users/:userId/deactivate
 */
export const deactivateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        const requestingUser = req.user;

        // Cannot deactivate self
        if (userId === requestingUser.id) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        const result = await userService.deactivateUser(userId, requestingUser.id, reason);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Terminate all user sessions
        await sessionService.terminateAllUserSessions(userId, 'USER_DEACTIVATED');

        // Log audit
        await auditService.logActivity(
            requestingUser.id,
            'user.deactivate',
            'user',
            userId,
            { reason }
        );

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Activate user
 * @route PATCH /users/:userId/activate
 */
export const activateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        const requestingUser = req.user;

        const result = await userService.activateUser(userId, requestingUser.id, reason);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Log audit
        await auditService.logActivity(
            requestingUser.id,
            'user.activate',
            'user',
            userId,
            { reason }
        );

        res.json({
            success: true,
            message: 'User activated successfully'
        });

    } catch (error) {
        console.error('Error activating user:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * Reset user password (admin function)
 * @route PATCH /users/:userId/reset-password
 */
export const resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { new_password } = req.body;
        const requestingUser = req.user;

        const result = await userService.resetUserPassword(userId, new_password, requestingUser.id);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: result.error
            });
        }

        // Terminate all user sessions to force re-login
        await sessionService.terminateAllUserSessions(userId, 'PASSWORD_RESET');

        // Log audit
        await auditService.logActivity(
            requestingUser.id,
            'user.password_reset',
            'user',
            userId,
            { admin_reset: true }
        );

        res.json({
            success: true,
            message: 'User password reset successfully'
        });

    } catch (error) {
        console.error('Error resetting user password:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ERROR.INTERNAL
        });
    }
};

/**
 * 🔐 TERMINATE SESSION - End a specific session
 * @route DELETE /users/sessions/:sessionId
 */
export const terminateSession = async (req, res) => {
    try {
        const user = req.user;
        const { sessionId } = req.params;
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authenticated' 
            });
        }
        
        const terminateResult = await sessionService.terminateSession(sessionId, user.id);
        
        res.json(terminateResult);
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * 📊 SESSION STATISTICS - Get user session analytics
 * @route GET /users/sessions/statistics
 */
export const getSessionStatistics = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authenticated' 
            });
        }
        
        const stats = await sessionService.getSessionStatistics(user.id);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting session statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};