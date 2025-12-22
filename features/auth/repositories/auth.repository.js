/**
 * Auth Repository
 * Single source of truth for authentication-related database queries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuthRepository {
    /**
     * Find user for login (without permissions for better performance)
     */
    static async findUserForLogin(identifier) {
        return await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, 
                   u.organization_id, u.department_id,
                   u.password_hash, u.is_active,
                   u.phone, u.created_at,
                   o.name as organization_name,
                   d.name as department_name,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
                               'description', r.description,
                               'color', r.color,
                               'icon', r.icon
                           )
                       ) FILTER (WHERE r.id IS NOT NULL),
                       '[]'::json
                   ) as roles
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE (u.username = ${identifier} OR u.email = ${identifier})
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, 
                     u.organization_id, u.department_id,
                     u.password_hash, u.is_active,
                     u.phone, u.created_at,
                     o.name, d.name
        `;
    }

    /**
     * Find user with full information (roles, permissions, org, dept)
     * Single query for complete user data - used by getMe, etc.
     */
    static async findUserWithFullInfo(identifier) {
        return await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, 
                   u.organization_id, u.department_id,
                   u.password_hash, u.is_active,
                   u.phone, u.created_at,
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
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE (u.username = ${identifier} OR u.email = ${identifier})
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, 
                     u.organization_id, u.department_id,
                     u.password_hash, u.is_active,
                     u.phone, u.created_at,
                     o.name, d.name
        `;
    }

    /**
     * Find user by ID with complete details (for getMe endpoint)
     */
    static async findUserById(userId) {
        return await prisma.users.findUnique({
            where: { 
                id: userId,
                is_active: true
            },
            include: {
                organizations: {
                    select: { 
                        id: true, 
                        name: true, 
                        type: true,
                        address: true,
                        phone: true,
                        email: true,
                        license_number: true,
                        is_active: true
                    }
                },
                departments: {
                    select: { 
                        id: true, 
                        name: true, 
                        description: true,
                        code: true
                    }
                },
                user_roles: {
                    where: { 
                        is_active: true,
                        valid_from: { lte: new Date() },
                        OR: [
                            { valid_until: null },
                            { valid_until: { gte: new Date() } }
                        ]
                    },
                    include: {
                        roles: {
                            include: {
                                role_permissions: {
                                    include: {
                                        permissions: {
                                            select: { name: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Find user by ID (simple query for profile)
     */
    static async findUserProfileById(userId) {
        return await prisma.$queryRaw`
            SELECT u.id, u.username, u.email, u.full_name,
                   u.organization_id, u.department_id,
                   u.phone,
                   u.created_at, u.is_active,
                   o.name as organization_name,
                   d.name as department_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ${userId}::uuid
            AND u.is_active = true
        `;
    }

    /**
     * Update user password
     */
    static async updatePassword(userId, newPasswordHash) {
        return await prisma.$queryRaw`
            UPDATE users
            SET password_hash = ${newPasswordHash}, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId}::uuid
        `;
    }

    /**
     * Update user profile
     */
    static async updateProfile(userId, updateData) {
        return await prisma.users.update({
            where: { id: userId },
            data: {
                ...updateData,
                updated_at: new Date()
            },
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true,
                updated_at: true,
                organizations: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });
    }

    /**
     * Check if email exists for another user
     */
    static async isEmailTaken(email, excludeUserId = null) {
        const where = {
            email,
            is_active: true
        };

        if (excludeUserId) {
            where.id = { not: excludeUserId };
        }

        const user = await prisma.users.findFirst({ where });
        return !!user;
    }

    /**
     * Find user with permissions by ID (for permission check)
     */
    static async findUserWithPermissions(userId) {
        return await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, 
                   u.organization_id, u.department_id,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
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
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE u.id = ${userId}::uuid
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, 
                     u.organization_id, u.department_id
        `;
    }

    /**
     * Get basic user info (for profile lookup)
     */
    static async getBasicUserInfo(userId) {
        return await prisma.users.findUnique({
            where: { 
                id: userId,
                is_active: true
            },
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true,
                organization_id: true,
                department_id: true,
                is_active: true
            }
        });
    }
}

export default AuthRepository;
