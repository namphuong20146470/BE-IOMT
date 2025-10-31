import permissionService from '../services/PermissionService.js';

/**
 * Permission Cache Management Middleware
 * Auto-invalidates cache when roles/permissions are modified
 */

/**
 * Middleware to invalidate user permission cache after role/permission changes
 * Use this on routes that modify user roles or permissions
 */
const invalidatePermissionCache = (options = {}) => {
    return (req, res, next) => {
        // Store original res.json to intercept response
        const originalJson = res.json;
        
        res.json = function(data) {
            // Only invalidate on successful operations
            if (data.success !== false) {
                try {
                    const { userId, userIds, clearAll } = options;
                    
                    // Option 1: Clear specific user (from options)
                    if (userId) {
                        permissionService.invalidateUserCache(userId);
                        console.log(`🧹 Auto-invalidated cache for user: ${userId}`);
                    }
                    
                    // Option 2: Clear multiple users (from options)
                    else if (userIds && Array.isArray(userIds)) {
                        userIds.forEach(id => {
                            permissionService.invalidateUserCache(id);
                        });
                        console.log(`🧹 Auto-invalidated cache for ${userIds.length} users`);
                    }
                    
                    // Option 3: Clear all users (for system-wide changes)
                    else if (clearAll) {
                        permissionService.clearAllCache();
                        console.log('🧹 Auto-invalidated all permission cache');
                    }
                    
                    // Option 4: Extract user ID from request/response
                    else {
                        const targetUserId = req.params.userId || 
                                           req.body.user_id || 
                                           req.params.id ||
                                           data.data?.user_id;
                                           
                        if (targetUserId) {
                            permissionService.invalidateUserCache(targetUserId);
                            console.log(`🧹 Auto-invalidated cache for user: ${targetUserId}`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error invalidating permission cache:', error);
                }
            }
            
            // Call original json method
            originalJson.call(this, data);
        };
        
        next();
    };
};

/**
 * Invalidate cache for specific user
 * @param {string} userId - User ID
 */
const invalidateUser = (userId) => {
    return invalidatePermissionCache({ userId });
};

/**
 * Invalidate cache for multiple users
 * @param {string[]} userIds - Array of user IDs
 */
const invalidateUsers = (userIds) => {
    return invalidatePermissionCache({ userIds });
};

/**
 * Clear all permission cache (use for system-wide permission changes)
 */
const clearAllCache = () => {
    return invalidatePermissionCache({ clearAll: true });
};

/**
 * Extract user IDs from request body/params and invalidate
 * Useful for dynamic scenarios
 */
const autoInvalidate = (req, res, next) => {
    return invalidatePermissionCache()(req, res, next);
};

export {
    invalidatePermissionCache,
    invalidateUser,
    invalidateUsers,
    clearAllCache,
    autoInvalidate
};