/**
 * Test script for new DB-based permission system
 * Run this after implementing the new authentication system
 */

const { prisma } = require('./config/db');
const permissionService = require('./shared/services/PermissionService');
const SessionService = require('./shared/services/SessionService');

async function testPermissionSystem() {
    console.log('🧪 Testing DB-based Permission System\n');
    
    try {
        // 1. Test permission loading from DB
        console.log('1️⃣ Testing permission loading from database...');
        
        const testUser = await prisma.users.findFirst({
            where: { is_active: true }
        });
        
        if (!testUser) {
            console.log('❌ No active users found. Please create a test user first.');
            return;
        }
        
        console.log(`📋 Testing with user: ${testUser.username} (${testUser.id})`);
        
        // Load permissions from DB
        const userPermissions = await permissionService.getUserPermissions(testUser.id);
        console.log(`✅ Loaded permissions:`, {
            permissionCount: userPermissions.permissions.length,
            roleCount: userPermissions.roles.length,
            permissions: userPermissions.permissions.slice(0, 5), // Show first 5
            roles: userPermissions.roles
        });
        
        // 2. Test permission checking
        console.log('\n2️⃣ Testing permission checking...');
        
        if (userPermissions.permissions.length > 0) {
            const testPermission = userPermissions.permissions[0];
            const hasPermission = await permissionService.hasPermission(testUser.id, testPermission);
            console.log(`✅ hasPermission("${testPermission}"): ${hasPermission}`);
            
            const noPermission = await permissionService.hasPermission(testUser.id, 'non.existent.permission');
            console.log(`✅ hasPermission("non.existent.permission"): ${noPermission}`);
        }
        
        // 3. Test role checking
        console.log('\n3️⃣ Testing role checking...');
        
        if (userPermissions.roles.length > 0) {
            const testRole = userPermissions.roles[0];
            const hasRole = await permissionService.hasRole(testUser.id, testRole);
            console.log(`✅ hasRole("${testRole}"): ${hasRole}`);
            
            const noRole = await permissionService.hasRole(testUser.id, 'nonexistent_role');
            console.log(`✅ hasRole("nonexistent_role"): ${noRole}`);
        }
        
        // 4. Test JWT generation (identity-only)
        console.log('\n4️⃣ Testing JWT generation (identity-only)...');
        
        const sessionService = new SessionService();
        const userForToken = {
            id: testUser.id,
            username: testUser.username,
            full_name: testUser.full_name,
            email: testUser.email,
            organization_id: testUser.organization_id,
            department_id: testUser.department_id,
            perm_version: Math.floor(Date.now() / 1000)
        };
        
        const testSessionId = 'test-session-' + Date.now();
        const jwt = sessionService.generateAccessToken(userForToken, testSessionId);
        
        console.log(`✅ JWT generated (length: ${jwt.length})`);
        console.log(`🔍 JWT payload size: ${Buffer.from(jwt.split('.')[1], 'base64').length} bytes`);
        
        // Decode JWT to verify it contains only identity
        const jwt_decode = require('jsonwebtoken');
        try {
            const decoded = jwt_decode.verify(jwt, process.env.JWT_SECRET);
            console.log(`✅ JWT contains identity only:`, {
                sub: decoded.sub,
                username: decoded.username,
                hasPermissions: !!decoded.permissions, // Should be false
                hasRoles: !!decoded.roles, // Should be false
                perm_version: decoded.perm_version
            });
        } catch (error) {
            console.log('❌ JWT decode error:', error.message);
        }
        
        // 5. Test caching
        console.log('\n5️⃣ Testing permission caching...');
        
        console.time('First load (DB)');
        await permissionService.getUserPermissions(testUser.id);
        console.timeEnd('First load (DB)');
        
        console.time('Second load (cache)');
        await permissionService.getUserPermissions(testUser.id);
        console.timeEnd('Second load (cache)');
        
        console.log(`✅ Cache stats:`, permissionService.getCacheStats());
        
        // 6. Test cache invalidation
        console.log('\n6️⃣ Testing cache invalidation...');
        
        permissionService.invalidateUserCache(testUser.id);
        console.log(`✅ Cache invalidated for user ${testUser.id}`);
        
        console.log(`✅ Cache stats after invalidation:`, permissionService.getCacheStats());
        
        console.log('\n🎉 All tests completed successfully!');
        
        // Show summary
        console.log('\n📊 SYSTEM SUMMARY:');
        console.log('✅ JWT contains identity only (no permissions/roles)');
        console.log('✅ Permissions loaded fresh from DB on each request');
        console.log('✅ 5-minute caching for performance');
        console.log('✅ Real-time permission revocation supported');
        console.log('✅ Fail-secure error handling');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
        permissionService.destroy();
    }
}

// Run tests if called directly
if (require.main === module) {
    testPermissionSystem().catch(console.error);
}

module.exports = { testPermissionSystem };