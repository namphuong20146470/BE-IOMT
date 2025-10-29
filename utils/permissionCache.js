/**
 * 🚀 Permission Cache Service
 * Cache user permissions to reduce DB queries for better performance
 */

import { getUserAllPermissions } from './permissionHelpers.js';

class PermissionCache {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL
        this.maxCacheSize = 1000; // Maximum cache entries
        this.cleanupInterval = null;
        
        // Start periodic cleanup
        this.startCleanup();
    }

    /**
     * Get user permissions (from cache or database)
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} User permissions array
     */
    async getPermissions(userId) {
        const cached = this.cache.get(userId);
        const now = Date.now();

        // Return cached data if still valid
        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
            console.log(`🔥 Cache HIT for user ${userId}`);
            cached.lastAccessed = now; // Update access time
            return cached.permissions;
        }

        // Cache miss or expired - fetch from database
        console.log(`💾 Cache MISS for user ${userId} - fetching from DB`);
        
        try {
            const permissions = await getUserAllPermissions(userId);
            
            // Store in cache
            this.cache.set(userId, {
                permissions,
                timestamp: now,
                lastAccessed: now
            });

            // Cleanup if cache gets too large
            if (this.cache.size > this.maxCacheSize) {
                this.cleanupOldEntries();
            }

            return permissions;
        } catch (error) {
            console.error(`❌ Error fetching permissions for user ${userId}:`, error);
            
            // Return empty permissions on error (fail-safe)
            return [];
        }
    }

    /**
     * Invalidate cache for specific user
     * @param {string} userId - User UUID
     */
    invalidate(userId) {
        const deleted = this.cache.delete(userId);
        if (deleted) {
            console.log(`🗑️ Invalidated cache for user ${userId}`);
        }
        return deleted;
    }

    /**
     * Invalidate cache for multiple users (e.g., when role updated)
     * @param {Array<string>} userIds - Array of user UUIDs
     */
    invalidateMultiple(userIds) {
        let count = 0;
        for (const userId of userIds) {
            if (this.cache.delete(userId)) {
                count++;
            }
        }
        console.log(`🗑️ Invalidated cache for ${count} users`);
        return count;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🧹 Cleared all ${size} cache entries`);
        return size;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const [userId, data] of this.cache) {
            if ((now - data.timestamp) < this.CACHE_TTL) {
                validEntries++;
            } else {
                expiredEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            maxSize: this.maxCacheSize,
            ttlMs: this.CACHE_TTL,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Clean up expired entries
     */
    cleanupExpired() {
        const now = Date.now();
        let removed = 0;

        for (const [userId, data] of this.cache) {
            if ((now - data.timestamp) >= this.CACHE_TTL) {
                this.cache.delete(userId);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} expired cache entries`);
        }

        return removed;
    }

    /**
     * Clean up old entries when cache is full (LRU eviction)
     */
    cleanupOldEntries() {
        const entries = Array.from(this.cache.entries());
        
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest 20% of entries
        const toRemove = Math.floor(this.maxCacheSize * 0.2);
        let removed = 0;

        for (let i = 0; i < toRemove && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
            removed++;
        }

        console.log(`🧹 Evicted ${removed} old cache entries (LRU cleanup)`);
        return removed;
    }

    /**
     * Start periodic cleanup interval
     */
    startCleanup() {
        // Clean up expired entries every 2 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 2 * 60 * 1000);

        console.log('🔄 Started permission cache cleanup interval');
    }

    /**
     * Stop cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('⏹️ Stopped permission cache cleanup interval');
        }
    }

    /**
     * Estimate memory usage (rough calculation)
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        
        for (const [userId, data] of this.cache) {
            // Rough estimation: userId (36 bytes) + permissions array + metadata
            totalSize += 36; // UUID
            totalSize += JSON.stringify(data.permissions).length * 2; // Rough estimate for strings
            totalSize += 24; // timestamp + lastAccessed numbers
        }

        return {
            bytes: totalSize,
            kb: (totalSize / 1024).toFixed(2),
            mb: (totalSize / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Warm up cache for active users (optional optimization)
     * @param {Array<string>} userIds - User IDs to preload
     */
    async warmup(userIds) {
        console.log(`🔥 Warming up cache for ${userIds.length} users...`);
        
        const promises = userIds.map(userId => this.getPermissions(userId));
        
        try {
            await Promise.all(promises);
            console.log(`✅ Cache warmup completed for ${userIds.length} users`);
        } catch (error) {
            console.error('❌ Cache warmup failed:', error);
        }
    }
}

// Create singleton instance
const permissionCache = new PermissionCache();

// Graceful shutdown cleanup
process.on('SIGTERM', () => {
    permissionCache.stopCleanup();
});

process.on('SIGINT', () => {
    permissionCache.stopCleanup();
});

export default permissionCache;