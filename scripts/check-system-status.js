#!/usr/bin/env node

/**
 * 🔍 IoMT System Status Checker
 * 
 * Script kiểm tra tình trạng hệ thống và validate setup
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const prisma = new PrismaClient();

console.log('🔍 IoMT System Status Check...\n');

async function checkSystemStatus() {
    const status = {
        timestamp: new Date().toISOString(),
        overall: 'UNKNOWN',
        checks: []
    };

    try {
        // 1. Database Connection
        console.log('📋 Checking Database Connection...');
        try {
            await prisma.$connect();
            await prisma.$queryRaw`SELECT 1 as test`;
            status.checks.push({ name: 'Database Connection', status: 'OK', message: 'Connected successfully' });
            console.log('   ✅ Database: Connected');
        } catch (error) {
            status.checks.push({ name: 'Database Connection', status: 'FAIL', message: error.message });
            console.log('   ❌ Database: Connection failed');
        }

        // 2. Check Tables Exist
        console.log('\n📊 Checking Database Schema...');
        const requiredTables = ['users', 'roles', 'permissions', 'device', 'organizations', 'departments'];
        
        for (const table of requiredTables) {
            try {
                const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
                status.checks.push({ name: `Table: ${table}`, status: 'OK', message: 'Table exists' });
                console.log(`   ✅ Table ${table}: Exists`);
            } catch (error) {
                status.checks.push({ name: `Table: ${table}`, status: 'FAIL', message: 'Table missing or inaccessible' });
                console.log(`   ❌ Table ${table}: Missing or inaccessible`);
            }
        }

        // 3. Check Data Integrity
        console.log('\n📈 Checking Data Integrity...');
        
        const userCount = await prisma.users.count();
        const roleCount = await prisma.roles.count();
        const permissionCount = await prisma.permissions.count();
        const deviceCount = await prisma.device.count();
        const orgCount = await prisma.organizations.count();
        const deptCount = await prisma.departments.count();

        console.log(`   👥 Users: ${userCount}`);
        console.log(`   👑 Roles: ${roleCount}`);
        console.log(`   🔑 Permissions: ${permissionCount}`);
        console.log(`   🏥 Organizations: ${orgCount}`);
        console.log(`   🏢 Departments: ${deptCount}`);
        console.log(`   📱 Devices: ${deviceCount}`);

        // Validate minimum required data
        if (userCount === 0) {
            status.checks.push({ name: 'User Data', status: 'WARN', message: 'No users found. Run setup script.' });
            console.log('   ⚠️  No users found - system may not be initialized');
        } else {
            status.checks.push({ name: 'User Data', status: 'OK', message: `${userCount} users found` });
        }

        if (roleCount === 0) {
            status.checks.push({ name: 'Role Data', status: 'WARN', message: 'No roles found. Run setup script.' });
            console.log('   ⚠️  No roles found - RBAC not configured');
        } else {
            status.checks.push({ name: 'Role Data', status: 'OK', message: `${roleCount} roles found` });
        }

        // 4. Check Default Admin Users
        console.log('\n👤 Checking Admin Users...');
        
        const adminUsers = await prisma.users.findMany({
            where: {
                OR: [
                    { username: 'superadmin' },
                    { username: 'admin' }
                ]
            },
            select: {
                username: true,
                is_active: true,
                created_at: true
            }
        });

        if (adminUsers.length === 0) {
            status.checks.push({ name: 'Admin Users', status: 'FAIL', message: 'No admin users found' });
            console.log('   ❌ No admin users found');
        } else {
            adminUsers.forEach(user => {
                console.log(`   ✅ Admin user: ${user.username} (active: ${user.is_active})`);
            });
            status.checks.push({ name: 'Admin Users', status: 'OK', message: `${adminUsers.length} admin users found` });
        }

        // 5. Check Environment Variables
        console.log('\n⚙️ Checking Environment Configuration...');
        
        const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET', 'DATABASE_URL', 'PORT'];
        const missingEnvVars = [];

        requiredEnvVars.forEach(envVar => {
            if (process.env[envVar]) {
                console.log(`   ✅ ${envVar}: Configured`);
            } else {
                console.log(`   ❌ ${envVar}: Missing`);
                missingEnvVars.push(envVar);
            }
        });

        if (missingEnvVars.length === 0) {
            status.checks.push({ name: 'Environment Variables', status: 'OK', message: 'All required variables set' });
        } else {
            status.checks.push({ name: 'Environment Variables', status: 'FAIL', message: `Missing: ${missingEnvVars.join(', ')}` });
        }

        // 6. Check File Permissions
        console.log('\n📁 Checking File System...');
        
        const criticalPaths = [
            { path: './logs', required: true },
            { path: './docs', required: true },
            { path: './tests', required: true },
            { path: './scripts', required: true },
            { path: './prisma/schema.prisma', required: true }
        ];

        criticalPaths.forEach(({ path, required }) => {
            if (fs.existsSync(path)) {
                console.log(`   ✅ ${path}: Exists`);
            } else {
                console.log(`   ${required ? '❌' : '⚠️'} ${path}: Missing`);
                status.checks.push({
                    name: `File System: ${path}`,
                    status: required ? 'FAIL' : 'WARN',
                    message: 'Path missing'
                });
            }
        });

        // 7. Overall Status
        console.log('\n📊 Overall System Status...');
        
        const failures = status.checks.filter(check => check.status === 'FAIL');
        const warnings = status.checks.filter(check => check.status === 'WARN');

        if (failures.length === 0 && warnings.length === 0) {
            status.overall = 'HEALTHY';
            console.log('   🎉 System Status: HEALTHY');
        } else if (failures.length === 0) {
            status.overall = 'HEALTHY_WITH_WARNINGS';
            console.log(`   ⚠️  System Status: HEALTHY WITH WARNINGS (${warnings.length})`);
        } else {
            status.overall = 'UNHEALTHY';
            console.log(`   ❌ System Status: UNHEALTHY (${failures.length} failures, ${warnings.length} warnings)`);
        }

        // 8. Recommendations
        console.log('\n💡 Recommendations:');
        
        if (failures.length > 0) {
            console.log('🚨 CRITICAL ISSUES:');
            failures.forEach(failure => {
                console.log(`   - ${failure.name}: ${failure.message}`);
            });
        }

        if (warnings.length > 0) {
            console.log('⚠️  WARNINGS:');
            warnings.forEach(warning => {
                console.log(`   - ${warning.name}: ${warning.message}`);
            });
        }

        if (userCount === 0 || roleCount === 0) {
            console.log('\n🛠️  To initialize system:');
            console.log('   node scripts/setup-complete-system.js');
        }

        if (status.overall === 'HEALTHY') {
            console.log('\n🚀 System is ready for use!');
            console.log('   - Start server: npm run dev');
            console.log('   - Access Swagger: http://localhost:3030/secure-api-docs');
        }

        // Save status report
        const reportPath = './logs/system-status.json';
        fs.writeFileSync(reportPath, JSON.stringify(status, null, 2));
        console.log(`\n📋 Status report saved: ${reportPath}`);

        return status;

    } catch (error) {
        console.error('\n❌ Status check failed:', error.message);
        status.overall = 'ERROR';
        status.checks.push({ name: 'System Check', status: 'FAIL', message: error.message });
        return status;
    } finally {
        await prisma.$disconnect();
    }
}

// Run status check
checkSystemStatus()
    .then(status => {
        process.exit(status.overall === 'HEALTHY' ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });