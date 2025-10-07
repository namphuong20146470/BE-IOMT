import roleService from '../../services/RoleService.js';
import permissionService from '../../services/PermissionService.js';

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Lấy toàn bộ role (GET /roles)
// ✅ SỬA Backend: roleController.js
export const getAllRoles = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'role.read');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const {
            organization_id: queryOrgId,
            include_system = 'true',
            include_permissions = 'false',
            search,
            is_active = 'true'
        } = req.query;

        const userOrgId = req.user?.organization_id;
        const isSuperAdmin = req.user?.is_super_admin || req.user?.roles?.some(r => r.is_system_role);
        
        let organization_id;
        
        // ✅ FIXED: Super Admin có thể query không cần organization_id
        if (isSuperAdmin && !queryOrgId && !userOrgId) {
            // Super Admin without organization - get all roles including system roles
            organization_id = null; // Signal to get all roles
        } else if (queryOrgId) {
            if (isSuperAdmin || queryOrgId === userOrgId) {
                organization_id = queryOrgId;
            } else {
                return res.status(403).json({ 
                    error: 'Access denied: Cannot access roles from different organization' 
                });
            }
        } else {
            organization_id = userOrgId;
        }

        // ✅ FIXED: Chỉ require organization_id nếu không phải Super Admin
        if (organization_id === undefined && !isSuperAdmin) {
            return res.status(400).json({ 
                error: 'Organization ID is required. Please provide organization_id or ensure user has organization.' 
            });
        }

        const options = {
            includeSystemRoles: include_system === 'true',
            includePermissions: include_permissions === 'true',
            isActive: is_active === 'true',
            search: search || null
        };

        // ✅ FIXED: Xử lý cả 2 trường hợp
        let roles;
        if (organization_id === null && isSuperAdmin) {
            // Get all roles (system + all organizations)
            roles = await roleService.getAllRoles(options);
        } else {
            roles = await roleService.getRolesByOrganization(organization_id, options);
        }

        return res.json({
            success: true,
            data: roles,
            total: roles.length
        });
    } catch (err) {
        console.error('Error getting roles:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Tạo role mới (POST /roles)
export const createRole = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.create');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { name, description, organization_id, color, icon, sort_order, metadata } = req.body;

        // Validate required fields
        if (!name || !organization_id) {
            return res.status(400).json({ 
                error: 'Role name and organization ID are required' 
            });
        }

        const roleData = {
            name,
            description: description || '',
            organization_id,
            color: color || '#6B7280',
            icon: icon || 'user',
            sort_order: sort_order || 0,
            metadata: metadata || {},
            is_custom: true
        };

        const result = await roleService.createRole(roleData, userId);

        if (!result.success) {
            return res.status(400).json({ 
                success: false,
                error: result.error 
            });
        }

        return res.status(201).json({
            success: true,
            data: result.data,
            message: 'Role created successfully'
        });
    } catch (err) {
        console.error('Error creating role:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Sửa role (PUT /roles/:id)
export const updateRole = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.update');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { id } = req.params;
        const { name, description, color, icon, sort_order, metadata } = req.body;

        // Get existing role first
        const existingRole = await roleService.getRoleById(id);
        if (!existingRole) {
            return res.status(404).json({ 
                success: false,
                error: 'Role not found' 
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;
        if (sort_order !== undefined) updateData.sort_order = sort_order;
        if (metadata !== undefined) updateData.metadata = metadata;

        const result = await roleService.updateRole(id, updateData, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        return res.json({
            success: true,
            data: result.data,
            message: 'Role updated successfully'
        });
    } catch (err) {
        console.error('Error updating role:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Xóa role (DELETE /roles/:id)
export const deleteRole = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.delete');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { id } = req.params;

        const result = await roleService.deleteRole(id, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        return res.json({
            success: true,
            message: result.message || 'Role deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting role:', err);
        return res.status(500).json({ error: err.message });
    }
};

// ==========================================
// ADDITIONAL ENDPOINTS FOR ENHANCED FUNCTIONALITY
// ==========================================

// Lấy role theo ID (GET /roles/:id)
export const getRoleById = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.read');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { id } = req.params;
        const { include_permissions = 'false' } = req.query;

        const role = await roleService.getRoleById(id, include_permissions === 'true');

        if (!role) {
            return res.status(404).json({ 
                success: false,
                error: 'Role not found' 
            });
        }

        // Transform to legacy format
        const legacyFormattedRole = {
            id: role.id,
            name: role.name,
            description: role.description,
            color: role.color,
            icon: role.icon,
            is_system_role: role.is_system_role,
            is_custom: role.is_custom,
            user_count: role.user_count,
            created_at: role.created_at,
            updated_at: role.updated_at,
            organization: role.organizations?.name,
            ...(include_permissions === 'true' && { permissions: role.permissions })
        };

        return res.json({
            success: true,
            data: legacyFormattedRole
        });
    } catch (err) {
        console.error('Error getting role by ID:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Gán role cho user (POST /roles/assign)
export const assignRoleToUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.assign');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { user_id, role_id, organization_id, department_id, valid_from, valid_until, notes } = req.body;

        if (!user_id || !role_id || !organization_id) {
            return res.status(400).json({ 
                error: 'User ID, Role ID, and Organization ID are required' 
            });
        }

        const assignmentData = {
            user_id,
            role_id,
            organization_id,
            department_id,
            valid_from: valid_from ? new Date(valid_from) : null,
            valid_until: valid_until ? new Date(valid_until) : null,
            notes
        };

        const result = await roleService.assignRoleToUser(assignmentData, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                conflicts: result.conflicts
            });
        }

        return res.status(201).json({
            success: true,
            data: result.data,
            message: 'Role assigned successfully'
        });
    } catch (err) {
        console.error('Error assigning role:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Lấy thống kê role (GET /roles/stats)
export const getRoleStats = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.read');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { organization_id } = req.query;
        const stats = await roleService.getRoleStats(organization_id || null);

        return res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('Error getting role stats:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Get user's active roles (GET /roles/users/:userId)
export const getUserActiveRoles = async (req, res) => {
    try {
        const requesterId = req.user?.id;
        if (!requesterId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { userId } = req.params;
        const { organization_id } = req.query;
        
        // Check permission (can view own roles or need user.read permission)
        const hasPermission = userId === requesterId || 
                             await permissionService.hasPermission(requesterId, 'user.read');
        
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const roles = await roleService.getUserActiveRoles(userId, organization_id || null);

        return res.json({
            success: true,
            data: roles,
            total: roles.length
        });
    } catch (err) {
        console.error('Error getting user roles:', err);
        return res.status(500).json({ error: err.message });
    }
};