import { PrismaClient } from '@prisma/client';
import mailService from '../../shared/services/mailService.js';

const prisma = new PrismaClient();

/**
 * Enhanced Anti-Spam Warning Handler
 * Handles warnings with proper state management to prevent spam
 */
export class WarningHandler {
    constructor() {
        this.notificationLevels = [
            { level: 1, delay: 0 },        // Immediately
            { level: 2, delay: 5 * 60 },   // After 5 minutes
            { level: 3, delay: 15 * 60 },  // After 15 minutes  
            { level: 4, delay: 30 * 60 },  // After 30 minutes
            { level: 5, delay: 60 * 60 }   // After 1 hour
        ];
    }

    /**
     * Main warning handler with anti-spam logic
     * @param {string} deviceId - Device ID
     * @param {string} warningType - Type of warning (temperature_high, humidity_high, etc.)
     * @param {number} measuredValue - Current measured value
     * @param {number} thresholdValue - Threshold value that was exceeded
     * @param {string} severity - Warning severity (critical, major, moderate, minor)
     * @param {string} deviceType - Device type
     * @param {string} deviceName - Device name
     * @param {object} additionalData - Additional context data
     */
    async handleWarning(deviceId, warningType, measuredValue, thresholdValue, severity = 'moderate', deviceType = 'generic', deviceName = 'Unknown Device', additionalData = {}) {
        try {
            // Check if value exceeds threshold
            const isExceeding = this.checkThresholdExceeded(warningType, measuredValue, thresholdValue);
            
            if (isExceeding) {
                await this.handleExceedingThreshold(
                    deviceId, 
                    warningType, 
                    measuredValue, 
                    thresholdValue, 
                    severity, 
                    deviceType, 
                    deviceName, 
                    additionalData
                );
            } else {
                await this.handleNormalValue(deviceId, warningType);
            }

        } catch (error) {
            console.error(`Error in warning handler:`, error);
            throw error;
        }
    }

    /**
     * Handle case when value exceeds threshold
     */
    async handleExceedingThreshold(deviceId, warningType, measuredValue, thresholdValue, severity, deviceType, deviceName, additionalData) {
        // Check if there's an active warning of this type for this device
        const existingWarning = await prisma.$queryRaw`
            SELECT id, measured_value, timestamp, warning_message
            FROM device_warning_logs
            WHERE device_id = ${deviceId}
              AND warning_type = ${warningType}
              AND status = 'active'
            ORDER BY timestamp DESC
            LIMIT 1
        `;

        if (existingWarning.length > 0) {
            // Update existing active warning with new values
            await this.updateExistingWarning(existingWarning[0], measuredValue, additionalData);
            console.log(`📝 Updated existing warning ${existingWarning[0].id} for ${deviceName}`);
        } else {
            // Create new active warning
            const warningId = await this.createNewWarning(
                deviceId, 
                warningType, 
                measuredValue, 
                thresholdValue, 
                severity, 
                deviceType, 
                deviceName, 
                additionalData
            );
            
            // Schedule notifications
            await this.scheduleNotifications(warningId);
            console.log(`🚨 Created new warning ${warningId} for ${deviceName} - ${warningType}`);
        }
    }

    /**
     * Handle case when value returns to normal
     */
    async handleNormalValue(deviceId, warningType) {
        // Resolve any active warnings of this type
        const resolvedCount = await prisma.$executeRaw`
            UPDATE device_warning_logs
            SET status = 'resolved',
                resolved_at = CURRENT_TIMESTAMP
            WHERE device_id = ${deviceId}
              AND warning_type = ${warningType}
              AND status = 'active'
        `;

        if (resolvedCount > 0) {
            console.log(`✅ Resolved ${resolvedCount} warning(s) for device ${deviceId} - ${warningType}`);
        }
    }

    /**
     * Update existing warning with latest values
     */
    async updateExistingWarning(existingWarning, newMeasuredValue, additionalData) {
        const updatedMessage = this.generateWarningMessage(
            existingWarning.warning_type, 
            newMeasuredValue, 
            additionalData
        );

        await prisma.$executeRaw`
            UPDATE device_warning_logs
            SET measured_value = ${newMeasuredValue},
                timestamp = CURRENT_TIMESTAMP,
                warning_message = ${updatedMessage}
            WHERE id = ${existingWarning.id}
        `;
    }

    /**
     * Create new warning record
     */
    async createNewWarning(deviceId, warningType, measuredValue, thresholdValue, severity, deviceType, deviceName, additionalData) {
        const warningMessage = this.generateWarningMessage(warningType, measuredValue, additionalData);

        const result = await prisma.$queryRaw`
            INSERT INTO device_warning_logs (
                device_id,
                device_type,
                device_name,
                warning_type,
                warning_severity,
                measured_value,
                threshold_value,
                warning_message,
                status,
                timestamp
            ) VALUES (
                ${deviceId}::uuid,
                ${deviceType},
                ${deviceName},
                ${warningType},
                ${severity},
                ${measuredValue}::real,
                ${thresholdValue}::real,
                ${warningMessage},
                'active',
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        return result[0].id;
    }

    /**
     * Schedule progressive notifications for a warning
     */
    async scheduleNotifications(warningId) {
        try {
            // Get warning details
            const warning = await prisma.$queryRaw`
                SELECT * FROM device_warning_logs WHERE id = ${warningId}
            `;

            if (warning.length === 0) return;

            const warningData = warning[0];

            // Create notification schedule
            for (const level of this.notificationLevels) {
                const sendTime = new Date(Date.now() + level.delay * 1000);

                await prisma.$queryRaw`
                    INSERT INTO warning_notifications (
                        warning_id,
                        level,
                        send_time,
                        status
                    ) VALUES (
                        ${warningId},
                        ${level.level},
                        ${sendTime}::timestamp,
                        'scheduled'
                    )
                `;
            }

            // Send immediate notification (level 1)
            await this.sendNotification(warningId, 1);

        } catch (error) {
            console.error(`Error scheduling notifications for warning ${warningId}:`, error);
        }
    }

    /**
     * Send notification for specific level
     */
    async sendNotification(warningId, level) {
        try {
            // Get warning and notification details
            const data = await prisma.$queryRaw`
                SELECT 
                    w.*,
                    n.id as notification_id,
                    n.level,
                    n.send_time
                FROM device_warning_logs w
                JOIN warning_notifications n ON w.id = n.warning_id
                WHERE w.id = ${warningId} 
                AND n.level = ${level}
                AND n.status = 'scheduled'
                AND w.status = 'active'
            `;

            if (data.length === 0) {
                console.log(`No scheduled notification found for warning ${warningId} level ${level}`);
                return;
            }

            const notification = data[0];

            // Check if it's time to send
            if (new Date() < new Date(notification.send_time)) {
                console.log(`Not yet time to send notification ${notification.notification_id}`);
                return;
            }

            // Send email notification
            await mailService.sendWarningEmail({
                device_name: notification.device_name,
                device_id: notification.device_id,
                warning_type: notification.warning_type,
                severity: notification.warning_severity,
                message: notification.warning_message,
                current_value: notification.measured_value,
                threshold_value: notification.threshold_value,
                created_at: notification.timestamp,
                escalation_level: level
            });

            // Mark notification as sent
            await prisma.$executeRaw`
                UPDATE warning_notifications
                SET status = 'sent',
                    sent_at = CURRENT_TIMESTAMP
                WHERE id = ${notification.notification_id}
            `;

            console.log(`📧 Sent level ${level} notification for warning ${warningId}`);

        } catch (error) {
            console.error(`Error sending notification:`, error);
            
            // Mark notification as failed
            try {
                await prisma.$executeRaw`
                    UPDATE warning_notifications
                    SET status = 'failed',
                        sent_at = CURRENT_TIMESTAMP
                    WHERE warning_id = ${warningId}
                    AND level = ${level}
                `;
            } catch (updateError) {
                console.error(`Error updating notification status:`, updateError);
            }
        }
    }

    /**
     * Process scheduled notifications (should be run periodically)
     */
    async processScheduledNotifications() {
        try {
            // Get notifications that are due to be sent
            const dueNotifications = await prisma.$queryRaw`
                SELECT 
                    n.warning_id,
                    n.level,
                    n.send_time,
                    w.status as warning_status
                FROM warning_notifications n
                JOIN device_warning_logs w ON n.warning_id = w.id
                WHERE n.status = 'scheduled'
                AND n.send_time <= CURRENT_TIMESTAMP
                AND w.status = 'active'
                ORDER BY n.send_time ASC
            `;

            console.log(`Processing ${dueNotifications.length} scheduled notifications...`);

            for (const notification of dueNotifications) {
                await this.sendNotification(notification.warning_id, notification.level);
                
                // Small delay to prevent overwhelming email server
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error('Error processing scheduled notifications:', error);
        }
    }

    /**
     * Check if measured value exceeds threshold based on warning type
     */
    checkThresholdExceeded(warningType, measuredValue, thresholdValue) {
        const exceedingTypes = [
            'temperature_high', 'humidity_high', 'voltage_high', 
            'current_high', 'power_high', 'leak_current_soft',
            'leak_current_strong', 'leak_current_shutdown'
        ];

        const belowTypes = [
            'temperature_low', 'voltage_low', 'battery_low'
        ];

        if (exceedingTypes.includes(warningType)) {
            return measuredValue > thresholdValue;
        } else if (belowTypes.includes(warningType)) {
            return measuredValue < thresholdValue;
        }

        // Default behavior
        return measuredValue > thresholdValue;
    }

    /**
     * Generate warning message based on type and value
     */
    generateWarningMessage(warningType, measuredValue, additionalData = {}) {
        const messages = {
            'temperature_high': `Nhiệt độ quá cao: ${measuredValue}°C`,
            'humidity_high': `Độ ẩm quá cao: ${measuredValue}%`,
            'voltage_high': `Điện áp quá cao: ${measuredValue}V`,
            'voltage_low': `Điện áp quá thấp: ${measuredValue}V`,
            'current_high': `Dòng điện quá cao: ${measuredValue}A`,
            'power_high': `Công suất quá cao: ${measuredValue}W`,
            'battery_low': `Pin yếu: ${measuredValue}%`,
            'leak_current_soft': `Dòng rò nhẹ: ${measuredValue}mA`,
            'leak_current_strong': `Dòng rò mạnh: ${measuredValue}mA`,
            'leak_current_shutdown': `Dòng rò nghiêm trọng - cần ngắt thiết bị: ${measuredValue}mA`
        };

        let baseMessage = messages[warningType] || `Cảnh báo ${warningType}: ${measuredValue}`;
        
        // Add additional context if available
        if (additionalData.location) {
            baseMessage += ` tại ${additionalData.location}`;
        }
        
        if (additionalData.timestamp) {
            baseMessage += ` lúc ${new Date(additionalData.timestamp).toLocaleString('vi-VN')}`;
        }

        return baseMessage;
    }

    /**
     * Get warning statistics
     */
    async getWarningStats() {
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as total_warnings,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_warnings,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_warnings,
                COUNT(CASE WHEN warning_severity = 'critical' THEN 1 END) as critical_warnings,
                COUNT(CASE WHEN warning_severity = 'major' THEN 1 END) as major_warnings
            FROM device_warning_logs
            WHERE timestamp >= CURRENT_DATE
        `;

        const notificationStats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications,
                AVG(level) as avg_escalation_level
            FROM warning_notifications
            WHERE send_time >= CURRENT_DATE
        `;

        return {
            warnings: stats[0],
            notifications: notificationStats[0]
        };
    }
}

// Create singleton instance
export const warningHandler = new WarningHandler();

// Export enhanced warning function for backward compatibility
export const handleWarningWithAntiSpam = async (deviceId, warningType, measuredValue, thresholdValue, options = {}) => {
    const {
        severity = 'moderate',
        deviceType = 'generic',
        deviceName = 'Unknown Device',
        additionalData = {}
    } = options;

    return await warningHandler.handleWarning(
        deviceId,
        warningType,
        measuredValue,
        thresholdValue,
        severity,
        deviceType,
        deviceName,
        additionalData
    );
};
