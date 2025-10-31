import prisma from '../../config/db.js';

/**
 * SimplePermissionService - Lightweight permission checking from DB
 * Implements JWT + DB best practices:
 * - JWT contains only identity (no permissions/roles)
 * - Permissions always queried fresh from DB
 * - Simple caching for performance
 * - Real-time permission revocation support
 */
class SimplePermissionService {
  constructor() {
    // Simple in-memory cache with 5-minute TTL
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    // Clean expired cache every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 60 * 1000);
  }

  /**
   * Get user permissions from database with caching
   * @param {string} userId - User ID  
   * @returns {Promise<{permissions: string[], roles: string[]}>}
   */
  async getUserPermissions(userId) {
    const cacheKey = `user_${userId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      // Query fresh from database - optimized single query
      const userWithPermissions = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          user_roles: {
            where: {
              is_active: true,
              OR: [
                { valid_until: null },
                { valid_until: { gt: new Date() } }
              ]
            },
            select: {
              roles: {
                select: {
                  name: true,
                  role_permissions: {
                    select: {
                      permissions: {
                        select: {
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!userWithPermissions) {
        console.log(`❌ User ${userId} not found`);
        return { permissions: [], roles: [] };
      }

      // Extract unique permissions and roles
      const permissions = new Set();
      const roles = new Set();

      userWithPermissions.user_roles.forEach(userRole => {
        const role = userRole.roles;
        roles.add(role.name);
        
        role.role_permissions.forEach(rolePermission => {
          permissions.add(rolePermission.permissions.name);
        });
      });

      const result = {
        permissions: Array.from(permissions).sort(),
        roles: Array.from(roles).sort()
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.CACHE_TTL
      });

      console.log(`🔍 DB: Loaded ${result.permissions.length} permissions, ${result.roles.length} roles for user ${userId}`);
      return result;

    } catch (error) {
      console.error(`❌ Error loading permissions for user ${userId}:`, error);
      // Fail secure - return empty permissions on error
      return { permissions: [], roles: [] };
    }
  }

  /**
   * Check if user has specific permission
   * @param {string} userId - User ID
   * @param {string} permission - Permission name
   * @returns {Promise<boolean>}
   */
  async hasPermission(userId, permission) {
    try {
      const userPerms = await this.getUserPermissions(userId);
      return userPerms.permissions.includes(permission);
    } catch (error) {
      console.error(`❌ Error checking permission ${permission} for user ${userId}:`, error);
      return false; // Fail secure
    }
  }

  /**
   * Check if user has any of the specified permissions
   * @param {string} userId - User ID
   * @param {string[]} permissions - Array of permission names
   * @returns {Promise<boolean>}
   */
  async hasAnyPermission(userId, permissions) {
    try {
      const userPerms = await this.getUserPermissions(userId);
      return permissions.some(permission => 
        userPerms.permissions.includes(permission)
      );
    } catch (error) {
      console.error(`❌ Error checking permissions for user ${userId}:`, error);
      return false; // Fail secure
    }
  }

  /**
   * Check if user has specific role
   * @param {string} userId - User ID
   * @param {string} roleName - Role name
   * @returns {Promise<boolean>}
   */
  async hasRole(userId, roleName) {
    try {
      const userPerms = await this.getUserPermissions(userId);
      return userPerms.roles.includes(roleName);
    } catch (error) {
      console.error(`❌ Error checking role ${roleName} for user ${userId}:`, error);
      return false; // Fail secure
    }
  }

  /**
   * Invalidate cache for specific user (call when roles/permissions change)
   * @param {string} userId - User ID
   */
  invalidateUserCache(userId) {
    const cacheKey = `user_${userId}`;
    this.cache.delete(cacheKey);
    console.log(`🧹 Cache invalidated for user ${userId}`);
  }

  /**
   * Clear all cache (call on system-wide permission changes)
   */
  clearAllCache() {
    this.cache.clear();
    console.log('🧹 All permission cache cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object}
   */
  getCacheStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now < value.expiresAt) {
        active++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      ttl_ms: this.CACHE_TTL
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    console.log('🧹 SimplePermissionService destroyed');
  }
}

// Export singleton instance
const permissionService = new SimplePermissionService();
export default permissionService;