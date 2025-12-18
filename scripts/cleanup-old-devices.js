// scripts/cleanup-old-devices.js
/**
 * Cleanup Script: Permanently delete devices that have been soft-deleted for more than 90 days
 * 
 * This script should be run as a scheduled job (e.g., daily via cron or Task Scheduler)
 * 
 * Usage:
 *   node scripts/cleanup-old-devices.js
 * 
 * Or add to ecosystem.config.js for PM2:
 *   pm2 start ecosystem.config.js --only device-cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Permanently delete devices that have been soft-deleted for more than 90 days
 */
async function cleanupOldDeletedDevices() {
    try {
        console.log('🧹 Starting device cleanup process...');
        console.log(`⏰ Current time: ${new Date().toISOString()}`);

        // Calculate cutoff date (90 days ago)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        console.log(`📅 Cutoff date: ${ninetyDaysAgo.toISOString()}`);
        console.log(`🔍 Searching for devices deleted before ${ninetyDaysAgo.toISOString()}...`);

        // Find devices to be permanently deleted
        const devicesToDelete = await prisma.device.findMany({
            where: {
                deleted_at: {
                    lt: ninetyDaysAgo
                }
            },
            include: {
                model: {
                    select: {
                        name: true,
                        model_number: true
                    }
                },
                organization: {
                    select: {
                        name: true
                    }
                },
                _count: {
                    select: {
                        device_data: true,
                        alerts: true,
                        maintenance_history: true
                    }
                }
            }
        });

        if (devicesToDelete.length === 0) {
            console.log('✅ No devices found for permanent deletion.');
            return {
                success: true,
                deleted_count: 0,
                message: 'No devices older than 90 days'
            };
        }

        console.log(`⚠️  Found ${devicesToDelete.length} devices to permanently delete:`);
        
        // Log devices that will be deleted
        devicesToDelete.forEach((device, index) => {
            const daysSinceDeleted = Math.floor(
                (new Date() - new Date(device.deleted_at)) / (1000 * 60 * 60 * 24)
            );
            console.log(`\n${index + 1}. Device: ${device.serial_number}`);
            console.log(`   Model: ${device.model?.name}`);
            console.log(`   Organization: ${device.organization?.name}`);
            console.log(`   Deleted: ${device.deleted_at.toISOString()} (${daysSinceDeleted} days ago)`);
            console.log(`   Data: ${device._count.device_data} records, ${device._count.alerts} alerts, ${device._count.maintenance_history} maintenance`);
        });

        // Confirm deletion (safety check)
        console.log('\n⚠️  WARNING: This action will PERMANENTLY delete these devices and ALL associated data!');
        console.log('💾 IMPORTANT: Ensure you have a database backup before proceeding.');

        // Optional: Add a safety delay
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n🗑️  Proceeding with permanent deletion...');

        // Perform deletion in transaction
        const result = await prisma.$transaction(async (tx) => {
            let deletedCount = 0;
            const errors = [];

            for (const device of devicesToDelete) {
                try {
                    // Delete related data first (if not using CASCADE)
                    await tx.device_data.deleteMany({
                        where: { device_id: device.id }
                    });

                    await tx.alerts.deleteMany({
                        where: { device_id: device.id }
                    });

                    await tx.maintenance_history.deleteMany({
                        where: { device_id: device.id }
                    });

                    await tx.alert_rules.deleteMany({
                        where: { device_id: device.id }
                    });

                    await tx.maintenance_schedules.deleteMany({
                        where: { device_id: device.id }
                    });

                    await tx.warranty_info.deleteMany({
                        where: { device_id: device.id }
                    });

                    // Finally, delete the device
                    await tx.device.delete({
                        where: { id: device.id }
                    });

                    deletedCount++;
                    console.log(`✅ Deleted device: ${device.serial_number}`);

                } catch (error) {
                    console.error(`❌ Failed to delete device ${device.serial_number}:`, error.message);
                    errors.push({
                        device_id: device.id,
                        serial_number: device.serial_number,
                        error: error.message
                    });
                }
            }

            return { deletedCount, errors };
        });

        // Create audit log summary
        await prisma.audit_logs.create({
            data: {
                action: 'cleanup_old_devices',
                resource_type: 'device',
                resource_id: null,
                user_id: null, // System action
                details: {
                    deleted_count: result.deletedCount,
                    cutoff_date: ninetyDaysAgo,
                    devices_deleted: devicesToDelete.map(d => ({
                        id: d.id,
                        serial_number: d.serial_number,
                        deleted_at: d.deleted_at
                    })),
                    errors: result.errors
                }
            }
        });

        console.log('\n✅ Cleanup complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Devices permanently deleted: ${result.deletedCount}`);
        console.log(`   - Errors: ${result.errors.length}`);

        if (result.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            result.errors.forEach((err, index) => {
                console.log(`${index + 1}. ${err.serial_number}: ${err.error}`);
            });
        }

        return {
            success: true,
            deleted_count: result.deletedCount,
            errors: result.errors
        };

    } catch (error) {
        console.error('❌ Fatal error during cleanup:', error);
        
        // Log error to audit
        try {
            await prisma.audit_logs.create({
                data: {
                    action: 'cleanup_old_devices_error',
                    resource_type: 'device',
                    resource_id: null,
                    user_id: null,
                    details: {
                        error: error.message,
                        stack: error.stack
                    }
                }
            });
        } catch (logError) {
            console.error('Failed to log error to audit:', logError);
        }

        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run cleanup if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanupOldDeletedDevices()
        .then((result) => {
            console.log('\n🎉 Cleanup job completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Cleanup job failed:', error);
            process.exit(1);
        });
}

export default cleanupOldDeletedDevices;
