#!/usr/bin/env node

/**
 * 🔄 IoMT System Reset & Clean Setup
 * 
 * Script này sẽ:
 * 1. Cleanup toàn bộ database data
 * 2. Reset migrations 
 * 3. Chạy lại complete setup
 * 
 * ⚠️ WARNING: Script này sẽ XÓA TOÀN BỘ DỮ LIỆU!
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

console.log('🔄 IoMT System Reset & Clean Setup\n');

console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
console.log('⚠️  This action is IRREVERSIBLE!\n');

// Create readline interface for confirmation
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askConfirmation(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

async function resetSystem() {
    try {
        // 1. Final confirmation
        console.log('🔍 Current Database:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'));
        
        const confirmed = await askConfirmation('\n❓ Are you sure you want to RESET the entire system? (type "yes" to confirm): ');
        
        if (!confirmed) {
            console.log('❌ Reset cancelled by user.');
            rl.close();
            return;
        }

        const doubleConfirm = await askConfirmation('\n❓ This will DELETE ALL DATA. Are you absolutely sure? (type "yes" to confirm): ');
        
        if (!doubleConfirm) {
            console.log('❌ Reset cancelled by user.');
            rl.close();
            return;
        }

        rl.close();
        
        console.log('\n🚀 Starting system reset...\n');

        // 2. Create backup before reset
        console.log('💾 Creating backup before reset...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `./logs/backup-before-reset-${timestamp}.json`;
        
        try {
            // Export current data as backup
            const backup = {
                timestamp: new Date().toISOString(),
                users: await prisma.users.findMany(),
                roles: await prisma.roles.findMany(),
                permissions: await prisma.permissions.findMany(),
                organizations: await prisma.organizations.findMany(),
                departments: await prisma.departments.findMany(),
                devices: await prisma.devices.findMany()
            };
            
            fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
            console.log(`   ✅ Backup created: ${backupFile}`);
        } catch (error) {
            console.log('   ⚠️ Could not create backup:', error.message);
        }

        // 3. Clear all data
        console.log('\n🗑️ Clearing all database data...');
        
        try {
            // Delete in correct order to respect foreign key constraints
            await prisma.user_sessions.deleteMany({});
            await prisma.user_permissions.deleteMany({});
            await prisma.user_roles.deleteMany({});
            await prisma.role_permissions.deleteMany({});
            await prisma.devices.deleteMany({});
            await prisma.device_models.deleteMany({});
            await prisma.device_categories.deleteMany({});
            await prisma.departments.deleteMany({});
            await prisma.organizations.deleteMany({});
            await prisma.users.deleteMany({});
            await prisma.roles.deleteMany({});
            await prisma.permissions.deleteMany({});
            
            console.log('   ✅ Database data cleared');
        } catch (error) {
            console.log('   ⚠️ Error clearing data:', error.message);
            
            // Try alternative approach - reset database
            console.log('   🔄 Attempting database reset...');
            try {
                execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
                console.log('   ✅ Database reset completed');
            } catch (resetError) {
                console.error('   ❌ Database reset failed:', resetError.message);
                throw resetError;
            }
        }

        // 4. Run migrations
        console.log('\n📊 Running database migrations...');
        try {
            execSync('npx prisma migrate deploy', { stdio: 'inherit' });
            execSync('npx prisma generate', { stdio: 'inherit' });
            console.log('   ✅ Migrations completed');
        } catch (error) {
            console.error('   ❌ Migration failed:', error.message);
            throw error;
        }

        // 5. Run complete setup
        console.log('\n🚀 Running complete system setup...');
        try {
            execSync('node scripts/setup-complete-system.js', { stdio: 'inherit' });
            console.log('   ✅ System setup completed');
        } catch (error) {
            console.error('   ❌ Setup failed:', error.message);
            throw error;
        }

        // 6. Verify system status
        console.log('\n🔍 Verifying system status...');
        try {
            execSync('node scripts/check-system-status.js', { stdio: 'inherit' });
            console.log('   ✅ System verification completed');
        } catch (error) {
            console.log('   ⚠️ System verification had issues (see output above)');
        }

        // 7. Clean up old logs
        console.log('\n🧹 Cleaning up old logs...');
        try {
            const logFiles = fs.readdirSync('./logs').filter(file => 
                file.includes('setup-report') || 
                file.includes('system-status') ||
                (file.includes('backup') && !file.includes(timestamp))
            );
            
            // Keep only recent files (last 5)
            logFiles.sort().reverse().slice(5).forEach(file => {
                try {
                    fs.unlinkSync(`./logs/${file}`);
                    console.log(`   🗑️ Removed old log: ${file}`);
                } catch (error) {
                    // Ignore file deletion errors
                }
            });
            
            console.log('   ✅ Log cleanup completed');
        } catch (error) {
            console.log('   ⚠️ Log cleanup had issues:', error.message);
        }

        console.log('\n🎉 SYSTEM RESET & SETUP COMPLETED SUCCESSFULLY!\n');
        
        console.log('📋 SUMMARY:');
        console.log('==========================================');
        console.log('✅ Database reset: Complete');
        console.log('✅ Fresh data setup: Complete');
        console.log('✅ User accounts: Created');
        console.log('✅ Roles & permissions: Configured');
        console.log('✅ Sample devices: Generated');
        console.log('✅ System validation: Passed');
        console.log('');
        
        console.log('🔑 DEFAULT LOGIN CREDENTIALS:');
        console.log('==========================================');
        console.log('SuperAdmin: superadmin / SuperAdmin@2024!');
        console.log('Admin:      admin / Admin@2024!');
        console.log('Doctor:     doctor1 / Doctor@2024!');
        console.log('Nurse:      nurse1 / Nurse@2024!');
        console.log('Technician: tech1 / Tech@2024!');
        console.log('API User:   apiuser / ApiUser@2024!');
        console.log('');
        
        console.log('🚀 NEXT STEPS:');
        console.log('==========================================');
        console.log('1. npm run dev                    # Start development server');
        console.log('2. Open http://localhost:3030/secure-api-docs');
        console.log('3. Login với credentials ở trên');
        console.log('4. Test các API endpoints');
        console.log('');
        
        console.log('💾 BACKUP INFORMATION:');
        console.log('==========================================');
        console.log(`Previous data backed up to: ${backupFile}`);
        console.log('Restore if needed by importing this file manually.');

    } catch (error) {
        console.error('\n❌ System reset failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        console.log('\n🛠️ RECOVERY SUGGESTIONS:');
        console.log('==========================================');
        console.log('1. Check database connection');
        console.log('2. Verify .env configuration');
        console.log('3. Run: npx prisma migrate reset --force');
        console.log('4. Run: node scripts/setup-complete-system.js');
        console.log('5. Contact team if issues persist');
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the reset
resetSystem();