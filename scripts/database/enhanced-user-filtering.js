// Enhanced getAllUsers with department-level filtering option
// Copy this logic to replace the current getAllUsers function in user.controller.js

export const getAllUsersWithDeptFilter = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userOrgId = req.user?.organization_id;
        const userDeptId = req.user?.department_id;
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
            department_id: queryDeptId,
            is_active,
            has_roles,
            search,
            sort_by = 'created_at',
            sort_order = 'desc',
            created_from,
            created_to,
            role_id,
            include_roles = 'true',
            include_system_users = 'false',
            scope = 'organization' // 🆕 NEW: 'organization' or 'department'
        } = req.query;

        // 🆕 ENHANCED: Determine filtering scope based on user role and request
        let organization_id, department_id;
        
        if (isSuperAdmin) {
            // Super Admin: Can see everything or filter by requested org/dept
            organization_id = queryOrgId || null;
            department_id = queryDeptId || null;
        } else {
            // Regular user: Apply scope-based filtering
            if (scope === 'department') {
                // Department-level access: Only same department
                organization_id = userOrgId;
                department_id = queryDeptId === userDeptId ? queryDeptId : userDeptId;
                
                if (queryDeptId && queryDeptId !== userDeptId) {
                    return res.status(403).json({ 
                        success: false,
                        error: 'Access denied: Cannot access users from different department' 
                    });
                }
            } else {
                // Organization-level access: Same organization, any department
                if (queryOrgId) {
                    if (queryOrgId === userOrgId) {
                        organization_id = queryOrgId;
                        department_id = queryDeptId; // Allow specific department if requested
                    } else {
                        return res.status(403).json({ 
                            success: false,
                            error: 'Access denied: Cannot access users from different organization' 
                        });
                    }
                } else {
                    organization_id = userOrgId;
                    department_id = queryDeptId; // Allow department filtering within org
                }
            }
        }

        console.log('🔍 Access Control Applied:', {
            isSuperAdmin,
            scope,
            organization_id,
            department_id,
            userOrgId,
            userDeptId
        });

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

        // System user visibility control
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
                total_pages: totalPages,
                has_next_page: hasNextPage,
                has_previous_page: hasPreviousPage
            },
            filters_applied: {
                scope,
                organization_id,
                department_id,
                is_super_admin: isSuperAdmin,
                include_system_users: include_system_users === 'true'
            }
        });

    } catch (error) {
        console.error('❌ Error in getAllUsers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};