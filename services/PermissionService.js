import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import roleService from './RoleService.js';

const prisma = new PrismaClient();

class PermissionService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour in milliseconds
  }

  /**
   * Get user permissions with caching
   * @param {string} userId - User UUID
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<Object>} User permissions object
   */
  async getUserPermissions(userId, useCache = true) {
    if (useCache) {
      const cached = await this.getCachedPermissions(userId);
      if (cached) return cached;
    }

    const permissions = await this.computeUserPermissions(userId);
    await this.cachePermissions(userId, permissions);
    
    return permissions;
  }

  /**
   * Compute permissions from roles + direct permissions
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Computed permissions
   */
  async computeUserPermissions(userId) {
    try {
      console.log(`🔍 Computing permissions for user: ${userId}`);
      
      const [rolePerms, directPerms, resourceAccess] = await Promise.all([
        this.getRoleBasedPermissions(userId),
        this.getDirectPermissions(userId),
        this.getResourceAccess(userId)
      ]);

      const result = {
        user_id: userId,
        roles: rolePerms,
        direct: directPerms,
        resources: resourceAccess,
        computed_at: new Date(),
        expires_at: new Date(Date.now() + this.cacheTimeout)
      };

      console.log(`✅ Computed ${rolePerms.length} role permissions, ${directPerms.length} direct permissions for user ${userId}`);
      return result;
    } catch (error) {
      console.error('Error computing user permissions:', error);
      throw error;
    }
  }

  /**
   * Get role-based permissions for user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Array of role permissions
   */
  async getRoleBasedPermissions(userId) {
    try {
      // Use RoleService to get user's active roles with permissions
      const userRoles = await roleService.getUserActiveRoles(userId);
      
      const rolePermissions = [];
      
      for (const userRole of userRoles) {
        // Get inherited permissions for each role
        const permissions = await roleService.getInheritedPermissions(userRole.id);
        
        rolePermissions.push({
          role_id: userRole.id,
          role_name: userRole.name,
          organization_id: userRole.organization?.id,
          organization_name: userRole.organization?.name,
          department_id: userRole.department?.id,
          department_name: userRole.department?.name,
          permissions: permissions.map(p => ({
            name: p.name,
            resource: p.resource,
            action: p.action,
            priority: p.priority || 0,
            inherited_from: p.inherited_from
          })),
          valid_from: userRole.valid_from,
          valid_until: userRole.valid_until
        });
      }

      return rolePermissions;
    } catch (error) {
      console.error('Error getting role-based permissions:', error);
      return [];
    }
  }

  /**
   * Get direct permissions for user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Array of direct permissions
   */
  async getDirectPermissions(userId) {
    try {
      const userPermissions = await prisma.user_permissions.findMany({
        where: {
          user_id: userId,
          is_active: true,
          OR: [
            { valid_until: null },
            { valid_until: { gt: new Date() } }
          ]
        },
        include: {
          permissions: true,
          granted_by_user: true
        }
      });

      return userPermissions.map(up => ({
        permission_id: up.permissions.id,
        name: up.permissions.name,
        resource: up.permissions.resource,
        action: up.permissions.action,
        priority: up.permissions.priority || 0,
        granted_by: up.granted_by_user?.full_name,
        granted_at: up.granted_at,
        valid_from: up.valid_from,
        valid_until: up.valid_until
      }));
    } catch (error) {
      console.error('Error getting direct permissions:', error);
      return [];
    }
  }

  /**
   * Get resource access for user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Array of resource access
   */
  async getResourceAccess(userId) {
    try {
      const resourceAccess = await prisma.resource_access.findMany({
        where: {
          user_id: userId
        }
      });

      return resourceAccess.map(ra => ({
        resource_type: ra.resource_type,
        resource_id: ra.resource_id,
        access_level: ra.access_level
      }));
    } catch (error) {
      console.error('Error getting resource access:', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   * @param {string} userId - User UUID
   * @param {string} permission - Permission name
   * @param {string} resourceType - Resource type (optional)
   * @param {string} resourceId - Resource ID (optional)
   * @returns {Promise<boolean>} Has permission
   */
  async hasPermission(userId, permission, resourceType = null, resourceId = null) {
    try {
      console.log(`🔍 Checking permission '${permission}' for user ${userId}`);
      
      const userPerms = await this.getUserPermissions(userId);
      
      // Check direct permissions
      const directMatch = userPerms.direct.some(perm => perm.name === permission);
      if (directMatch) {
        console.log(`✅ Permission granted via direct permission`);
        return true;
      }
      
      // Check role-based permissions
      const roleMatch = userPerms.roles.some(role => 
        role.permissions.some(perm => perm.name === permission)
      );
      if (roleMatch) {
        console.log(`✅ Permission granted via role`);
        return true;
      }
      
      // Check resource-specific access
      if (resourceType && resourceId) {
        const hasResourceAccess = this.hasResourceAccess(
          userPerms.resources, 
          resourceType, 
          resourceId, 
          permission
        );
        if (hasResourceAccess) {
          console.log(`✅ Permission granted via resource access`);
          return true;
        }
      }
      
      console.log(`❌ Permission denied`);
      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check resource access
   * @param {Array} resources - User's resource access array
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {string} permission - Permission name
   * @returns {boolean} Has access
   */
  hasResourceAccess(resources, resourceType, resourceId, permission) {
    const resource = resources.find(r => 
      r.resource_type === resourceType && r.resource_id === resourceId
    );
    
    if (!resource) return false;
    
    // Map permission actions to access levels
    const accessMapping = {
      'read': ['read', 'write', 'admin'],
      'create': ['write', 'admin'],
      'update': ['write', 'admin'],
      'delete': ['admin'],
      'manage': ['admin']
    };
    
    const action = permission.split('.')[1]; // Extract action from 'resource.action'
    const requiredLevels = accessMapping[action] || ['admin'];
    
    return requiredLevels.includes(resource.access_level);
  }

  /**
   * Get cached permissions for user
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} Cached permissions or null
   */
  async getCachedPermissions(userId) {
    try {
      // Check memory cache first
      const memoryCache = this.cache.get(userId);
      if (memoryCache && memoryCache.expires_at > new Date()) {
        console.log(`📋 Using memory cache for user ${userId}`);
        return memoryCache;
      }

      // Check database cache
      const dbCache = await prisma.$queryRaw`
        SELECT permission_hash, permissions_json, expires_at
        FROM user_permission_cache 
        WHERE user_id = ${userId}::uuid 
        AND expires_at > CURRENT_TIMESTAMP
      `;

      if (dbCache.length > 0) {
        console.log(`📋 Using database cache for user ${userId}`);
        const cached = dbCache[0].permissions_json;
        // Store in memory cache
        this.cache.set(userId, cached);
        return cached;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached permissions:', error);
      return null;
    }
  }

  /**
   * Cache permissions for user
   * @param {string} userId - User UUID
   * @param {Object} permissions - Permissions object
   */
  async cachePermissions(userId, permissions) {
    try {
      const hash = this.generatePermissionHash(permissions);
      const expiresAt = new Date(Date.now() + this.cacheTimeout);

      // Store in memory cache
      this.cache.set(userId, {
        ...permissions,
        expires_at: expiresAt
      });

      // Store in database cache
      await prisma.$executeRaw`
        INSERT INTO user_permission_cache (user_id, permission_hash, permissions_json, expires_at)
        VALUES (${userId}::uuid, ${hash}, ${JSON.stringify(permissions)}::jsonb, ${expiresAt})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          permission_hash = EXCLUDED.permission_hash,
          permissions_json = EXCLUDED.permissions_json,
          expires_at = EXCLUDED.expires_at,
          created_at = CURRENT_TIMESTAMP
      `;

      console.log(`💾 Cached permissions for user ${userId}`);
    } catch (error) {
      console.error('Error caching permissions:', error);
    }
  }

  /**
   * Generate hash for permissions object
   * @param {Object} permissions - Permissions object
   * @returns {string} Hash string
   */
  generatePermissionHash(permissions) {
    const content = JSON.stringify({
      roles: permissions.roles.map(r => r.role_id),
      direct: permissions.direct.map(p => p.permission_id),
      resources: permissions.resources
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Invalidate user permissions cache
   * @param {string} userId - User UUID
   */
  async invalidateUserCache(userId) {
    try {
      // Remove from memory cache
      this.cache.delete(userId);

      // Remove from database cache
      await prisma.$executeRaw`
        DELETE FROM user_permission_cache 
        WHERE user_id = ${userId}::uuid
      `;

      console.log(`🗑️ Invalidated cache for user ${userId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Cleanup expired caches
   */
  async cleanupExpiredCaches() {
    try {
      // Cleanup memory cache
      for (const [userId, cache] of this.cache.entries()) {
        if (cache.expires_at <= new Date()) {
          this.cache.delete(userId);
        }
      }

      // Cleanup database cache
      const result = await prisma.$executeRaw`
        DELETE FROM user_permission_cache 
        WHERE expires_at < CURRENT_TIMESTAMP
      `;

      console.log(`🧹 Cleaned up expired caches`);
      return result;
    } catch (error) {
      console.error('Error cleaning up caches:', error);
    }
  }

  /**
   * Get all permissions for a permission group
   * @param {string} groupId - Permission group UUID
   * @returns {Promise<Array>} Array of permissions
   */
  async getPermissionsByGroup(groupId) {
    try {
      const permissions = await prisma.permissions.findMany({
        where: {
          group_id: groupId,
          is_active: true
        },
        orderBy: [
          { priority: 'desc' },
          { name: 'asc' }
        ]
      });

      return permissions;
    } catch (error) {
      console.error('Error getting permissions by group:', error);
      return [];
    }
  }

  /**
   * Create new permission
   * @param {Object} permissionData - Permission data
   * @returns {Promise<Object>} Created permission
   */
  async createPermission(permissionData) {
    try {
      const permission = await prisma.permissions.create({
        data: {
          name: permissionData.name,
          description: permissionData.description,
          resource: permissionData.resource,
          action: permissionData.action,
          group_id: permissionData.group_id,
          depends_on: permissionData.depends_on || [],
          conditions: permissionData.conditions || {},
          priority: permissionData.priority || 0
        }
      });

      console.log(`✅ Created permission: ${permission.name}`);
      return permission;
    } catch (error) {
      console.error('Error creating permission:', error);
      throw error;
    }
  }

  /**
   * Assign permission to user
   * @param {string} userId - User UUID
   * @param {string} permissionId - Permission UUID
   * @param {string} grantedBy - Granter user UUID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Assignment result
   */
  async assignPermissionToUser(userId, permissionId, grantedBy, options = {}) {
    try {
      const assignment = await prisma.user_permissions.create({
        data: {
          user_id: userId,
          permission_id: permissionId,
          granted_by: grantedBy,
          valid_from: options.valid_from || new Date(),
          valid_until: options.valid_until,
          notes: options.notes
        }
      });

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      console.log(`✅ Assigned permission to user ${userId}`);
      return assignment;
    } catch (error) {
      console.error('Error assigning permission:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   * @param {string} userId - User UUID
   * @param {string} roleId - Role UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} assignedBy - Assigner user UUID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Assignment result
   */
  async assignRoleToUser(userId, roleId, organizationId, assignedBy, options = {}) {
    try {
      // Use RoleService for role assignment with conflict checking
      const assignmentData = {
        user_id: userId,
        role_id: roleId,
        organization_id: organizationId,
        department_id: options.department_id,
        valid_from: options.valid_from,
        valid_until: options.valid_until,
        notes: options.notes
      };

      const result = await roleService.assignRoleToUser(assignmentData, assignedBy);

      if (result.success) {
        // Invalidate user cache
        await this.invalidateUserCache(userId);
        console.log(`✅ Assigned role via PermissionService to user ${userId}`);
      }

      return result;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }
}

export default new PermissionService();