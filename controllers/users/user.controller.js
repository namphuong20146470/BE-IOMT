import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sessionService from '../../services/SessionService.js';
import permissionService from '../../services/PermissionService.js';
import roleService from '../../services/RoleService.js';
import { 
    isSystemAdmin, 
    isOrganizationAdmin, 
    getEffectiveOrganizationId,
    validateOrganizationAccess 
} from '../../utils/permissionHelpers.js';

const prisma = new PrismaClient();

// Legacy hash function for existing users
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// New bcrypt hash function for new users (recommended)
const hashPasswordBcrypt = async (password) => {
    return await bcrypt.hash(password, 10);
};

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

export const createUser = async (req, res) => {
    try {
        console.log('🔍 CreateUser - Start:', {
            user: req.user?.username,
            body: { ...req.body, password: '[HIDDEN]' }
        });

        const userId = req.user?.id;
        const userOrgId = req.user?.organization_id;
        
        if (!userId) {
            console.log('❌ CreateUser - No userId');
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        console.log('✅ CreateUser - User authenticated:', { userId, userOrgId });

        // ✅ Permission already checked by middleware - no need to check again

        const { 
            organization_id, 
            department_id, 
            username, 
            password, 
            full_name, 
            email, 
            phone,
            role_id // ⭐ Single role ID only
        } = req.body;

        // Validate required fields
        if (!username || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, and full_name are required'
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Check email exists
            const existingEmail = await prisma.$queryRaw`
                SELECT id FROM users WHERE email = ${email}
            `;
            if (existingEmail.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Check username exists in users table
        const existingUser = await prisma.$queryRaw`
            SELECT id FROM users WHERE username = ${username}
        `;
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        const hashedPassword = await hashPasswordBcrypt(password);
        
        // ⭐ START TRANSACTION for atomic user creation + role assignment
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create user using Prisma ORM with direct foreign key fields
            const userData = {
                username: username,
                password_hash: hashedPassword,
                full_name: full_name,
                email: email || null,
                phone: phone || null,
                is_active: true,
                created_at: getVietnamDate(),
                updated_at: getVietnamDate(),
                // ✅ FIXED: Handle organization_id properly for Super Admin  
                organization_id: organization_id || userOrgId || null,
                department_id: department_id || null
            };

            const createdUser = await tx.users.create({
                data: userData,
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
                            name: true
                        }
                    },
                    departments: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // 2. Assign role if provided
            let assignedRole = null;
            let roleError = null;

            if (role_id) {
                try {
                    // Validate role exists and is accessible
                    const role = await tx.roles.findFirst({
                        where: {
                            id: role_id,
                            is_active: true,
                            OR: [
                                { is_system_role: true },
                                { 
                                    organization_id: organization_id || userOrgId 
                                }
                            ]
                        },
                        select: {
                            id: true,
                            name: true,
                            color: true,
                            icon: true,
                            is_system_role: true
                        }
                    });

                    if (!role) {
                        roleError = `Role ${role_id} not found or not available for this organization`;
                    } else {
                        // ✅ FIXED: Handle null organization_id for Super Admin
                        const orgIdForRole = organization_id || userOrgId;
                        
                        console.log('🔍 Role assignment data:', {
                            user_id: createdUser.id,
                            role_id: role_id,
                            organization_id: orgIdForRole,
                            department_id: department_id || null,
                            is_system_role: role.is_system_role
                        });

                        // Use different query based on whether organization_id is null
                        let assignment;
                        if (orgIdForRole) {
                            // Normal role assignment with organization
                            assignment = await tx.$queryRaw`
                                INSERT INTO user_roles (
                                    user_id, role_id, organization_id, department_id,
                                    assigned_by, assigned_at, is_active, valid_from, valid_until, notes
                                ) VALUES (
                                    ${createdUser.id}::uuid,
                                    ${role_id}::uuid,
                                    ${orgIdForRole}::uuid,
                                    ${department_id || null}::uuid,
                                    ${userId}::uuid,
                                    ${getVietnamDate()},
                                    true,
                                    ${getVietnamDate()},
                                    null,
                                    'Auto-assigned during user creation'
                                ) RETURNING id
                            `;
                        } else {
                            // System role assignment without organization (for Super Admin)
                            assignment = await tx.$queryRaw`
                                INSERT INTO user_roles (
                                    user_id, role_id, organization_id, department_id,
                                    assigned_by, assigned_at, is_active, valid_from, valid_until, notes
                                ) VALUES (
                                    ${createdUser.id}::uuid,
                                    ${role_id}::uuid,
                                    null,
                                    null,
                                    ${userId}::uuid,
                                    ${getVietnamDate()},
                                    true,
                                    ${getVietnamDate()},
                                    null,
                                    'Auto-assigned system role during user creation'
                                ) RETURNING id
                            `;
                        }

                        console.log('✅ Role assignment successful:', assignment);

                        assignedRole = {
                            id: role.id,
                            name: role.name,
                            color: role.color,
                            icon: role.icon,
                            assignment_id: assignment[0]?.id
                        };
                    }
                } catch (error) {
                    console.error(`Error assigning role ${role_id}:`, error);
                    roleError = `Failed to assign role ${role_id}: ${error.message}`;
                }
            }

            return { user: createdUser, assignedRole, roleError };
        });

        // Get user with roles for response using Prisma ORM
        const userWithRoles = await prisma.users.findUnique({
            where: { id: result.user.id },
            select: {
                id: true,
                organization_id: true,
                department_id: true,
                username: true,
                full_name: true,
                email: true,
                phone: true,
                is_active: true,
                created_at: true,
                departments: {
                    select: {
                        name: true
                    }
                },
                organizations: {
                    select: {
                        name: true
                    }
                },
                user_roles: {
                    where: {
                        is_active: true
                    },
                    select: {
                        roles: {
                            select: {
                                id: true,
                                name: true,
                                color: true,
                                icon: true,
                                is_system_role: true
                            }
                        }
                    }
                }
            }
        });

        // Format the response data
        const formattedUser = {
            ...userWithRoles,
            department_name: userWithRoles?.departments?.name || null,
            organization_name: userWithRoles?.organizations?.name || null,
            roles: userWithRoles?.user_roles?.map(ur => ur.roles) || []
        };

        // Remove nested objects for cleaner response
        delete formattedUser.departments;
        delete formattedUser.organizations;
        delete formattedUser.user_roles;

        const responseData = {
            success: true,
            data: formattedUser,
            message: `User created successfully${result.assignedRole ? ' with role assigned' : ''}`
        };

        // Include assigned role info if successful
        if (result.assignedRole) {
            responseData.assigned_role = result.assignedRole;
        }

        // Include role error if any (non-breaking)
        if (result.roleError) {
            responseData.role_warning = result.roleError;
            responseData.message += `. Warning: Role assignment failed.`;
        }

        res.status(201).json(responseData);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message || 'Unknown error'
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Hybrid password verification: support both SHA256 (legacy) and bcrypt (new)
        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.organization_id, u.department_id, u.password_hash,
                   o.name as organization_name,
                   d.name as department_name,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', r.id,
                               'name', r.name,
                               'description', r.description,
                               'is_system_role', r.is_system_role,
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
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
            WHERE u.username = ${username}
            AND u.is_active = true
            GROUP BY u.id, u.username, u.full_name, u.email, u.organization_id, u.department_id, 
                     u.password_hash, o.name, d.name
        `;

        if (user.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        let isValidPassword = false;
        const storedHash = user[0].password_hash;

        // Check if password is bcrypt format (starts with $2b$)
        if (storedHash.startsWith('$2b$')) {
            // New bcrypt verification
            isValidPassword = await bcrypt.compare(password, storedHash);
        } else {
            // Legacy SHA256 verification
            const sha256Hash = hashPassword(password);
            isValidPassword = (sha256Hash === storedHash);
            
            // Auto-migrate to bcrypt on successful login
            if (isValidPassword) {
                try {
                    const newBcryptHash = await hashPasswordBcrypt(password);
                    await prisma.$queryRaw`
                        UPDATE users 
                        SET password_hash = ${newBcryptHash},
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ${user[0].id}::uuid
                    `;
                    console.log(`🔄 Auto-migrated password for user: ${user[0].username}`);
                } catch (migrationError) {
                    console.error('Failed to auto-migrate password:', migrationError.message);
                }
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Get device info from request
        const deviceInfo = {
            user_agent: req.get('User-Agent') || 'Unknown',
            platform: req.get('sec-ch-ua-platform') || 'Unknown',
            browser: req.get('sec-ch-ua') || 'Unknown'
        };

        // Get client IP
        const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';

        // Parse roles JSON if it's a string
        let parsedRoles = [];
        try {
            parsedRoles = typeof user[0].roles === 'string' ? JSON.parse(user[0].roles) : user[0].roles || [];
        } catch (error) {
            console.error('Error parsing roles:', error);
            parsedRoles = [];
        }

        // Check for suspicious activity
        const securityCheck = await sessionService.detectSuspiciousActivity(user[0].id, ipAddress);
        
        if (securityCheck.is_suspicious) {
            console.log(`⚠️ Suspicious login detected for user: ${user[0].username}`, securityCheck.analysis);
            // Could implement additional security measures here (email notification, 2FA, etc.)
        }

        // Create session using SessionService with full user data
        const userForToken = {
            id: user[0].id,
            username: user[0].username,
            full_name: user[0].full_name,
            email: user[0].email,
            organization_id: user[0].organization_id,
            department_id: user[0].department_id,
            roles: parsedRoles
        };
        const sessionResult = await sessionService.createSession(user[0].id, deviceInfo, ipAddress, userForToken);

        if (!sessionResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create session'
            });
        }

        // Remove password_hash from response 
        const { password_hash, roles, ...userWithoutPassword } = user[0];

        res.status(200).json({
            success: true,
            data: {
                access_token: sessionResult.data.access_token,
                refresh_token: sessionResult.data.refresh_token,
                expires_in: sessionResult.data.expires_in,
                token_type: sessionResult.data.token_type,
                user: {
                    ...userWithoutPassword,
                    roles: parsedRoles
                },
                session_id: sessionResult.data.session_id
            },
            message: 'Login successful',
            security_info: securityCheck.is_suspicious ? {
                new_ip: securityCheck.new_ip,
                risk_level: securityCheck.analysis.risk_level,
                recommendations: securityCheck.analysis.recommendations
            } : null
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message || 'Unknown error'
        });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userOrgId = req.user?.organization_id;
        const isSuperAdmin = isSystemAdmin(req.user);
        
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        // ✅ Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'user.read');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false,
                error: 'Insufficient permissions' 
            });
        }

        // ✅ Parse pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const offset = (page - 1) * limit;

        // ✅ Parse filter parameters
        const {
            organization_id: queryOrgId,
            department_id,
            is_active,
            has_roles,
            search,
            sort_by = 'created_at',
            sort_order = 'desc',
            created_from,
            created_to,
            role_id,
            include_roles = 'true',
            include_system_users = 'false' // ⭐ NEW: Control system user visibility
        } = req.query;

        // ✅ Determine organization scope
        let organization_id;
        if (queryOrgId) {
            if (isSuperAdmin || queryOrgId === userOrgId) {
                organization_id = queryOrgId;
            } else {
                return res.status(403).json({ 
                    success: false,
                    error: 'Access denied: Cannot access users from different organization' 
                });
            }
        } else {
            if (isSuperAdmin) {
                organization_id = null; // No filter for Super Admin
            } else {
                organization_id = userOrgId;
            }
        }

        // ✅ Build WHERE conditions
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Organization filter
        if (organization_id) {
            whereConditions.push(`u.organization_id = $${paramIndex}::uuid`);
            params.push(organization_id);
            paramIndex++;
        }

        // Department filter
        if (department_id) {
            whereConditions.push(`u.department_id = $${paramIndex}::uuid`);
            params.push(department_id);
            paramIndex++;
        }

        // Active status filter
        if (is_active !== undefined) {
            whereConditions.push(`u.is_active = $${paramIndex}::boolean`);
            params.push(is_active === 'true');
            paramIndex++;
        }

        // Search filter
        if (search) {
            whereConditions.push(`(
                u.username ILIKE $${paramIndex} OR 
                u.full_name ILIKE $${paramIndex} OR 
                u.email ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Date range filter
        if (created_from) {
            whereConditions.push(`u.created_at >= $${paramIndex}::timestamp`);
            params.push(new Date(created_from));
            paramIndex++;
        }

        if (created_to) {
            whereConditions.push(`u.created_at <= $${paramIndex}::timestamp`);
            params.push(new Date(created_to));
            paramIndex++;
        }

        // Role filter
        if (role_id) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM user_roles ur 
                WHERE ur.user_id = u.id 
                AND ur.role_id = $${paramIndex}::uuid 
                AND ur.is_active = true
            )`);
            params.push(role_id);
            paramIndex++;
        }

        // Has roles filter
        if (has_roles !== undefined) {
            if (has_roles === 'true') {
                whereConditions.push(`EXISTS (
                    SELECT 1 FROM user_roles ur 
                    WHERE ur.user_id = u.id AND ur.is_active = true
                )`);
            } else {
                whereConditions.push(`NOT EXISTS (
                    SELECT 1 FROM user_roles ur 
                    WHERE ur.user_id = u.id AND ur.is_active = true
                )`);
            }
        }

        // ⭐ FIXED: System user visibility control
// Logic:
// - Super Admin: See system users by default (unless include_system_users=false)
// - Regular users: Never see system users (even if include_system_users=true)
const shouldExcludeSystemUsers = (include_system_users === 'false') || 
                                  (!isSuperAdmin && include_system_users !== 'true');

if (shouldExcludeSystemUsers) {
    whereConditions.push(`NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id 
          AND r.is_system_role = true
          AND ur.is_active = true
    )`);
}

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // ✅ Validate sort fields
        const allowedSortFields = ['created_at', 'updated_at', 'username', 'full_name', 'email'];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
        const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // ✅ Count total records
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            ${whereClause}
        `;

        const countResult = await prisma.$queryRawUnsafe(countQuery, ...params);
        const total = parseInt(countResult[0].total);

        // ✅ Fetch users with pagination
        const baseQuery = `
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                   u.organization_id, u.department_id,
                   o.name as organization_name,
                   d.name as department_name,
                   u.created_at, u.updated_at
                   ${include_roles === 'true' ? `,
                   COALESCE(
                       JSON_AGG(
                           CASE WHEN r.id IS NOT NULL THEN
                               JSON_BUILD_OBJECT(
                                   'id', r.id,
                                   'name', r.name,
                                   'description', r.description,
                                   'is_system_role', r.is_system_role,
                                   'assigned_at', ur.assigned_at,
                                   'is_active', ur.is_active,
                                   'valid_until', ur.valid_until
                               )
                           END
                       ) FILTER (WHERE r.id IS NOT NULL), '[]'::json
                   ) as roles` : ''}
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            ${include_roles === 'true' ? `
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true` : ''}
            ${whereClause}
            ${include_roles === 'true' ? 'GROUP BY u.id, o.name, d.name' : ''}
            ORDER BY u.${sortField} ${sortDirection}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(limit, offset);
        const users = await prisma.$queryRawUnsafe(baseQuery, ...params);

        // ✅ Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage,
                hasPreviousPage,
                nextPage: hasNextPage ? page + 1 : null,
                previousPage: hasPreviousPage ? page - 1 : null
            },
            filters: {
                organization_id: organization_id || (isSuperAdmin ? 'ALL_ORGANIZATIONS' : userOrgId),
                department_id,
                is_active,
                has_roles,
                search,
                created_from,
                created_to,
                role_id,
                include_roles: include_roles === 'true',
                include_system_users: include_system_users === 'true' && isSuperAdmin // Only true if Super Admin AND requested
            },
            sorting: {
                sort_by: sortField,
                sort_order: sortDirection.toLowerCase()
            },
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users',
            error: error.message || 'Unknown error'
        });
    }
};
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                   u.organization_id, u.department_id,
                   o.name as organization_name,
                   d.name as department_name,
                   u.created_at, u.updated_at
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ${id}::uuid AND u.is_active = true
        `;

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user[0],
            message: 'User retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user',
            error: error.message || 'Unknown error'
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { organization_id, department_id, full_name, email, phone } = req.body;

        const updatedUser = await prisma.$queryRaw`
            UPDATE users 
            SET organization_id = COALESCE(${organization_id || null}::uuid, organization_id),
                department_id = COALESCE(${department_id || null}::uuid, department_id),
                full_name = COALESCE(${full_name}, full_name),
                email = COALESCE(${email}, email),
                phone = COALESCE(${phone}, phone),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}::uuid AND is_active = true
            RETURNING id, organization_id, department_id, username, full_name, email, phone, updated_at
        `;

        if (updatedUser.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedUser[0],
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message || 'Unknown error'
        });
    }
};

// Logout user
export const logoutUser = async (req, res) => {
    try {
        const user = req.user;
        const sessionInfo = req.sessionInfo;
        
        if (!user || !sessionInfo) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authenticated' 
            });
        }
        
        // Logout using SessionService
        const logoutResult = await sessionService.logout(sessionInfo.session_id);
        
        if (!logoutResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to logout'
            });
        }

        res.json({ 
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({
            success: false, 
            message: 'Internal server error'
        });
    }
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
        
        const refreshResult = await sessionService.refreshAccessToken(refresh_token, ipAddress);
        
        if (!refreshResult.success) {
            return res.status(401).json(refreshResult);
        }

        res.json(refreshResult);
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Logout all sessions for current user
 */
export const logoutAllSessions = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authenticated' 
            });
        }
        
        const logoutResult = await sessionService.logoutAllSessions(user.id);
        
        res.json(logoutResult);
    } catch (error) {
        console.error('Error logging out all sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Get user's active sessions
 */
export const getUserSessions = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authenticated' 
            });
        }
        
        const sessions = await sessionService.getUserActiveSessions(user.id);
        
        res.json({
            success: true,
            data: sessions,
            total: sessions.length
        });
    } catch (error) {
        console.error('Error getting user sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Terminate specific session
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
 * Get session statistics
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

// Delete user placeholder (implement if needed)
export const deleteUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userOrgId = req.user?.organization_id;
        const { id } = req.params;
        
        if (!userId || !userOrgId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'user.delete');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false,
                error: 'Insufficient permissions' 
            });
        }

        // Prevent self-deletion
        if (id === userId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        // Check if user exists and belongs to same organization
        const existingUser = await prisma.$queryRaw`
            SELECT id, username, full_name, is_active
            FROM users 
            WHERE id = ${id}::uuid 
            AND organization_id = ${userOrgId}::uuid
        `;

        if (!existingUser || existingUser.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const targetUser = existingUser[0];

        // Soft delete user (set is_active = false)
        await prisma.$transaction(async (tx) => {
            // Update user status
            await tx.$queryRaw`
                UPDATE users 
                SET is_active = false, 
                    updated_at = ${getVietnamDate()}
                WHERE id = ${id}::uuid
            `;

            // Deactivate user roles
            await tx.$queryRaw`
                UPDATE user_roles 
                SET is_active = false, 
                    updated_at = ${getVietnamDate()}
                WHERE user_id = ${id}::uuid
            `;

            // Terminate all active sessions
            await tx.$queryRaw`
                UPDATE user_sessions 
                SET is_active = false, 
                    terminated_at = ${getVietnamDate()},
                    termination_reason = 'USER_DELETED'
                WHERE user_id = ${id}::uuid 
                AND is_active = true
            `;
        });

        res.json({
            success: true,
            message: `User "${targetUser.username}" has been deleted successfully`,
            deleted_user: {
                id: targetUser.id,
                username: targetUser.username,
                full_name: targetUser.full_name
            }
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete all users except admin
export const deleteAllUsersExceptAdmin = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userOrgId = req.user?.organization_id;
        const { confirmReset } = req.body;
        
        if (!userId || !userOrgId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        // Check permission (requires high-level permission)
        const hasPermission = await permissionService.hasPermission(userId, 'user.delete');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false,
                error: 'Insufficient permissions' 
            });
        }

        // Require confirmation
        if (confirmReset !== 'CONFIRM_DELETE_ALL_DATA') {
            return res.status(400).json({
                success: false,
                error: 'Confirmation required',
                message: 'To delete all users, send confirmReset: "CONFIRM_DELETE_ALL_DATA"',
                warning: 'This action cannot be undone!'
            });
        }

        // Get users to be deleted (exclude current user and system admins)
        const usersToDelete = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.organization_id = ${userOrgId}::uuid
            AND u.is_active = true
            AND u.id != ${userId}::uuid
            AND (r.is_system_role IS NULL OR r.is_system_role = false)
            GROUP BY u.id, u.username, u.full_name
        `;

        if (usersToDelete.length === 0) {
            return res.json({
                success: true,
                message: 'No users to delete',
                deleted_count: 0
            });
        }

        // Soft delete users in transaction
        const deletedCount = await prisma.$transaction(async (tx) => {
            const userIds = usersToDelete.map(u => u.id);

            // Update users status
            await tx.$queryRaw`
                UPDATE users 
                SET is_active = false, 
                    updated_at = ${getVietnamDate()}
                WHERE id = ANY(${userIds}::uuid[])
            `;

            // Deactivate user roles
            await tx.$queryRaw`
                UPDATE user_roles 
                SET is_active = false, 
                    updated_at = ${getVietnamDate()}
                WHERE user_id = ANY(${userIds}::uuid[])
            `;

            // Terminate all active sessions
            await tx.$queryRaw`
                UPDATE user_sessions 
                SET is_active = false, 
                    terminated_at = ${getVietnamDate()},
                    termination_reason = 'MASS_DELETE'
                WHERE user_id = ANY(${userIds}::uuid[])
                AND is_active = true
            `;

            return userIds.length;
        });

        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} users (excluding admins and current user)`,
            deleted_count: deletedCount,
            deleted_users: usersToDelete.map(u => ({
                id: u.id,
                username: u.username,
                full_name: u.full_name
            }))
        });

    } catch (error) {
        console.error('Error deleting all users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete users',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};