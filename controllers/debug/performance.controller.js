/**
 * 📊 Performance Test & Cache Monitoring Endpoint
 * Test and monitor the performance improvements
 */

import permissionCache from '../utils/permissionCache.js';
import { getUserAllPermissions } from '../utils/permissionHelpers.js';

/**
 * Test permission loading performance
 * @route GET /debug/performance/permissions
 */
export const testPermissionPerformance = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not available in production' });
    }

    try {
        const { userId, iterations = 10 } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId parameter required' });
        }

        console.log(`🧪 Testing permission performance for user ${userId} with ${iterations} iterations...`);

        // Test 1: Direct database calls (no cache)
        const dbTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await getUserAllPermissions(userId);
            const end = Date.now();
            dbTimes.push(end - start);
        }

        // Clear cache to ensure fair test
        permissionCache.invalidate(userId);

        // Test 2: Cached calls
        const cachedTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await permissionCache.getPermissions(userId);
            const end = Date.now();
            cachedTimes.push(end - start);
        }

        // Calculate statistics
        const dbAvg = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;
        const cachedAvg = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;
        const improvement = ((dbAvg - cachedAvg) / dbAvg * 100).toFixed(2);

        const stats = {
            test_config: {
                user_id: userId,
                iterations: parseInt(iterations),
                timestamp: new Date().toISOString()
            },
            database_only: {
                times_ms: dbTimes,
                average_ms: dbAvg.toFixed(2),
                min_ms: Math.min(...dbTimes),
                max_ms: Math.max(...dbTimes)
            },
            with_cache: {
                times_ms: cachedTimes,
                average_ms: cachedAvg.toFixed(2),
                min_ms: Math.min(...cachedTimes),
                max_ms: Math.max(...cachedTimes)
            },
            performance_gain: {
                improvement_percentage: improvement + '%',
                faster_by_ms: (dbAvg - cachedAvg).toFixed(2),
                cache_effectiveness: cachedTimes[0] > cachedTimes[1] ? 'Working (first miss, then hits)' : 'All cached'
            },
            cache_stats: permissionCache.getStats()
        };

        return res.json({
            success: true,
            data: stats,
            message: `Cache provides ${improvement}% performance improvement`
        });

    } catch (error) {
        console.error('Performance test error:', error);
        return res.status(500).json({
            success: false,
            error: 'Performance test failed',
            details: error.message
        });
    }
};

/**
 * Get cache statistics
 * @route GET /debug/cache/stats
 */
export const getCacheStats = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not available in production' });
    }

    try {
        const stats = permissionCache.getStats();
        
        return res.json({
            success: true,
            data: {
                cache_statistics: stats,
                recommendations: {
                    hit_rate: stats.validEntries > 0 ? 
                        `${((stats.validEntries / stats.totalEntries) * 100).toFixed(2)}%` : 
                        'No valid entries',
                    memory_usage: stats.memoryUsage.mb > 10 ? 
                        'Consider reducing cache size' : 
                        'Memory usage OK',
                    expired_entries: stats.expiredEntries > stats.totalEntries * 0.3 ? 
                        'High expired entries - cleanup needed' : 
                        'Expired entries normal'
                }
            },
            message: 'Cache statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Cache stats error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get cache stats',
            details: error.message
        });
    }
};

/**
 * Clear permission cache
 * @route DELETE /debug/cache/clear
 */
export const clearCache = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not available in production' });
    }

    try {
        const cleared = permissionCache.clear();
        
        return res.json({
            success: true,
            data: {
                entries_cleared: cleared,
                timestamp: new Date().toISOString()
            },
            message: `Cleared ${cleared} cache entries`
        });

    } catch (error) {
        console.error('Cache clear error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear cache',
            details: error.message
        });
    }
};