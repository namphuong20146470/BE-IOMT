// Migration script: Convert SHA256 passwords to bcrypt in users_v2
// Usage: node migrate-passwords-v2.js

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Legacy hash function (SHA256)
const hashPasswordSHA256 = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// New bcrypt hash function
const hashPasswordBcrypt = async (password) => {
    return await bcrypt.hash(password, 10);
};

async function migratePasswords() {
    console.log('🔄 Starting password migration for users_v2...\n');

    try {
        // Get all users_v2 with SHA256 passwords (assuming they don't start with $2b$ which is bcrypt)
        const users = await prisma.$queryRaw`
            SELECT id, username, password_hash, full_name
            FROM users_v2 
            WHERE password_hash NOT LIKE '$2b$%'
            AND is_active = true
        `;

        if (users.length === 0) {
            console.log('✅ No users found with SHA256 passwords. Migration not needed.');
            return;
        }

        console.log(`📊 Found ${users.length} users with SHA256 passwords:`);
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} (${user.full_name})`);
        });

        console.log('\n⚠️  WARNING: This migration will update password hashes.');
        console.log('⚠️  Make sure you have a backup of your database!');
        console.log('\n🔧 Migration process:');
        console.log('1. User passwords will need to be reset manually OR');
        console.log('2. You need to provide plain text passwords for migration\n');

        // For demo purposes, we'll create a default migration
        // In production, you might want to:
        // 1. Force password reset for all users
        // 2. Or migrate with known test passwords

        let migratedCount = 0;
        let failedCount = 0;

        for (const user of users) {
            try {
                // Option 1: Force password reset (set temporary password)
                const tempPassword = 'TempPass123!'; // Users will need to change this
                const newBcryptHash = await hashPasswordBcrypt(tempPassword);

                await prisma.$queryRaw`
                    UPDATE users_v2 
                    SET password_hash = ${newBcryptHash},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${user.id}::uuid
                `;

                console.log(`✅ Migrated: ${user.username} -> bcrypt hash (temp password: ${tempPassword})`);
                migratedCount++;

            } catch (error) {
                console.error(`❌ Failed to migrate ${user.username}:`, error.message);
                failedCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Successfully migrated: ${migratedCount} users`);
        console.log(`❌ Failed migrations: ${failedCount} users`);
        
        if (migratedCount > 0) {
            console.log('\n⚠️  IMPORTANT NOTES:');
            console.log('1. All migrated users have temporary password: "TempPass123!"');
            console.log('2. Users must change their passwords after first login');
            console.log('3. Consider implementing forced password change on next login');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Alternative migration with known passwords
async function migrateWithKnownPasswords() {
    console.log('🔄 Starting password migration with known passwords...\n');

    // Example: Known user passwords for migration
    const knownPasswords = {
        'admin': 'admin123',
        'testuser': 'password123',
        // Add more known passwords here
    };

    try {
        const users = await prisma.$queryRaw`
            SELECT id, username, password_hash, full_name
            FROM users_v2 
            WHERE password_hash NOT LIKE '$2b$%'
            AND is_active = true
        `;

        let migratedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            if (knownPasswords[user.username]) {
                try {
                    const plainPassword = knownPasswords[user.username];
                    const sha256Hash = hashPasswordSHA256(plainPassword);
                    
                    // Verify current password is correct
                    if (user.password_hash === sha256Hash) {
                        const newBcryptHash = await hashPasswordBcrypt(plainPassword);
                        
                        await prisma.$queryRaw`
                            UPDATE users_v2 
                            SET password_hash = ${newBcryptHash},
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ${user.id}::uuid
                        `;

                        console.log(`✅ Migrated: ${user.username} with known password`);
                        migratedCount++;
                    } else {
                        console.log(`⚠️  Password mismatch for ${user.username}, skipping...`);
                        skippedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Failed to migrate ${user.username}:`, error.message);
                    skippedCount++;
                }
            } else {
                console.log(`⚠️  No known password for ${user.username}, skipping...`);
                skippedCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Successfully migrated: ${migratedCount} users`);
        console.log(`⚠️  Skipped: ${skippedCount} users`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Check migration status
async function checkMigrationStatus() {
    console.log('🔍 Checking password migration status...\n');

    try {
        const sha256Count = await prisma.$queryRaw`
            SELECT COUNT(*) as count
            FROM users_v2 
            WHERE password_hash NOT LIKE '$2b$%'
            AND is_active = true
        `;

        const bcryptCount = await prisma.$queryRaw`
            SELECT COUNT(*) as count
            FROM users_v2 
            WHERE password_hash LIKE '$2b$%'
            AND is_active = true
        `;

        const totalCount = await prisma.$queryRaw`
            SELECT COUNT(*) as count
            FROM users_v2 
            WHERE is_active = true
        `;

        console.log('📊 Password Hash Status:');
        console.log(`Total active users: ${totalCount[0].count}`);
        console.log(`SHA256 passwords: ${sha256Count[0].count}`);
        console.log(`bcrypt passwords: ${bcryptCount[0].count}`);

        if (parseInt(sha256Count[0].count) > 0) {
            console.log('\n⚠️  Migration needed for SHA256 passwords');
        } else {
            console.log('\n✅ All passwords are using bcrypt');
        }

    } catch (error) {
        console.error('❌ Status check failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0] || 'check';

switch (command) {
    case 'migrate':
        migratePasswords();
        break;
    case 'migrate-known':
        migrateWithKnownPasswords();
        break;
    case 'check':
    default:
        checkMigrationStatus();
        break;
}

console.log('\n💡 Usage:');
console.log('node migrate-passwords-v2.js check         # Check migration status');
console.log('node migrate-passwords-v2.js migrate       # Migrate with temp passwords');
console.log('node migrate-passwords-v2.js migrate-known # Migrate with known passwords');