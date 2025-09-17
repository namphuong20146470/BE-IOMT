#!/usr/bin/env node

/**
 * Permission System Migration Script
 * This script migrates the existing IoMT system to the new permission-based system
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting Permission System Migration...\n');

  try {
    // Read migration SQL file
    const migrationSqlPath = path.join(__dirname, 'permission_system_migration.sql');
    const migrationSql = await fs.readFile(migrationSqlPath, 'utf8');

    console.log('📝 Executing migration SQL...');
    
    // Split SQL by semicolons and execute each statement
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executedCount = 0;
    
    for (const statement of statements) {
      try {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement + ';');
          executedCount++;
          
          // Log progress for major operations
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
            console.log(`  ✅ Created table: ${tableName}`);
          } else if (statement.includes('INSERT INTO permission_groups')) {
            console.log(`  ✅ Seeded permission groups`);
          } else if (statement.includes('INSERT INTO permissions')) {
            console.log(`  ✅ Seeded core permissions`);
          } else if (statement.includes('INSERT INTO roles')) {
            console.log(`  ✅ Created system roles`);
          }
        }
      } catch (error) {
        if (!error.message.includes('already exists') && 
            !error.message.includes('duplicate key') &&
            !error.message.includes('violates unique constraint')) {
          console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`);
          console.error(`   Error: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 Executed ${executedCount} SQL statements`);

    // Verify migration results
    console.log('\n🔍 Verifying migration results...');
    await verifyMigration();

    // Create first admin user if none exists
    await createDefaultAdminUser();

    // Test permission system
    await testPermissionSystem();

    console.log('\n🎉 Permission System Migration completed successfully!\n');
    
    // Print usage instructions
    printUsageInstructions();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyMigration() {
  try {
    const [
      groupCount,
      permissionCount,
      roleCount,
      userCount,
      orgSettings
    ] = await Promise.all([
      prisma.permission_groups.count(),
      prisma.permissions.count(),
      prisma.roles.count({ where: { is_system_role: true } }),
      prisma.users.count(),
      prisma.organization_settings.count()
    ]);

    console.log(`  ✅ Permission Groups: ${groupCount}`);
    console.log(`  ✅ Permissions: ${permissionCount}`);
    console.log(`  ✅ System Roles: ${roleCount}`);
    console.log(`  ✅ Users in users: ${userCount}`);
    console.log(`  ✅ Organization Settings: ${orgSettings}`);

    // Check if core permissions exist
    const corePermissions = ['user.read', 'device.read', 'alert.read', 'organization.read'];
    for (const perm of corePermissions) {
      const exists = await prisma.permissions.findFirst({
        where: { name: perm }
      });
      if (exists) {
        console.log(`  ✅ Core permission exists: ${perm}`);
      } else {
        console.log(`  ⚠️  Core permission missing: ${perm}`);
      }
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function createDefaultAdminUser() {
  try {
    console.log('\n👤 Checking for admin users...');

    // Check if any user has Super Admin role
    const adminUsers = await prisma.user_roles.findMany({
      where: {
        roles: {
          name: 'Super Admin',
          is_system_role: true
        }
      },
      include: {
        users: true,
        roles: true
      }
    });

    if (adminUsers.length > 0) {
      console.log(`  ✅ Found ${adminUsers.length} admin user(s):`);
      adminUsers.forEach(admin => {
        console.log(`     - ${admin.users.username} (${admin.users.full_name})`);
      });
      return;
    }

    // Check if there are any users at all
    const anyUser = await prisma.users.findFirst({
      include: {
        organizations: true
      }
    });

    if (!anyUser) {
      console.log('  ⚠️  No users found in users. Admin user will need to be created manually.');
      return;
    }

    // Assign Super Admin role to the first user
    const superAdminRole = await prisma.roles.findFirst({
      where: {
        name: 'Super Admin',
        is_system_role: true
      }
    });

    if (superAdminRole && anyUser.organization_id) {
      await prisma.user_roles.create({
        data: {
          user_id: anyUser.id,
          role_id: superAdminRole.id,
          organization_id: anyUser.organization_id,
          notes: 'Auto-assigned during migration - first user'
        }
      });

      console.log(`  ✅ Assigned Super Admin role to: ${anyUser.username} (${anyUser.full_name})`);
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

async function testPermissionSystem() {
  try {
    console.log('\n🧪 Testing permission system...');

    // Test with a user who has permissions
    const testUser = await prisma.users.findFirst({
      include: {
        user_roles: {
          include: {
            roles: {
              include: {
                role_permissions: {
                  include: {
                    permissions: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!testUser) {
      console.log('  ⚠️  No test user found, skipping permission test');
      return;
    }

    // Count user's permissions
    let totalPermissions = 0;
    testUser.user_roles.forEach(userRole => {
      totalPermissions += userRole.roles.role_permissions.length;
    });

    console.log(`  ✅ Test user: ${testUser.username}`);
    console.log(`  ✅ User has ${testUser.user_roles.length} role(s)`);
    console.log(`  ✅ Total permissions: ${totalPermissions}`);

    // Test permission function
    const hasDeviceRead = await prisma.$queryRaw`
      SELECT user_has_permission(${testUser.id}::uuid, 'device.read') as has_permission
    `;

    console.log(`  ✅ Can read devices: ${hasDeviceRead[0]?.has_permission || false}`);

  } catch (error) {
    console.error('❌ Permission test failed:', error);
  }
}

function printUsageInstructions() {
  console.log('📚 Next Steps:');
  console.log('');
  console.log('1. 🔄 Regenerate Prisma Client:');
  console.log('   npm run prisma:generate');
  console.log('');
  console.log('2. 🚀 Restart your application to use the new permission system');
  console.log('');
  console.log('3. 👥 User Management:');
  console.log('   - Users can now be assigned roles and permissions');
  console.log('   - Use the new authMiddleware with requirePermission()');
  console.log('   - Session management is available via sessionManager');
  console.log('');
  console.log('4. 🔐 Available Permissions:');
  console.log('   - user.* (create, read, update, delete, list, manage)');
  console.log('   - device.* (create, read, update, delete, manage, configure)');
  console.log('   - alert.* (read, acknowledge, resolve, create, manage)');
  console.log('   - organization.* (create, read, update, delete, manage)');
  console.log('   - department.* (create, read, update, delete, manage)');
  console.log('   - role.* (create, read, update, delete, assign, manage)');
  console.log('   - report.* (view, create, export, manage)');
  console.log('   - system.* (audit, settings, backup, maintenance)');
  console.log('');
  console.log('5. 🔧 Example Usage in Routes:');
  console.log('   import { requirePermission } from "./middleware/authMiddleware.js";');
  console.log('   router.get("/devices", requirePermission("device.read"), getAllDevices);');
  console.log('   router.post("/devices", requirePermission("device.create"), createDevice);');
  console.log('');
  console.log('6. 🕰️  Scheduled Maintenance:');
  console.log('   Set up a cron job to run: SELECT daily_permission_maintenance();');
  console.log('');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Permission System Migration Script');
  console.log('');
  console.log('Usage: node migrate-permissions.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --verify-only  Only verify migration, don\'t run migration');
  console.log('');
  process.exit(0);
}

if (args.includes('--verify-only')) {
  console.log('🔍 Verification Mode - Checking migration status...\n');
  verifyMigration().then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
} else {
  // Run full migration
  runMigration();
}