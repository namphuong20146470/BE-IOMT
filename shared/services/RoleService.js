import { PrismaClient } from '@prisma/client';
import auditService from './AuditService.js';

const prisma = new PrismaClient();

class RoleService {
  constructor() {
    this.cache = new Map();
    this.hierarchyCache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes in milliseconds
  }

  // ==========================================
  // ROLE CRUD OPERATIONS
  // ==========================================
  
  /**
   * Create a new role
   * @param {Object} roleData - Role data
   * @param {string} createdBy - Creator user UUID
   * @returns {Promise<Object>} Created role result
   */
  async createRole(roleData, createdBy) {
    try {
      // Validate required fields
      if (!roleData.name) {
        return {
          success: false,
          error: 'Role name is required'
        };
      }

      // organization_id can be null for system-wide roles (super admin)
      const organizationId = roleData.organization_id || null;

      // Check for duplicate role name in organization
      const existingRole = await prisma.roles.findFirst({
        where: {
          name: roleData.name,
          ...(organizationId 
            ? { organizations: { id: organizationId } }
            : { organizations: null }
          ),
          is_active: true
        }
      });

      if (existingRole) {
        const scopeMessage = organizationId 
          ? 'in the organization' 
          : 'as a system-wide role';
        return {
          success: false,
          error: `Role with this name already exists ${scopeMessage}`
        };
      }

      // Prepare create data (only use fields that exist in schema)
      const createData = {
        name: roleData.name,
        description: roleData.description || '',
        color: roleData.color || '#6B7280',
        icon: roleData.icon || 'user',
        is_custom: roleData.is_custom !== false,
        is_system_role: roleData.is_system_role || false,
        sort_order: roleData.sort_order || 0
        // Removed metadata - not in schema
        // Removed users connection - will set created_by separately if field exists
      };

      // Add organization connection only if organizationId is provided
      if (organizationId) {
        createData.organizations = {
          connect: { id: organizationId }
        };
      }

      const role = await prisma.roles.create({
        data: createData,
        include: {
          organizations: true
        }
      });

      // Log creation
      await auditService.log({
        user_id: createdBy,
        action: 'create',
        resource_type: 'role',
        resource_id: role.id,
        new_values: {
          name: role.name,
          organization_name: role.organizations?.name || 'System-wide',
          is_system_role: organizationId === null
        }
      });

      // Clear cache
      this.clearRoleCache();
      
      const orgInfo = role.organizations?.name || 'System-wide (all organizations)';
      console.log(`✅ Created role: ${role.name} for: ${orgInfo}`);
      
      return { success: true, data: role };
    } catch (error) {
      console.error('Error creating role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get role by ID with optional permission details
   * @param {string} roleId - Role UUID
   * @param {boolean} includePermissions - Include permission details
   * @returns {Promise<Object|null>} Role object or null
   */
  async getRoleById(roleId, includePermissions = false) {
    try {
      const cacheKey = `role_${roleId}_${includePermissions}`;
      
      if (this.cache.has(cacheKey)) {
        console.log(`📋 Using cache for role ${roleId}`);
        return this.cache.get(cacheKey);
      }

      const role = await prisma.roles.findUnique({
        where: { 
          id: roleId,
          is_active: true 
        },
        include: {
          organizations: true,
          users_v2: {
            select: {
              full_name: true
            }
          },
          role_permissions: includePermissions ? {
            include: {
              permissions: {
                include: {
                  permission_groups: true
                }
              }
            }
          } : false,
          _count: {
            select: {
              user_roles: {
                where: { is_active: true }
              }
            }
          }
        }
      });

      if (role && includePermissions) {
        role.permissions = role.role_permissions.map(rp => rp.permissions);
        delete role.role_permissions;
      }

      if (role) {
        role.user_count = role._count.user_roles;
        delete role._count;
      }

      // Cache for 30 minutes
      this.cache.set(cacheKey, role);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

      return role;
    } catch (error) {
      console.error('Error getting role:', error);
      return null;
    }
  }

  /**
   * Get roles by organization with filtering options
   * @param {string|null} organizationId - Organization UUID (null for Super Admin to get all roles)
   * @param {Object} options - Filtering options
   * @returns {Promise<Array>} Array of roles
   */
  async getRolesByOrganization(organizationId, options = {}) {
    try {
      const {
        includeSystemRoles = true,
        includePermissions = false,
        isActive = true,
        search = null
      } = options;

      // ✅ FIXED: Handle null organization_id for Super Admin
      let where = {
        AND: [
          { is_active: isActive }
        ]
      };

      // If organization_id is null (Super Admin), get all roles
      // If organization_id is provided, filter by org + system roles
      if (organizationId) {
        where.AND.push({
          OR: [
            { organization_id: organizationId },
            ...(includeSystemRoles ? [{ is_system_role: true }] : [])
          ]
        });
      } else {
        // Super Admin case: get all roles (optionally exclude system roles)
        if (!includeSystemRoles) {
          where.AND.push({ is_system_role: false });
        }
        // If includeSystemRoles is true, no additional filter needed (get all)
      }

      if (search) {
        where.AND.push({
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        });
      }

      const roles = await prisma.roles.findMany({
        where,
        include: {
          organizations: true,
          role_permissions: includePermissions ? {
            include: {
              permissions: {
                include: {
                  permission_groups: true
                }
              }
            }
          } : false,
          _count: {
            select: {
              user_roles: {
                where: { is_active: true }
              }
            }
          }
        },
        orderBy: [
          { is_system_role: 'desc' },
          { sort_order: 'asc' },
          { name: 'asc' }
        ]
      });

      return roles.map(role => ({
        ...role,
        permissions: includePermissions ? role.role_permissions?.map(rp => rp.permissions) : undefined,
        user_count: role._count.user_roles,
        role_permissions: undefined,
        _count: undefined
      }));
    } catch (error) {
      console.error('Error getting organization roles:', error);
      return [];
    }
  }

  /**
 * Update permissions for a role
 * @param {string} roleId - Role ID
 * @param {string[]} permissionIds - Array of permission IDs to assign
 * @param {string} updatedBy - User ID making the update
 */
async updateRolePermissions(roleId, permissionIds, updatedBy) {
    try {
        // Validate permission IDs exist
        const { data: validPermissions, error: permError } = await supabase
            .from('permissions')
            .select('id')
            .in('id', permissionIds);

        if (permError) throw permError;

        const validPermissionIds = validPermissions.map(p => p.id);
        const invalidIds = permissionIds.filter(id => !validPermissionIds.includes(id));

        if (invalidIds.length > 0) {
            return {
                success: false,
                error: `Invalid permission IDs: ${invalidIds.join(', ')}`
            };
        }

        // Delete existing role-permission mappings
        const { error: deleteError } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId);

        if (deleteError) throw deleteError;

        // Insert new role-permission mappings
        if (permissionIds.length > 0) {
            const mappings = permissionIds.map(permId => ({
                role_id: roleId,
                permission_id: permId,
                granted_by: updatedBy,
                granted_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('role_permissions')
                .insert(mappings);

            if (insertError) throw insertError;
        }

        // Update role's updated_at timestamp
        const { error: updateError } = await supabase
            .from('roles')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', roleId);

        if (updateError) throw updateError;

        // Fetch updated role with permissions
        const updatedRole = await this.getRoleById(roleId, true);

        return {
            success: true,
            data: updatedRole
        };
    } catch (err) {
        console.error('Error updating role permissions:', err);
        return {
            success: false,
            error: err.message
        };
    }
}
  /**
   * Get all roles (for Super Admin)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} All roles across all organizations
   */
  async getAllRoles(options = {}) {
    try {
      const {
        includeSystemRoles = true,
        includePermissions = false,
        isActive = true,
        search = null
      } = options;

      let where = {
        is_active: isActive
      };

      if (!includeSystemRoles) {
        where.is_system_role = false;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const roles = await prisma.roles.findMany({
        where,
        include: {
          organizations: true,
          role_permissions: includePermissions ? {
            include: {
              permissions: {
                include: {
                  permission_groups: true
                }
              }
            }
          } : false,
          _count: {
            select: {
              user_roles: {
                where: { is_active: true }
              }
            }
          }
        },
        orderBy: [
          { is_system_role: 'desc' },
          { organizations: { name: 'asc' } },
          { sort_order: 'asc' },
          { name: 'asc' }
        ]
      });

      return roles.map(role => ({
        ...role,
        permissions: includePermissions ? role.role_permissions?.map(rp => rp.permissions) : undefined,
        user_count: role._count.user_roles,
        role_permissions: undefined,
        _count: undefined
      }));
    } catch (error) {
      console.error('Error getting all roles:', error);
      return [];
    }
  }

  /**
   * Update role
   * @param {string} roleId - Role UUID
   * @param {Object} updateData - Update data
   * @param {string} updatedBy - Updater user UUID
   * @returns {Promise<Object>} Update result
   */
  async updateRole(roleId, updateData, updatedBy) {
    try {
      const existingRole = await this.getRoleById(roleId);
      if (!existingRole) {
        return { success: false, error: 'Role not found' };
      }

      // Check for name conflicts if name is being updated
      if (updateData.name && updateData.name !== existingRole.name) {
        const nameConflict = await prisma.roles.findFirst({
          where: {
            name: updateData.name,
            organization_id: existingRole.organization_id,
            is_active: true,
            id: { not: roleId }
          }
        });

        if (nameConflict) {
          return {
            success: false,
            error: 'Role with this name already exists in the organization'
          };
        }
      }

      const updatedRole = await prisma.roles.update({
        where: { id: roleId },
        data: {
          ...updateData,
          updated_at: new Date()
        },
        include: {
          organizations: true
        }
      });

      // Log update
      await auditService.log({
        user_id: updatedBy,
        action: 'update',
        resource_type: 'role',
        resource_id: roleId,
        old_values: {
          name: existingRole.name,
          description: existingRole.description
        },
        new_values: {
          name: updatedRole.name,
          description: updatedRole.description
        }
      });

      // Clear cache
      this.clearRoleCache();

      console.log(`✅ Updated role: ${updatedRole.name}`);
      return { success: true, data: updatedRole };
    } catch (error) {
      console.error('Error updating role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete role (soft delete)
   * @param {string} roleId - Role UUID
   * @param {string} deletedBy - Deleter user UUID
   * @returns {Promise<Object>} Delete result
   */
  async deleteRole(roleId, deletedBy) {
    try {
      const role = await this.getRoleById(roleId);
      if (!role) {
        return { success: false, error: 'Role not found' };
      }

      // Check if role is in use
      const activeAssignments = await prisma.user_roles.count({
        where: {
          role_id: roleId,
          is_active: true
        }
      });

      if (activeAssignments > 0) {
        return {
          success: false,
          error: `Cannot delete role. It is assigned to ${activeAssignments} user(s)`
        };
      }

      // Soft delete
      await prisma.roles.update({
        where: { id: roleId },
        data: {
          is_active: false,
          updated_at: new Date()
        }
      });

      // Log deletion
      await auditService.log({
        user_id: deletedBy,
        action: 'delete',
        resource_type: 'role',
        resource_id: roleId,
        old_values: {
          name: role.name,
          organization_name: role.organizations?.name
        }
      });

      // Clear cache
      this.clearRoleCache();

      console.log(`✅ Deleted role: ${role.name}`);
      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      console.error('Error deleting role:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // ROLE HIERARCHY MANAGEMENT
  // ==========================================
  
  /**
   * Get role hierarchy for organization
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<Array>} Hierarchy tree
   */
  async getRoleHierarchy(organizationId) {
    const cacheKey = `hierarchy_${organizationId}`;
    
    if (this.hierarchyCache.has(cacheKey)) {
      console.log(`📋 Using hierarchy cache for organization ${organizationId}`);
      return this.hierarchyCache.get(cacheKey);
    }

    try {
      const hierarchy = await prisma.role_hierarchy.findMany({
        where: {
          OR: [
            { parent_role: { organization_id: organizationId } },
            { parent_role: { is_system_role: true } }
          ]
        },
        include: {
          parent_role: true,
          child_role: true
        }
      });

      const tree = this.buildHierarchyTree(hierarchy);
      
      // Cache for 10 minutes
      this.hierarchyCache.set(cacheKey, tree);
      setTimeout(() => this.hierarchyCache.delete(cacheKey), 10 * 60 * 1000);

      return tree;
    } catch (error) {
      console.error('Error getting role hierarchy:', error);
      return [];
    }
  }

  /**
   * Build hierarchy tree from flat hierarchy data
   * @param {Array} hierarchy - Flat hierarchy relations
   * @returns {Array} Tree structure
   */
  buildHierarchyTree(hierarchy) {
    const roleMap = new Map();
    const roots = [];

    // Build role map
    hierarchy.forEach(rel => {
      if (!roleMap.has(rel.parent_role.id)) {
        roleMap.set(rel.parent_role.id, {
          ...rel.parent_role,
          children: []
        });
      }
      if (!roleMap.has(rel.child_role.id)) {
        roleMap.set(rel.child_role.id, {
          ...rel.child_role,
          children: []
        });
      }
    });

    // Build tree structure
    hierarchy.forEach(rel => {
      const parent = roleMap.get(rel.parent_role.id);
      const child = roleMap.get(rel.child_role.id);
      if (parent && child) {
        parent.children.push(child);
      }
    });

    // Find roots (roles without parents)
    const childIds = new Set(hierarchy.map(h => h.child_role.id));
    roleMap.forEach(role => {
      if (!childIds.has(role.id)) {
        roots.push(role);
      }
    });

    return roots;
  }

  /**
   * Add role hierarchy relationship
   * @param {string} parentRoleId - Parent role UUID
   * @param {string} childRoleId - Child role UUID
   * @param {string} createdBy - Creator user UUID
   * @returns {Promise<Object>} Creation result
   */
  async addRoleHierarchy(parentRoleId, childRoleId, createdBy) {
    try {
      // Validate roles exist
      const [parentRole, childRole] = await Promise.all([
        this.getRoleById(parentRoleId),
        this.getRoleById(childRoleId)
      ]);

      if (!parentRole || !childRole) {
        return { success: false, error: 'One or both roles not found' };
      }

      // Check for circular dependency
      const wouldCreateCycle = await this.wouldCreateCycle(parentRoleId, childRoleId);
      if (wouldCreateCycle) {
        return { success: false, error: 'Cannot create hierarchy: would create circular dependency' };
      }

      // Check if relationship already exists
      const existing = await prisma.role_hierarchy.findFirst({
        where: {
          parent_role_id: parentRoleId,
          child_role_id: childRoleId
        }
      });

      if (existing) {
        return { success: false, error: 'Hierarchy relationship already exists' };
      }

      const hierarchy = await prisma.role_hierarchy.create({
        data: {
          parent_role_id: parentRoleId,
          child_role_id: childRoleId,
          created_by: createdBy
        },
        include: {
          parent_role: true,
          child_role: true
        }
      });

      // Log creation
      await auditService.log({
        user_id: createdBy,
        action: 'create',
        resource_type: 'role_hierarchy',
        resource_id: hierarchy.id,
        new_values: {
          parent_role: hierarchy.parent_role.name,
          child_role: hierarchy.child_role.name
        }
      });

      // Clear hierarchy cache
      this.clearHierarchyCache();

      console.log(`✅ Added hierarchy: ${parentRole.name} -> ${childRole.name}`);
      return { success: true, data: hierarchy };
    } catch (error) {
      console.error('Error adding role hierarchy:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if adding hierarchy would create a cycle
   * @param {string} parentRoleId - Parent role UUID
   * @param {string} childRoleId - Child role UUID
   * @returns {Promise<boolean>} Would create cycle
   */
  async wouldCreateCycle(parentRoleId, childRoleId) {
    try {
      // Use DFS to check if childRoleId is an ancestor of parentRoleId
      const visited = new Set();
      const stack = [childRoleId];

      while (stack.length > 0) {
        const currentId = stack.pop();
        
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        if (currentId === parentRoleId) {
          return true; // Cycle detected
        }

        // Get all parents of current role
        const parents = await prisma.role_hierarchy.findMany({
          where: { child_role_id: currentId },
          select: { parent_role_id: true }
        });

        for (const parent of parents) {
          stack.push(parent.parent_role_id);
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking for cycles:', error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Get inherited permissions for role (including from parent roles)
   * @param {string} roleId - Role UUID
   * @returns {Promise<Array>} Array of permissions
   */
  async getInheritedPermissions(roleId) {
    try {
      // Get role's direct permissions
      const directPermissions = await this.getRolePermissions(roleId);
      
      // Get parent roles
      const parents = await this.getParentRoles(roleId);
      
      // Collect inherited permissions
      const inheritedPermissions = new Map();
      
      for (const parent of parents) {
        const parentPermissions = await this.getInheritedPermissions(parent.id);
        parentPermissions.forEach(p => {
          if (!inheritedPermissions.has(p.id)) {
            inheritedPermissions.set(p.id, { ...p, inherited_from: parent.name });
          }
        });
      }
      
      // Combine direct + inherited (direct permissions override inherited)
      const allPermissions = new Map();
      
      // Add inherited first
      inheritedPermissions.forEach((perm, id) => {
        allPermissions.set(id, perm);
      });
      
      // Add direct permissions (override inherited)
      directPermissions.forEach(perm => {
        allPermissions.set(perm.id, { ...perm, inherited_from: null });
      });
      
      return Array.from(allPermissions.values());
    } catch (error) {
      console.error('Error getting inherited permissions:', error);
      return [];
    }
  }

  /**
   * Get direct permissions for role
   * @param {string} roleId - Role UUID
   * @returns {Promise<Array>} Array of permissions
   */
  async getRolePermissions(roleId) {
    try {
      const rolePermissions = await prisma.role_permissions.findMany({
        where: { role_id: roleId },
        include: {
          permissions: {
            include: {
              permission_groups: true
            }
          }
        }
      });

      return rolePermissions.map(rp => rp.permissions);
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return [];
    }
  }

  /**
   * Get parent roles
   * @param {string} roleId - Role UUID
   * @returns {Promise<Array>} Array of parent roles
   */
  async getParentRoles(roleId) {
    try {
      const parentRelations = await prisma.role_hierarchy.findMany({
        where: { child_role_id: roleId },
        include: {
          parent_role: true
        }
      });

      return parentRelations.map(rel => rel.parent_role);
    } catch (error) {
      console.error('Error getting parent roles:', error);
      return [];
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================
  
  /**
   * Clear all role caches
   */
  clearRoleCache() {
    this.cache.clear();
  }

  /**
   * Clear hierarchy cache
   */
  clearHierarchyCache() {
    this.hierarchyCache.clear();
  }

  /**
   * Clear permission cache for all users with a specific role
   * @param {string} roleId - Role UUID
   */
  async clearUserCacheForRole(roleId) {
    try {
      // Get all users with this role
      const usersWithRole = await prisma.user_roles.findMany({
        where: {
          role_id: roleId,
          is_active: true
        },
        select: {
          user_id: true
        }
      });

      console.log(`🔄 Clearing permission cache for ${usersWithRole.length} users with role ${roleId}`);

      // Import PermissionService to clear user caches
      const { default: permissionService } = await import('./PermissionService.backup.js');

      // Clear cache for each user
      for (const userRole of usersWithRole) {
        await permissionService.invalidateUserCache(userRole.user_id);
      }

      console.log(`✅ Cleared permission cache for all users with role ${roleId}`);
    } catch (error) {
      console.error('Error clearing user cache for role:', error);
    }
  }

  /**
   * Get role statistics
   * @param {string} organizationId - Organization UUID (optional)
   * @returns {Promise<Object>} Role statistics
   */
  async getRoleStats(organizationId = null) {
    try {
      const where = organizationId ? { organization_id: organizationId } : {};

      const [
        totalRoles,
        customRoles,
        systemRoles,
        activeAssignments,
        roleUsage
      ] = await Promise.all([
        prisma.roles.count({ where: { ...where, is_active: true } }),
        prisma.roles.count({ where: { ...where, is_active: true, is_custom: true } }),
        prisma.roles.count({ where: { is_active: true, is_system_role: true } }),
        prisma.user_roles.count({ 
          where: { 
            is_active: true,
            ...(organizationId && { organization_id: organizationId })
          } 
        }),
        prisma.roles.findMany({
          where: { ...where, is_active: true },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                user_roles: {
                  where: { is_active: true }
                }
              }
            }
          },
          orderBy: {
            user_roles: {
              _count: 'desc'
            }
          },
          take: 10
        })
      ]);

      return {
        total_roles: totalRoles,
        custom_roles: customRoles,
        system_roles: systemRoles,
        active_assignments: activeAssignments,
        most_used_roles: roleUsage.map(r => ({
          role_name: r.name,
          user_count: r._count.user_roles
        }))
      };
    } catch (error) {
      console.error('Error getting role stats:', error);
      return {};
    }
  }

  /**
   * Get user's active roles
   * @param {string} userId - User UUID
   * @param {string} organizationId - Organization UUID (optional)
   * @returns {Promise<Array>} Array of active roles
   */
  async getUserActiveRoles(userId, organizationId = null) {
    try {
      const where = {
        user_id: userId,
        is_active: true,
        OR: [
          { valid_until: null },
          { valid_until: { gt: new Date() } }
        ]
      };

      if (organizationId) {
        where.organization_id = organizationId;
      }

      const userRoles = await prisma.user_roles.findMany({
        where,
        include: {
          roles: true,
          organizations: true,
          departments: true
        }
      });

      return userRoles.map(ur => ({
        ...ur.roles,
        organization: ur.organizations,
        department: ur.departments,
        assignment_id: ur.id,
        valid_from: ur.valid_from,
        valid_until: ur.valid_until,
        assigned_by: ur.assigned_by,
        notes: ur.notes
      }));
    } catch (error) {
      console.error('Error getting user active roles:', error);
      return [];
    }
  }

  // ==========================================
  // ROLE ASSIGNMENT MANAGEMENT
  // ==========================================
  
  /**
   * Assign role to user with validation and conflict checking
   * @param {Object} assignmentData - Assignment data
   * @param {string} assignedBy - Assigner user UUID
   * @returns {Promise<Object>} Assignment result
   */
  async assignRoleToUser(assignmentData, assignedBy) {
    try {
      // Validate required fields
      if (!assignmentData.user_id || !assignmentData.role_id || !assignmentData.organization_id) {
        return {
          success: false,
          error: 'User ID, Role ID, and Organization ID are required'
        };
      }

      // Validate role exists and is active
      const role = await this.getRoleById(assignmentData.role_id);
      if (!role) {
        return { success: false, error: 'Role not found or inactive' };
      }

      // Validate user exists
      const user = await prisma.users.findUnique({
        where: { id: assignmentData.user_id },
        select: { id: true, full_name: true, email: true }
      });
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check for role assignment conflicts
      const conflicts = await this.checkRoleConflicts(
        assignmentData.user_id,
        assignmentData.role_id,
        assignmentData.organization_id
      );

      if (conflicts.length > 0) {
        return {
          success: false,
          error: 'Role assignment conflicts detected',
          conflicts
        };
      }

      // Create assignment
      const assignment = await prisma.user_roles.create({
        data: {
          user_id: assignmentData.user_id,
          role_id: assignmentData.role_id,
          organization_id: assignmentData.organization_id,
          department_id: assignmentData.department_id || null,
          valid_from: assignmentData.valid_from || new Date(),
          valid_until: assignmentData.valid_until || null,
          assigned_by: assignedBy,
          notes: assignmentData.notes || null
        },
        include: {
          roles: true,
          users: {
            select: {
              full_name: true,
              email: true
            }
          },
          organizations: true,
          departments: true
        }
      });

      // Log assignment
      await auditService.log({
        user_id: assignedBy,
        action: 'role_assigned',
        resource_type: 'user_role',
        resource_id: assignment.id,
        new_values: {
          user_name: assignment.users.full_name,
          user_email: assignment.users.email,
          role_name: assignment.roles.name,
          organization_name: assignment.organizations.name,
          department_name: assignment.departments?.name
        }
      });

      // Clear related caches
      this.clearRoleCache();

      console.log(`✅ Assigned role '${role.name}' to user '${user.full_name}'`);
      return { success: true, data: assignment };
    } catch (error) {
      console.error('Error assigning role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove role from user
   * @param {string} userRoleId - User role assignment UUID
   * @param {string} removedBy - Remover user UUID
   * @param {string} reason - Removal reason
   * @returns {Promise<Object>} Removal result
   */
  async removeRoleFromUser(userRoleId, removedBy, reason = null) {
    try {
      const userRole = await prisma.user_roles.findUnique({
        where: { id: userRoleId },
        include: {
          roles: true,
          users: {
            select: {
              full_name: true,
              email: true
            }
          },
          organizations: true
        }
      });

      if (!userRole) {
        return { success: false, error: 'Role assignment not found' };
      }

      // Soft delete the assignment
      await prisma.user_roles.update({
        where: { id: userRoleId },
        data: {
          is_active: false,
          updated_at: new Date(),
          notes: reason ? `${userRole.notes || ''}\nRemoved: ${reason}`.trim() : userRole.notes
        }
      });

      // Log removal
      await auditService.log({
        user_id: removedBy,
        action: 'role_removed',
        resource_type: 'user_role',
        resource_id: userRoleId,
        old_values: {
          user_name: userRole.users.full_name,
          role_name: userRole.roles.name,
          organization_name: userRole.organizations.name
        },
        notes: reason
      });

      // Clear related caches
      this.clearRoleCache();

      console.log(`✅ Removed role '${userRole.roles.name}' from user '${userRole.users.full_name}'`);
      return { success: true, message: 'Role removed successfully' };
    } catch (error) {
      console.error('Error removing role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for role assignment conflicts
   * @param {string} userId - User UUID
   * @param {string} roleId - Role UUID
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<Array>} Array of conflict descriptions
   */
  async checkRoleConflicts(userId, roleId, organizationId) {
    try {
      const conflicts = [];

      // Get role being assigned
      const newRole = await this.getRoleById(roleId);
      if (!newRole) return ['Role not found'];

      // Get user's current active roles in same organization
      const currentRoles = await prisma.user_roles.findMany({
        where: {
          user_id: userId,
          organization_id: organizationId,
          is_active: true,
          OR: [
            { valid_until: null },
            { valid_until: { gt: new Date() } }
          ]
        },
        include: {
          roles: true
        }
      });

      // Check for duplicate role
      if (currentRoles.some(ur => ur.role_id === roleId)) {
        conflicts.push('User already has this role in the organization');
      }

      // Check for hierarchical conflicts (can't have parent and child roles)
      const hierarchy = await this.getRoleHierarchy(organizationId);
      const hierarchyConflicts = this.checkHierarchyConflicts(newRole, currentRoles, hierarchy);
      conflicts.push(...hierarchyConflicts);

      // Check for incompatible roles (if defined in role metadata)
      const incompatibilityConflicts = this.checkRoleIncompatibilities(newRole, currentRoles);
      conflicts.push(...incompatibilityConflicts);

      return conflicts;
    } catch (error) {
      console.error('Error checking role conflicts:', error);
      return ['Error checking conflicts'];
    }
  }

  /**
   * Check hierarchy conflicts
   * @param {Object} newRole - New role to assign
   * @param {Array} currentRoles - Current user roles
   * @param {Array} hierarchy - Role hierarchy
   * @returns {Array} Hierarchy conflict descriptions
   */
  checkHierarchyConflicts(newRole, currentRoles, hierarchy) {
    const conflicts = [];
    
    // Build parent-child maps from hierarchy
    const parentChildMap = new Map();
    const childParentMap = new Map();
    
    const addToHierarchyMaps = (nodes) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          parentChildMap.set(node.id, node.children.map(c => c.id));
          node.children.forEach(child => {
            childParentMap.set(child.id, node.id);
          });
          addToHierarchyMaps(node.children);
        }
      });
    };
    
    addToHierarchyMaps(hierarchy);

    // Check if new role is parent of any current role
    const newRoleChildren = parentChildMap.get(newRole.id) || [];
    const currentRoleIds = currentRoles.map(r => r.role_id);
    
    const childConflicts = newRoleChildren.filter(childId => currentRoleIds.includes(childId));
    if (childConflicts.length > 0) {
      const conflictRoles = currentRoles
        .filter(r => childConflicts.includes(r.role_id))
        .map(r => r.roles.name);
      conflicts.push(`Cannot assign parent role. User already has child role(s): ${conflictRoles.join(', ')}`);
    }

    // Check if new role is child of any current role
    const newRoleParent = childParentMap.get(newRole.id);
    if (newRoleParent && currentRoleIds.includes(newRoleParent)) {
      const parentRole = currentRoles.find(r => r.role_id === newRoleParent);
      conflicts.push(`Cannot assign child role. User already has parent role: ${parentRole.roles.name}`);
    }

    return conflicts;
  }

  /**
   * Check role incompatibilities based on metadata
   * @param {Object} newRole - New role to assign
   * @param {Array} currentRoles - Current user roles
   * @returns {Array} Incompatibility conflict descriptions
   */
  checkRoleIncompatibilities(newRole, currentRoles) {
    const conflicts = [];
    
    // Check if new role has incompatible roles defined
    const incompatibleRoles = newRole.metadata?.incompatible_roles || [];
    if (incompatibleRoles.length > 0) {
      const currentRoleNames = currentRoles.map(r => r.roles.name);
      const foundIncompatible = incompatibleRoles.filter(ir => currentRoleNames.includes(ir));
      
      if (foundIncompatible.length > 0) {
        conflicts.push(`Role '${newRole.name}' is incompatible with: ${foundIncompatible.join(', ')}`);
      }
    }

    // Check if any current role is incompatible with new role
    currentRoles.forEach(currentRole => {
      const currentIncompatible = currentRole.roles.metadata?.incompatible_roles || [];
      if (currentIncompatible.includes(newRole.name)) {
        conflicts.push(`Role '${currentRole.roles.name}' is incompatible with '${newRole.name}'`);
      }
    });

    return conflicts;
  }

  /**
   * Bulk assign roles to users
   * @param {Array} assignments - Array of assignment objects
   * @param {string} assignedBy - Assigner user UUID
   * @returns {Promise<Object>} Bulk assignment result
   */
  async bulkAssignRoles(assignments, assignedBy) {
    try {
      const results = {
        success: [],
        failed: [],
        total: assignments.length
      };

      for (const assignment of assignments) {
        const result = await this.assignRoleToUser(assignment, assignedBy);
        
        if (result.success) {
          results.success.push({
            user_id: assignment.user_id,
            role_id: assignment.role_id,
            data: result.data
          });
        } else {
          results.failed.push({
            user_id: assignment.user_id,
            role_id: assignment.role_id,
            error: result.error,
            conflicts: result.conflicts
          });
        }
      }

      console.log(`✅ Bulk role assignment: ${results.success.length} successful, ${results.failed.length} failed`);
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Error in bulk role assignment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update role assignment
   * @param {string} userRoleId - User role assignment UUID
   * @param {Object} updateData - Update data
   * @param {string} updatedBy - Updater user UUID
   * @returns {Promise<Object>} Update result
   */
  async updateRoleAssignment(userRoleId, updateData, updatedBy) {
    try {
      const existingAssignment = await prisma.user_roles.findUnique({
        where: { id: userRoleId },
        include: {
          roles: true,
          users: {
            select: { full_name: true }
          },
          organizations: true
        }
      });

      if (!existingAssignment) {
        return { success: false, error: 'Role assignment not found' };
      }

      const updatedAssignment = await prisma.user_roles.update({
        where: { id: userRoleId },
        data: {
          ...updateData,
          updated_at: new Date()
        },
        include: {
          roles: true,
          users: {
            select: { full_name: true }
          },
          organizations: true,
          departments: true
        }
      });

      // Log update
      await auditService.log({
        user_id: updatedBy,
        action: 'role_assignment_updated',
        resource_type: 'user_role',
        resource_id: userRoleId,
        old_values: {
          valid_from: existingAssignment.valid_from,
          valid_until: existingAssignment.valid_until,
          notes: existingAssignment.notes
        },
        new_values: {
          valid_from: updatedAssignment.valid_from,
          valid_until: updatedAssignment.valid_until,
          notes: updatedAssignment.notes
        }
      });

      console.log(`✅ Updated role assignment for user '${updatedAssignment.users.full_name}'`);
      return { success: true, data: updatedAssignment };
    } catch (error) {
      console.error('Error updating role assignment:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // ROLE TEMPLATES SYSTEM
  // ==========================================
  
  /**
   * Get role templates
   * @param {string} organizationType - Organization type filter
   * @param {boolean} includeCustom - Include custom templates
   * @returns {Promise<Object>} Templates result
   */
  async getRoleTemplates(organizationType = null, includeCustom = true) {
    try {
      const whereClause = {
        is_active: true
      };

      if (organizationType) {
        whereClause.organization_types = {
          has: organizationType
        };
      }

      const templates = await prisma.role_templates.findMany({
        where: whereClause,
        include: {
          users: {
            select: {
              full_name: true
            }
          }
        },
        orderBy: [
          { is_default: 'desc' },
          { name: 'asc' }
        ]
      });

      return { success: true, data: templates };
    } catch (error) {
      console.error('Error getting role templates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create role template
   * @param {Object} templateData - Template data
   * @param {string} createdBy - Creator user UUID
   * @returns {Promise<Object>} Template result
   */
  async createRoleTemplate(templateData, createdBy) {
    try {
      // Validate required fields
      if (!templateData.name) {
        return {
          success: false,
          error: 'Template name is required'
        };
      }

      // Check for duplicate template name
      const existingTemplate = await prisma.role_templates.findFirst({
        where: {
          name: templateData.name,
          is_active: true
        }
      });

      if (existingTemplate) {
        return {
          success: false,
          error: 'Template with this name already exists'
        };
      }

      const template = await prisma.role_templates.create({
        data: {
          name: templateData.name,
          description: templateData.description || '',
          organization_types: templateData.organization_types || [],
          permission_ids: templateData.permission_ids || [],
          is_default: templateData.is_default || false,
          created_by: createdBy
        },
        include: {
          users: {
            select: {
              full_name: true
            }
          }
        }
      });

      // Log creation
      await auditService.log({
        user_id: createdBy,
        action: 'create',
        resource_type: 'role_template',
        resource_id: template.id,
        new_values: {
          name: template.name,
          organization_types: template.organization_types
        }
      });

      console.log(`✅ Created role template: ${template.name}`);
      return { success: true, data: template };
    } catch (error) {
      console.error('Error creating role template:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create role from template
   * @param {string} templateId - Template UUID
   * @param {Object} roleData - Role data
   * @param {string} createdBy - Creator user UUID
   * @returns {Promise<Object>} Role result
   */
  async createRoleFromTemplate(templateId, roleData, createdBy) {
    try {
      // Get template
      const template = await prisma.role_templates.findFirst({
        where: {
          id: templateId,
          is_active: true
        }
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found or inactive'
        };
      }

      // Create role with template permissions
      const newRoleData = {
        name: roleData.name,
        description: roleData.description || template.description,
        organization_id: roleData.organization_id,
        color: roleData.color || '#6B7280',
        icon: roleData.icon || 'user',
        is_custom: true,
        is_system_role: false,
        sort_order: roleData.sort_order || 0
      };

      const role = await this.createRole(newRoleData, createdBy);

      if (role.success && template.permission_ids.length > 0) {
        // Assign template permissions to role
        await prisma.role_permissions.createMany({
          data: template.permission_ids.map(permissionId => ({
            role_id: role.data.id,
            permission_id: permissionId
          })),
          skipDuplicates: true
        });
      }

      // Log template usage
      await auditService.log({
        user_id: createdBy,
        action: 'create',
        resource_type: 'role',
        resource_id: role.data?.id,
        new_values: {
          created_from_template: template.name,
          template_id: templateId
        }
      });

      console.log(`✅ Created role from template: ${template.name} -> ${newRoleData.name}`);
      return role;
    } catch (error) {
      console.error('Error creating role from template:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign single permission to role
   * @param {string} roleId - Role UUID
   * @param {string} permissionId - Permission UUID
   * @param {string} assignedBy - Assigner user UUID
   * @returns {Promise<Object>} Assignment result
   */
  async assignPermissionToRole(roleId, permissionId, assignedBy) {
    try {
      // Check if permission exists
      const permission = await prisma.permissions.findUnique({
        where: { id: permissionId }
      });

      if (!permission) {
        return {
          success: false,
          error: 'Permission not found'
        };
      }

      // Check if assignment already exists
      const existing = await prisma.role_permissions.findFirst({
        where: {
          role_id: roleId,
          permission_id: permissionId
        }
      });

      if (existing) {
        return {
          success: true,
          data: existing,
          message: 'Permission already assigned to role'
        };
      }

      // Create new assignment
      const assignment = await prisma.role_permissions.create({
        data: {
          role_id: roleId,
          permission_id: permissionId
        },
        include: {
          permissions: {
            select: {
              id: true,
              name: true,
              description: true,
              resource: true,
              action: true
            }
          }
        }
      });

      // Clear role cache
      this.clearRoleCache();

      // 🆕 IMPORTANT: Clear permission cache for all users with this role
      await this.clearUserCacheForRole(roleId);

      console.log(`✅ Assigned permission ${permissionId} to role ${roleId}`);

      return {
        success: true,
        data: assignment,
        message: 'Permission assigned successfully'
      };
    } catch (error) {
      console.error('Error assigning permission to role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign permissions to role
   * @param {string} roleId - Role UUID
   * @param {Array} permissionIds - Array of permission UUIDs
   * @param {string} assignedBy - Assigner user UUID
   * @returns {Promise<Object>} Assignment result
   */
  async assignPermissionsToRole(roleId, permissionIds, assignedBy) {
    try {
      const assignments = [];
      const failed = [];

      for (const permissionId of permissionIds) {
        try {
          // Check if permission exists
          const permission = await prisma.permissions.findUnique({
            where: { id: permissionId }
          });

          if (!permission) {
            failed.push({ permission_id: permissionId, error: 'Permission not found' });
            continue;
          }

          // Check if assignment already exists
          const existing = await prisma.role_permissions.findFirst({
            where: {
              role_id: roleId,
              permission_id: permissionId
            }
          });

          if (existing) {
            assignments.push(existing);
            continue;
          }

          // Create new assignment
          const assignment = await prisma.role_permissions.create({
            data: {
              role_id: roleId,
              permission_id: permissionId,
              granted_by: assignedBy
            }
          });

          assignments.push(assignment);
        } catch (error) {
          failed.push({ permission_id: permissionId, error: error.message });
        }
      }

      // Clear role cache
      this.clearRoleCache();

      // 🆕 IMPORTANT: Clear permission cache for all users with this role
      if (assignments.length > 0) {
        await this.clearUserCacheForRole(roleId);
      }

      if (failed.length > 0) {
        console.warn(`⚠️  Some permission assignments failed: ${failed.length} out of ${permissionIds.length}`);
      }

      return {
        success: assignments.length > 0,
        data: {
          assigned: assignments,
          failed: failed,
          total_requested: permissionIds.length,
          successful: assignments.length
        }
      };
    } catch (error) {
      console.error('Error assigning permissions to role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove permission from role
   * @param {string} roleId - Role UUID
   * @param {string} permissionId - Permission UUID
   * @param {string} removedBy - Remover user UUID
   * @returns {Promise<Object>} Removal result
   */
  async removePermissionFromRole(roleId, permissionId, removedBy) {
    try {
      // Check if assignment exists
      const assignment = await prisma.role_permissions.findFirst({
        where: {
          role_id: roleId,
          permission_id: permissionId
        }
      });

      if (!assignment) {
        return {
          success: false,
          error: 'Permission assignment not found for this role'
        };
      }

      // Remove the assignment
      await prisma.role_permissions.delete({
        where: { id: assignment.id }
      });

      // Clear role cache
      this.clearRoleCache();

      // 🆕 IMPORTANT: Clear permission cache for all users with this role
      await this.clearUserCacheForRole(roleId);

      console.log(`✅ Removed permission ${permissionId} from role ${roleId}`);

      return {
        success: true,
        data: {
          role_id: roleId,
          permission_id: permissionId,
          removed_by: removedBy,
          removed_at: new Date()
        }
      };
    } catch (error) {
      console.error('Error removing permission from role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update role template
   * @param {string} templateId - Template UUID
   * @param {Object} updateData - Update data
   * @param {string} updatedBy - Updater user UUID
   * @returns {Promise<Object>} Update result
   */
  async updateRoleTemplate(templateId, updateData, updatedBy) {
    try {
      const existingTemplate = await prisma.role_templates.findFirst({
        where: {
          id: templateId,
          is_active: true
        }
      });

      if (!existingTemplate) {
        return {
          success: false,
          error: 'Template not found or inactive'
        };
      }

      // Check for duplicate name if name is being updated
      if (updateData.name && updateData.name !== existingTemplate.name) {
        const duplicateTemplate = await prisma.role_templates.findFirst({
          where: {
            name: updateData.name,
            is_active: true,
            id: { not: templateId }
          }
        });

        if (duplicateTemplate) {
          return {
            success: false,
            error: 'Template with this name already exists'
          };
        }
      }

      const updatedTemplate = await prisma.role_templates.update({
        where: { id: templateId },
        data: {
          name: updateData.name || existingTemplate.name,
          description: updateData.description !== undefined ? updateData.description : existingTemplate.description,
          organization_types: updateData.organization_types || existingTemplate.organization_types,
          permission_ids: updateData.permission_ids || existingTemplate.permission_ids,
          is_default: updateData.is_default !== undefined ? updateData.is_default : existingTemplate.is_default,
          updated_at: new Date()
        },
        include: {
          users: {
            select: {
              full_name: true
            }
          }
        }
      });

      // Log update
      await auditService.log({
        user_id: updatedBy,
        action: 'update',
        resource_type: 'role_template',
        resource_id: templateId,
        old_values: existingTemplate,
        new_values: updateData
      });

      console.log(`✅ Updated role template: ${updatedTemplate.name}`);
      return { success: true, data: updatedTemplate };
    } catch (error) {
      console.error('Error updating role template:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete role template
   * @param {string} templateId - Template UUID
   * @param {string} deletedBy - Deleter user UUID
   * @returns {Promise<Object>} Delete result
   */
  async deleteRoleTemplate(templateId, deletedBy) {
    try {
      const template = await prisma.role_templates.findFirst({
        where: {
          id: templateId,
          is_active: true
        }
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found or already inactive'
        };
      }

      // Soft delete by setting is_active to false
      await prisma.role_templates.update({
        where: { id: templateId },
        data: {
          is_active: false,
          updated_at: new Date()
        }
      });

      // Log deletion
      await auditService.log({
        user_id: deletedBy,
        action: 'delete',
        resource_type: 'role_template',
        resource_id: templateId,
        old_values: template
      });

      console.log(`✅ Deleted role template: ${template.name}`);
      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      console.error('Error deleting role template:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default templates for organization type
   * @param {string} organizationType - Organization type
   * @returns {Promise<Array>} Default templates
   */
  async getDefaultTemplatesForOrgType(organizationType) {
    try {
      const templates = await prisma.role_templates.findMany({
        where: {
          is_active: true,
          is_default: true,
          organization_types: {
            has: organizationType
          }
        },
        include: {
          users: {
            select: {
              full_name: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      return templates;
    } catch (error) {
      console.error('Error getting default templates:', error);
      return [];
    }
  }

  // ==========================================
  // WARNING SYSTEM INTEGRATION
  // ==========================================
  
  /**
   * Get role escalation level for warning notifications
   * @param {string} userId - User UUID
   * @param {string} warningType - Warning type
   * @param {string} organizationId - Organization UUID (optional)
   * @returns {Promise<number>} Escalation level (1-5)
   */
  async getRoleEscalationLevel(userId, warningType, organizationId = null) {
    try {
      const userRoles = await this.getUserActiveRoles(userId, organizationId);
      
      // Define escalation hierarchy (lower number = higher priority)
      const escalationMap = {
        'Super Admin': 1,
        'System Administrator': 1,
        'Organization Admin': 1,
        'Security Officer': 1,
        'Department Manager': 2,
        'Team Lead': 2,
        'Device Manager': 2,
        'Senior Technician': 3,
        'Technician': 3,
        'Maintenance Staff': 4,
        'Operator': 4,
        'Monitor': 5,
        'Viewer': 5,
        'Guest': 5
      };

      // Warning type specific escalation adjustments
      const warningTypeAdjustments = {
        'security': -1,     // Security warnings get higher priority
        'critical': -1,     // Critical warnings get higher priority
        'emergency': -2,    // Emergency warnings get highest priority
        'maintenance': +1,  // Maintenance warnings get lower priority
        'info': +2         // Info warnings get lowest priority
      };

      // Get highest priority role (lowest escalation level)
      let minEscalation = 5;
      let applicableRoles = [];
      
      userRoles.forEach(role => {
        const baseLevel = escalationMap[role.name] || 5;
        applicableRoles.push({
          name: role.name,
          base_level: baseLevel,
          organization: role.organization?.name
        });
        
        if (baseLevel < minEscalation) {
          minEscalation = baseLevel;
        }
      });

      // Apply warning type adjustment
      const warningCategory = this.getWarningCategory(warningType);
      const adjustment = warningTypeAdjustments[warningCategory] || 0;
      const finalLevel = Math.max(1, Math.min(5, minEscalation + adjustment));

      console.log(`🔍 Escalation for user ${userId}: roles=${applicableRoles.map(r => r.name).join(', ')}, warning=${warningType}, level=${finalLevel}`);
      
      return finalLevel;
    } catch (error) {
      console.error('Error getting escalation level:', error);
      return 5; // Default to lowest priority
    }
  }

  /**
   * Get warning category from warning type
   * @param {string} warningType - Warning type
   * @returns {string} Warning category
   */
  getWarningCategory(warningType) {
    const categoryMap = {
      // Security related
      'unauthorized_access': 'security',
      'login_failure': 'security',
      'permission_denied': 'security',
      'data_breach': 'security',
      
      // Critical system issues
      'system_failure': 'critical',
      'database_error': 'critical',
      'network_failure': 'critical',
      'device_offline': 'critical',
      
      // Emergency situations
      'fire_alarm': 'emergency',
      'gas_leak': 'emergency',
      'power_failure': 'emergency',
      'evacuation': 'emergency',
      
      // Maintenance issues
      'device_maintenance': 'maintenance',
      'scheduled_maintenance': 'maintenance',
      'battery_low': 'maintenance',
      'sensor_calibration': 'maintenance',
      
      // Informational
      'data_sync': 'info',
      'report_generated': 'info',
      'user_login': 'info'
    };

    // Extract category from warning type
    for (const [pattern, category] of Object.entries(categoryMap)) {
      if (warningType.includes(pattern)) {
        return category;
      }
    }

    // Default categorization based on keywords
    if (warningType.includes('security') || warningType.includes('unauthorized')) {
      return 'security';
    } else if (warningType.includes('critical') || warningType.includes('failure')) {
      return 'critical';
    } else if (warningType.includes('emergency') || warningType.includes('alarm')) {
      return 'emergency';
    } else if (warningType.includes('maintenance') || warningType.includes('service')) {
      return 'maintenance';
    } else {
      return 'info';
    }
  }

  /**
   * Get notification recipients based on escalation level
   * @param {string} organizationId - Organization UUID
   * @param {number} escalationLevel - Escalation level (1-5)
   * @param {string} warningType - Warning type (optional)
   * @returns {Promise<Array>} Array of notification recipients
   */
  async getNotificationRecipients(organizationId, escalationLevel, warningType = null) {
    try {
      // Define role groups for each escalation level
      const escalationRoles = {
        1: ['Super Admin', 'System Administrator', 'Organization Admin', 'Security Officer'],
        2: ['Super Admin', 'System Administrator', 'Organization Admin', 'Security Officer', 
            'Department Manager', 'Team Lead', 'Device Manager'],
        3: ['Super Admin', 'System Administrator', 'Organization Admin', 'Security Officer',
            'Department Manager', 'Team Lead', 'Device Manager', 'Senior Technician', 'Technician'],
        4: ['Super Admin', 'System Administrator', 'Organization Admin', 'Security Officer',
            'Department Manager', 'Team Lead', 'Device Manager', 'Senior Technician', 'Technician',
            'Maintenance Staff', 'Operator'],
        5: ['Super Admin', 'System Administrator', 'Organization Admin', 'Security Officer',
            'Department Manager', 'Team Lead', 'Device Manager', 'Senior Technician', 'Technician',
            'Maintenance Staff', 'Operator', 'Monitor', 'Viewer']
      };

      const targetRoles = escalationRoles[escalationLevel] || escalationRoles[5];

      // Get users with target roles in the organization
      const recipients = await prisma.user_roles.findMany({
        where: {
          organization_id: organizationId,
          is_active: true,
          roles: {
            name: { in: targetRoles },
            is_active: true
          },
          users: {
            is_active: true,
            email: { not: null }
          },
          OR: [
            { valid_until: null },
            { valid_until: { gt: new Date() } }
          ]
        },
        include: {
          users: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
              notification_preferences: true
            }
          },
          roles: {
            select: {
              name: true,
              color: true,
              icon: true
            }
          },
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
        },
        orderBy: [
          { roles: { sort_order: 'asc' } },
          { users: { full_name: 'asc' } }
        ]
      });

      // Process recipients and filter based on notification preferences
      const processedRecipients = recipients.map(r => {
        const notifPrefs = r.users.notification_preferences || {};
        const warningCategory = warningType ? this.getWarningCategory(warningType) : 'general';
        
        // Check if user wants notifications for this warning category
        const categoryEnabled = notifPrefs[`${warningCategory}_notifications`] !== false;
        const emailEnabled = notifPrefs.email_notifications !== false;
        const smsEnabled = notifPrefs.sms_notifications === true;

        return {
          user_id: r.users.id,
          full_name: r.users.full_name,
          email: r.users.email,
          phone: r.users.phone,
          role_name: r.roles.name,
          role_color: r.roles.color,
          role_icon: r.roles.icon,
          organization_name: r.organizations.name,
          department_name: r.departments?.name,
          escalation_level: escalationLevel,
          notification_methods: {
            email: emailEnabled && categoryEnabled,
            sms: smsEnabled && categoryEnabled && r.users.phone
          },
          preferences: notifPrefs
        };
      });

      // Remove duplicates (same user might have multiple roles)
      const uniqueRecipients = processedRecipients.reduce((acc, recipient) => {
        const existing = acc.find(r => r.user_id === recipient.user_id);
        if (!existing) {
          acc.push(recipient);
        } else {
          // Keep the one with higher priority role (lower sort order)
          // Merge notification methods
          existing.notification_methods.email = existing.notification_methods.email || recipient.notification_methods.email;
          existing.notification_methods.sms = existing.notification_methods.sms || recipient.notification_methods.sms;
        }
        return acc;
      }, []);

      console.log(`📧 Found ${uniqueRecipients.length} notification recipients for escalation level ${escalationLevel}`);
      return uniqueRecipients;
    } catch (error) {
      console.error('Error getting notification recipients:', error);
      return [];
    }
  }

  /**
   * Get notification schedule based on escalation level
   * @param {number} escalationLevel - Escalation level (1-5)
   * @returns {Array} Array of notification timing (in minutes)
   */
  getNotificationSchedule(escalationLevel) {
    const schedules = {
      1: [0, 1, 5, 15],           // Immediate, 1min, 5min, 15min
      2: [0, 5, 15, 30],          // Immediate, 5min, 15min, 30min  
      3: [0, 5, 15, 30, 60],      // Immediate, 5min, 15min, 30min, 1hr
      4: [0, 15, 30, 60, 120],    // Immediate, 15min, 30min, 1hr, 2hr
      5: [0, 30, 60, 180]         // Immediate, 30min, 1hr, 3hr
    };

    return schedules[escalationLevel] || schedules[5];
  }

  /**
   * Check if user should receive warning notification
   * @param {string} userId - User UUID
   * @param {string} warningType - Warning type
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<Object>} Notification decision
   */
  async shouldNotifyUser(userId, warningType, organizationId) {
    try {
      // Get user's roles and escalation level
      const userRoles = await this.getUserActiveRoles(userId, organizationId);
      const escalationLevel = await this.getRoleEscalationLevel(userId, warningType, organizationId);
      
      // Get user notification preferences
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          notification_preferences: true,
          is_active: true
        }
      });

      if (!user || !user.is_active) {
        return {
          should_notify: false,
          reason: 'User not found or inactive'
        };
      }

      const notifPrefs = user.notification_preferences || {};
      const warningCategory = this.getWarningCategory(warningType);
      
      // Check category-specific preferences
      const categoryEnabled = notifPrefs[`${warningCategory}_notifications`] !== false;
      const globalEnabled = notifPrefs.notifications_enabled !== false;

      return {
        should_notify: globalEnabled && categoryEnabled,
        escalation_level: escalationLevel,
        warning_category: warningCategory,
        user_roles: userRoles.map(r => r.name),
        preferences: {
          global_enabled: globalEnabled,
          category_enabled: categoryEnabled,
          email_enabled: notifPrefs.email_notifications !== false,
          sms_enabled: notifPrefs.sms_notifications === true
        }
      };
    } catch (error) {
      console.error('Error checking notification eligibility:', error);
      return {
        should_notify: false,
        reason: 'Error checking preferences'
      };
    }
  }
}

export default new RoleService();