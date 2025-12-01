/**
 * Users Feature Service
 * Business logic for user management operations
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PAGINATION, USER_STATUS } from '../../shared/constants/index.js';

const prisma = new PrismaClient();

class UserService {
    /**
     * Get all users with filtering and pagination
     */
    async getAllUsers(filters = {}, pagination = {}, requestingUser) {
        try {
            const { 
                page = PAGINATION.DEFAULT_PAGE, 
                limit = PAGINATION.DEFAULT_LIMIT 
            } = pagination;
            
            const {
                organization_id,
                department_id,
                is_active,
                role_id,
                search,
                created_from,
                created_to,
                sort_by = 'created_at',
                sort_order = 'desc'
            } = filters;

            const offset = (page - 1) * limit;
            
            // Build where clause
            const where = {};
            
            // Organization filter (important for security)
            if (!this.isSuperAdmin(requestingUser)) {
                where.organization_id = requestingUser.organization_id;
            } else if (organization_id) {
                where.organization_id = organization_id;
            }
            
            if (department_id) where.department_id = department_id;
            if (is_active !== undefined) where.is_active = is_active;
            
            // Search filter
            if (search) {
                where.OR = [
                    { username: { contains: search, mode: 'insensitive' } },
                    { full_name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Date range filter
            if (created_from || created_to) {
                where.created_at = {};
                if (created_from) where.created_at.gte = new Date(created_from);
                if (created_to) where.created_at.lte = new Date(created_to);
            }

            const [users, total] = await Promise.all([
                prisma.users.findMany({
                    where,
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        email: true,
                        phone: true,
                        is_active: true,
                        created_at: true,
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
                        },
                        user_roles: {
                            select: {
                                roles: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        color: true,
                                        icon: true
                                    }
                                }
                            }
                        }
                    },
                    skip: offset,
                    take: parseInt(limit),
                    orderBy: { [sort_by]: sort_order }
                }),
                prisma.users.count({ where })
            ]);

            return {
                success: true,
                data: users.map(user => ({
                    ...user,
                    roles: user.user_roles.map(ur => ur.roles)
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('UserService - getAllUsers error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId, requestingUser) {
        try {
            // Security check - can only view users from same organization (unless super admin)
            const where = { id: userId };
            if (!this.isSuperAdmin(requestingUser)) {
                where.organization_id = requestingUser.organization_id;
            }

            const user = await prisma.users.findFirst({
                where,
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                    organizations: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            type: true
                        }
                    },
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            description: true
                        }
                    },
                    user_roles: {
                        include: {
                            roles: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true,
                                    color: true,
                                    icon: true
                                }
                            }
                        }
                    }
                }
            });

            if (!user) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            return {
                success: true,
                data: {
                    ...user,
                    roles: user.user_roles.map(ur => ur.roles)
                }
            };
        } catch (error) {
            console.error('UserService - getUserById error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        try {
            const {
                username,
                password,
                full_name,
                email,
                phone,
                organization_id,
                department_id,
                role_id
            } = userData;

            // Convert empty strings to null for UUID fields
            const finalOrganizationId = organization_id === "" ? null : organization_id;
            const finalDepartmentId = department_id === "" ? null : department_id;

            // Check if username or email already exists
            const existingUser = await prisma.users.findFirst({
                where: {
                    OR: [
                        { username },
                        { email }
                    ]
                }
            });

            if (existingUser) {
                return {
                    success: false,
                    error: existingUser.username === username 
                        ? 'Username already exists' 
                        : 'Email already exists'
                };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user with transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create user
                const user = await tx.users.create({
                    data: {
                        username,
                        password_hash: hashedPassword,
                        full_name,
                        email,
                        phone,
                        organization_id: finalOrganizationId,
                        department_id: finalDepartmentId,
                        is_active: true
                    }
                });

                // Assign role if provided
                if (role_id) {
                    await tx.user_roles.create({
                        data: {
                            user_id: user.id,
                            role_id,
                            organization_id: finalOrganizationId,
                            department_id: finalDepartmentId,
                            assigned_at: new Date()
                        }
                    });
                }

                return user;
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('UserService - createUser error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update user
     */
    async updateUser(userId, updateData, updatedBy) {
        try {
            const {
                full_name,
                email,
                phone,
                organization_id,
                department_id,
                is_active
            } = updateData;

            // Check if email is being changed and already exists
            if (email) {
                const existingUser = await prisma.users.findFirst({
                    where: {
                        email,
                        id: { not: userId }
                    }
                });

                if (existingUser) {
                    return {
                        success: false,
                        error: 'Email already exists'
                    };
                }
            }

            const user = await prisma.users.update({
                where: { id: userId },
                data: {
                    ...(full_name && { full_name }),
                    ...(email && { email }),
                    ...(phone && { phone }),
                    ...(organization_id && { organization_id }),
                    ...(department_id && { department_id }),
                    ...(is_active !== undefined && { is_active }),
                    updated_by: updatedBy,
                    updated_at: new Date()
                }
            });

            return {
                success: true,
                data: user
            };
        } catch (error) {
            console.error('UserService - updateUser error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete user (soft delete)
     */
    async deleteUser(userId, deletedBy) {
        try {
            const user = await prisma.users.update({
                where: { id: userId },
                data: {
                    is_active: false,
                    deleted_by: deletedBy,
                    deleted_at: new Date()
                }
            });

            return {
                success: true,
                data: user
            };
        } catch (error) {
            console.error('UserService - deleteUser error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if user is super admin
     */
    isSuperAdmin(user) {
        return user && user.roles && 
               user.roles.some(role => role.name === 'super_admin');
    }
}

export default new UserService();