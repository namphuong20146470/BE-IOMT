import { warningHandler } from './warningHandler.js';
import cron from 'node-cron';

/**
 * Notification Processor
 * Handles scheduled notification processing and cleanup
 */
class NotificationProcessor {
    constructor() {
        this.isRunning = false;
        this.jobs = [];
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Notification processor is already running');
            return;
        }

        console.log('🚀 Starting notification processor...');

        // Process notifications every minute
        const notificationJob = cron.schedule('* * * * *', async () => {
            try {
                await warningHandler.processScheduledNotifications();
            } catch (error) {
                console.error('Error in scheduled notification processing:', error);
            }
        }, {
            scheduled: false
        });

        // Cleanup old resolved warnings every hour
        const cleanupJob = cron.schedule('0 * * * *', async () => {
            try {
                await this.cleanupOldWarnings();
            } catch (error) {
                console.error('Error in cleanup job:', error);
            }
        }, {
            scheduled: false
        });

        // Cleanup old notifications every 6 hours
        const notificationCleanupJob = cron.schedule('0 */6 * * *', async () => {
            try {
                await this.cleanupOldNotifications();
            } catch (error) {
                console.error('Error in notification cleanup:', error);
            }
        }, {
            scheduled: false
        });

        // Start jobs
        notificationJob.start();
        cleanupJob.start();
        notificationCleanupJob.start();

        this.jobs = [notificationJob, cleanupJob, notificationCleanupJob];
        this.isRunning = true;

        console.log('✅ Notification processor started successfully');
        console.log('   - Notifications: Every minute');
        console.log('   - Warning cleanup: Every hour');
        console.log('   - Notification cleanup: Every 6 hours');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Notification processor is not running');
            return;
        }

        console.log('🛑 Stopping notification processor...');

        this.jobs.forEach(job => {
            job.stop();
            job.destroy();
        });

        this.jobs = [];
        this.isRunning = false;

        console.log('✅ Notification processor stopped');
    }

    /**
     * Cleanup old resolved warnings (older than 30 days)
     */
    async cleanupOldWarnings() {
        try {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();

            const result = await prisma.$executeRaw`
                DELETE FROM device_warning_logs
                WHERE status = 'resolved'
                AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
            `;

            if (result > 0) {
                console.log(`🧹 Cleaned up ${result} old resolved warnings`);
            }

            await prisma.$disconnect();
        } catch (error) {
            console.error('Error cleaning up old warnings:', error);
        }
    }

    /**
     * Cleanup old notification records (older than 7 days)
     */
    async cleanupOldNotifications() {
        try {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();

            const result = await prisma.$executeRaw`
                DELETE FROM warning_notifications
                WHERE status IN ('sent', 'failed')
                AND sent_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
            `;

            if (result > 0) {
                console.log(`🧹 Cleaned up ${result} old notification records`);
            }

            await prisma.$disconnect();
        } catch (error) {
            console.error('Error cleaning up old notifications:', error);
        }
    }

    /**
     * Get processor status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: this.jobs.length,
            uptime: this.isRunning ? process.uptime() : 0
        };
    }

    /**
     * Force process pending notifications now
     */
    async processNow() {
        try {
            console.log('🔄 Force processing notifications...');
            await warningHandler.processScheduledNotifications();
            console.log('✅ Force processing completed');
        } catch (error) {
            console.error('Error in force processing:', error);
            throw error;
        }
    }

    /**
     * Get notification queue status
     */
    async getQueueStatus() {
        try {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();

            const queueStats = await prisma.$queryRaw`
                SELECT 
                    status,
                    level,
                    COUNT(*) as count,
                    MIN(send_time) as earliest_send_time,
                    MAX(send_time) as latest_send_time
                FROM warning_notifications
                WHERE send_time >= CURRENT_DATE
                GROUP BY status, level
                ORDER BY status, level
            `;

            const overdueCount = await prisma.$queryRaw`
                SELECT COUNT(*) as overdue_count
                FROM warning_notifications
                WHERE status = 'scheduled'
                AND send_time < CURRENT_TIMESTAMP
            `;

            await prisma.$disconnect();

            return {
                queue: queueStats,
                overdue: parseInt(overdueCount[0].overdue_count)
            };
        } catch (error) {
            console.error('Error getting queue status:', error);
            throw error;
        }
    }
}

// Create singleton instance
export const notificationProcessor = new NotificationProcessor();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
        notificationProcessor.start();
    }, 5000); // Start after 5 seconds to allow system initialization
}
