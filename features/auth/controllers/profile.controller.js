/**
 * 👤 User Profile Management Controller
 * Handles profile viewing and updates
 */

import auditService from '../../../shared/services/AuditService.js';
import { extractClientInfo, sanitizeUserData } from '../helpers/auth.helper.js';
import { sendProfileSuccess, sendSuccess, sendError, sendInternalError, sendValidationError } from '../helpers/response.helper.js';
import { AUTH_ERROR_CODES, AUTH_MESSAGES, AUTH_AUDIT_EVENTS } from '../constants/auth.constants.js';
import prisma from '../../../config/db.js';

/**
 * 👤 GET PROFILE - Get current user profile with roles and permissions
 * @route GET /auth/profile
 */
export const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        console.log('👤 Getting profile for user:', userId);

        // Get user with complete role and permission information
        const users = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.phone,
                   u.organization_id, u.department_id, u.is_active,
                   u.created_at, u.updated_at,
                   o.name as organization_name,
                   d.name as department_name,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
                               'description', r.description,
                               'color', r.color,
                               'icon', r.icon,
                               'permissions', COALESCE(
                                   (
                                       SELECT JSON_AGG(p.name)
                                       FROM role_permissions rp
                                       JOIN permissions p ON rp.permission_id = p.id
                                       WHERE rp.role_id = r.id
                                   ),
                                   '[]'::json
                               )
                           )
                       ) FILTER (WHERE r.id IS NOT NULL),
                       '[]'::json
                   ) as roles
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = ${userId} AND u.is_active = true
            GROUP BY u.id, o.name, d.name
        `;

        const user = users[0];

        if (!user) {
            return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        }

        return sendProfileSuccess(res, user);

    } catch (error) {
        console.error('❌ Get profile error:', error);
        return sendInternalError(res);
    }
};

/**
 * 👤 GET ME - Enhanced profile endpoint for app initialization  
 * @route GET /auth/me
 */
export const getMe = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        // Get user with sessions information
        const users = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.phone,
                   u.organization_id, u.department_id, u.is_active,
                   u.created_at, u.updated_at,
                   o.name as organization_name,
                   d.name as department_name,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
                               'description', r.description,
                               'color', r.color,
                               'icon', r.icon,
                               'permissions', COALESCE(
                                   (
                                       SELECT JSON_AGG(p.name)
                                       FROM role_permissions rp
                                       JOIN permissions p ON rp.permission_id = p.id
                                       WHERE rp.role_id = r.id
                                   ),
                                   '[]'::json
                               )
                           )
                       ) FILTER (WHERE r.id IS NOT NULL),
                       '[]'::json
                   ) as roles,
                   (
                       SELECT COUNT(*)::int
                       FROM user_sessions us
                       WHERE us.user_id = u.id 
                       AND us.is_active = true 
                       AND us.expires_at > NOW()
                   ) as active_sessions
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = ${userId} AND u.is_active = true
            GROUP BY u.id, o.name, d.name
        `;

        const user = users[0];

        if (!user) {
            return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        }

        // Calculate permission summary
        const allPermissions = user.roles.flatMap(role => role.permissions || []);
        const uniquePermissions = [...new Set(allPermissions)];

        return sendSuccess(res, {
            user: sanitizeUserData(user),
            permissions: uniquePermissions,
            permissions_count: uniquePermissions.length,
            active_sessions: user.active_sessions || 0,
            last_login_at: user.last_login_at
        }, 'Profile retrieved successfully');

    } catch (error) {
        console.error('❌ Get me error:', error);
        return sendInternalError(res);
    }
};

/**
 * ✏️ UPDATE PROFILE - Update user profile information
 * @route PATCH /auth/profile
 */
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { full_name, email, phone } = req.body;
        const { ipAddress } = extractClientInfo(req);

        if (!userId) {
            return sendError(res, 'Not authenticated', 401, AUTH_ERROR_CODES.TOKEN_INVALID);
        }

        // Build update data (only include provided fields)
        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;

        if (Object.keys(updateData).length === 0) {
            return sendValidationError(res, [{
                field: 'body',
                message: 'At least one field must be provided for update'
            }]);
        }

        updateData.updated_at = new Date();

        console.log('✏️ Updating profile for user:', userId, updateData);

        // Check if email is already taken (if updating email)
        if (email) {
            const existingUser = await prisma.users.findFirst({
                where: {
                    email: email,
                    id: { not: userId },
                    is_active: true
                }
            });

            if (existingUser) {
                return sendValidationError(res, [{
                    field: 'email',
                    message: 'Email address is already in use'
                }]);
            }
        }

        // Update user profile
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true,

                organization_id: true,
                department_id: true,
                is_active: true,
                updated_at: true,
                organizations: {
                    select: {
                        name: true
                    }
                },
                departments: {
                    select: {
                        name: true
                    }
                }
            }
        });

        // Log profile update activity
        try {
            await auditService.logActivity(
                userId,
                AUTH_AUDIT_EVENTS.PROFILE_UPDATE,
                'user',
                userId,
                {
                    updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
                    ip_address: ipAddress
                }
            );
        } catch (err) {
            console.error('❌ Failed to log profile update activity:', err);
        }

        console.log('✅ Profile updated successfully for user:', userId);

        return sendSuccess(res, {
            user: {
                ...updatedUser,
                organization_name: updatedUser.organizations?.name || null,
                department_name: updatedUser.departments?.name || null
            },
            updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
            updated_at: updatedUser.updated_at
        }, AUTH_MESSAGES.PROFILE_UPDATED);

    } catch (error) {
        console.error('❌ Update profile error:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'field';
            return sendValidationError(res, [{
                field: field,
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            }]);
        }

        return sendInternalError(res);
    }
};