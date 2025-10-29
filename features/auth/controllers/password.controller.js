/**
 * 🔑 Password Management Controller
 * Handles password change and reset operations
 */

import auditService from '../../../shared/services/AuditService.js';
import { extractClientInfo, validatePassword } from '../helpers/auth.helper.js';
import { sendSuccess, sendError, sendInternalError, sendValidationError } from '../helpers/response.helper.js';
import { AUTH_ERROR_CODES, AUTH_MESSAGES, AUTH_AUDIT_EVENTS } from '../constants/auth.constants.js';
import prisma from '../../../config/db.js';
import bcrypt from 'bcryptjs';

/**
 * 🔑 CHANGE PASSWORD - Change user's current password
 * @route POST /auth/change-password
 */
export const changePassword = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { current_password, new_password } = req.body;
        const { ipAddress } = extractClientInfo(req);

        if (!userId) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        console.log('🔑 Password change request for user:', userId);

        // Get current user with password hash
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                password_hash: true,
                is_active: true
            }
        });

        if (!user) {
            return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        }

        if (!user.is_active) {
            return sendError(res, 'Account is inactive', 403, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
        }

        // Verify current password
        const validCurrentPassword = await bcrypt.compare(current_password, user.password_hash);
        if (!validCurrentPassword) {
            await auditService.logActivity(userId, 'PASSWORD_CHANGE_FAILED', 'auth', null, {
                reason: 'Invalid current password',
                ip_address: ipAddress
            });

            return sendError(res, 'Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
        }

        // Validate new password
        const passwordValidation = validatePassword(new_password);
        if (!passwordValidation.valid) {
            return sendValidationError(res, passwordValidation.errors.map(error => ({
                field: 'new_password',
                message: error
            })));
        }

        // Check if new password is different from current
        const samePassword = await bcrypt.compare(new_password, user.password_hash);
        if (samePassword) {
            return sendValidationError(res, [{
                field: 'new_password',
                message: 'New password must be different from current password'
            }]);
        }

        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

        // Update password in database
        await prisma.users.update({
            where: { id: userId },
            data: {
                password_hash: newPasswordHash,
                password_changed_at: new Date(),
                updated_at: new Date()
            }
        });

        // Log successful password change
        await auditService.logActivity(userId, AUTH_AUDIT_EVENTS.PASSWORD_CHANGE, 'auth', null, {
            ip_address: ipAddress,
            success: true
        });

        // Optionally: Invalidate all other sessions except current one
        // This forces user to re-login on other devices
        try {
            await prisma.user_sessions.updateMany({
                where: {
                    user_id: userId,
                    is_active: true,
                    id: { not: req.sessionId } // Keep current session active
                },
                data: {
                    is_active: false,
                    updated_at: new Date()
                }
            });
        } catch (sessionError) {
            console.warn('⚠️ Failed to invalidate other sessions:', sessionError);
        }

        console.log('✅ Password changed successfully for user:', user.username);

        return sendSuccess(res, {
            user_id: userId,
            changed_at: new Date().toISOString(),
            other_sessions_invalidated: true
        }, AUTH_MESSAGES.PASSWORD_CHANGED);

    } catch (error) {
        console.error('❌ Change password error:', error);
        
        // Log failed password change attempt
        if (req.user?.id) {
            try {
                await auditService.logActivity(req.user.id, 'PASSWORD_CHANGE_FAILED', 'auth', null, {
                    reason: 'Internal server error',
                    error: error.message,
                    ip_address: extractClientInfo(req).ipAddress
                });
            } catch (logError) {
                console.error('❌ Failed to log password change error:', logError);
            }
        }

        return sendInternalError(res);
    }
};

/**
 * 🔄 RESET PASSWORD REQUEST - Request password reset (future implementation)
 * @route POST /auth/reset-password-request
 */
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const { ipAddress } = extractClientInfo(req);

        if (!email) {
            return sendValidationError(res, [{
                field: 'email',
                message: 'Email is required'
            }]);
        }

        console.log('🔄 Password reset request for email:', email);

        // Find user by email
        const user = await prisma.users.findFirst({
            where: {
                email: email.toLowerCase().trim(),
                is_active: true
            },
            select: {
                id: true,
                username: true,
                email: true,
                is_active: true
            }
        });

        // Always return success to prevent email enumeration attacks
        const response = {
            message: 'If an account with that email exists, a password reset link has been sent',
            email: email
        };

        if (!user) {
            // Log failed attempt but still return success
            await auditService.logActivity(null, 'PASSWORD_RESET_REQUEST_FAILED', 'auth', null, {
                email,
                reason: 'Email not found',
                ip_address: ipAddress
            });

            return sendSuccess(res, response, response.message);
        }

        if (!user.is_active) {
            // Log failed attempt but still return success
            await auditService.logActivity(user.id, 'PASSWORD_RESET_REQUEST_FAILED', 'auth', null, {
                email,
                reason: 'Account inactive',
                ip_address: ipAddress
            });

            return sendSuccess(res, response, response.message);
        }

        // TODO: Implement actual password reset token generation and email sending
        // For now, just log the request
        await auditService.logActivity(user.id, 'PASSWORD_RESET_REQUEST', 'auth', null, {
            email,
            ip_address: ipAddress
        });

        console.log('📧 Password reset email would be sent to:', email);

        return sendSuccess(res, response, response.message);

    } catch (error) {
        console.error('❌ Password reset request error:', error);
        return sendInternalError(res);
    }
};

/**
 * ✅ RESET PASSWORD - Complete password reset with token (future implementation)
 * @route POST /auth/reset-password
 */
export const resetPassword = async (req, res) => {
    try {
        const { token, new_password } = req.body;
        const { ipAddress } = extractClientInfo(req);

        // Validate inputs
        if (!token) {
            return sendValidationError(res, [{
                field: 'token',
                message: 'Reset token is required'
            }]);
        }

        // Validate new password
        const passwordValidation = validatePassword(new_password);
        if (!passwordValidation.valid) {
            return sendValidationError(res, passwordValidation.errors.map(error => ({
                field: 'new_password',
                message: error
            })));
        }

        // TODO: Implement token validation and password reset
        // This would involve:
        // 1. Validate reset token
        // 2. Check token expiry
        // 3. Find associated user
        // 4. Update password
        // 5. Invalidate token
        // 6. Log activity

        return sendError(res, 'Password reset functionality not yet implemented', 501, 'NOT_IMPLEMENTED');

    } catch (error) {
        console.error('❌ Reset password error:', error);
        return sendInternalError(res);
    }
};