import mailService from '../../services/mailService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Enhanced Email Notification Manager
 * Tích hợp tất cả logic gửi email cảnh báo với nhiều tính năng nâng cao
 */
export class EmailNotificationManager {
    constructor() {
        // Cấu hình notification rules
        this.notificationRules = {
            // Immediate notification cho critical warnings
            immediate: {
                severities: ['critical'],
                delay: 0,
                subject: '🚨 CẢNH BÁO KHẨN CẤP',
                priority: 'urgent'
            },
            
            // Standard notification cho high warnings
            standard: {
                severities: ['high', 'major'],
                delay: 5 * 60, // 5 minutes
                subject: '⚠️ Cảnh báo thiết bị',
                priority: 'high'
            },
            
            // Moderate notification
            moderate: {
                severities: ['medium', 'moderate'],
                delay: 15 * 60, // 15 minutes
                subject: '⚠️ Thông báo thiết bị',
                priority: 'normal'
            },
            
            // Low priority notification
            low: {
                severities: ['low', 'minor'],
                delay: 60 * 60, // 1 hour
                subject: 'ℹ️ Thông tin thiết bị',
                priority: 'low'
            }
        };

        // Email templates cho các loại cảnh báo
        this.templates = {
            temperature_high: {
                icon: '🔥',
                color: '#d32f2f',
                description: 'Nhiệt độ vượt ngưỡng cho phép'
            },
            humidity_high: {
                icon: '💧',
                color: '#2196F3',
                description: 'Độ ẩm vượt ngưỡng cho phép'
            },
            voltage_abnormal: {
                icon: '⚡',
                color: '#ff9800',
                description: 'Điện áp không ổn định'
            },
            current_overload: {
                icon: '🔌',
                color: '#f44336',
                description: 'Dòng điện quá tải'
            },
            power_abnormal: {
                icon: '🔋',
                color: '#9c27b0',
                description: 'Công suất bất thường'
            },
            device_offline: {
                icon: '📵',
                color: '#607d8b',
                description: 'Thiết bị mất kết nối'
            },
            maintenance_required: {
                icon: '🔧',
                color: '#795548',
                description: 'Cần bảo trì thiết bị'
            }
        };
    }

    /**
     * Xử lý gửi email cho warning mới
     * @param {Object} warningData - Dữ liệu cảnh báo
     * @param {Object} options - Tùy chọn gửi email
     */
    async processWarningEmail(warningData, options = {}) {
        try {
            const rule = this.getNotificationRule(warningData.severity);
            const template = this.templates[warningData.warning_type] || this.templates.device_offline;

            // Tạo enhanced warning data
            const enhancedData = {
                ...warningData,
                template,
                rule,
                notification_id: this.generateNotificationId(),
                timestamp: new Date().toISOString(),
                ...options
            };

            // Kiểm tra xem có cần delay không
            if (rule.delay > 0 && !options.immediate) {
                return await this.scheduleDelayedEmail(enhancedData);
            }

            // Gửi email ngay lập tức
            return await this.sendImmediateEmail(enhancedData);

        } catch (error) {
            console.error('❌ Error processing warning email:', error);
            throw error;
        }
    }

    /**
     * Gửi email ngay lập tức
     */
    async sendImmediateEmail(warningData) {
        try {
            const emailData = this.buildEmailData(warningData);
            const result = await mailService.sendWarningEmail(emailData);

            if (result.success) {
                // Log successful email
                await this.logEmailNotification(warningData, 'sent', result.messageId);
                console.log(`📧 ✅ Email sent immediately for ${warningData.warning_type} (${warningData.severity})`);
            } else {
                await this.logEmailNotification(warningData, 'failed', null, result.error);
                console.log(`📧 ❌ Failed to send email: ${result.message}`);
            }

            return result;

        } catch (error) {
            await this.logEmailNotification(warningData, 'error', null, error.message);
            throw error;
        }
    }

    /**
     * Lên lịch gửi email với delay
     */
    async scheduleDelayedEmail(warningData) {
        try {
            const sendTime = new Date(Date.now() + (warningData.rule.delay * 1000));

            // Lưu vào database để scheduler xử lý
            const result = await prisma.$executeRaw`
                INSERT INTO warning_email_queue (
                    warning_id,
                    device_id,
                    device_name,
                    warning_type,
                    severity,
                    notification_data,
                    scheduled_time,
                    status,
                    created_at
                ) VALUES (
                    ${warningData.id},
                    ${warningData.device_id},
                    ${warningData.device_name},
                    ${warningData.warning_type},
                    ${warningData.severity},
                    ${JSON.stringify(warningData)}::jsonb,
                    ${sendTime.toISOString()}::timestamptz,
                    'scheduled',
                    CURRENT_TIMESTAMP
                )
            `;

            console.log(`📧 ⏰ Email scheduled for ${sendTime.toLocaleString('vi-VN')} (${warningData.warning_type})`);
            return { success: true, scheduled: true, sendTime };

        } catch (error) {
            console.error('❌ Error scheduling delayed email:', error);
            throw error;
        }
    }

    /**
     * Xây dựng dữ liệu email
     */
    buildEmailData(warningData) {
        const template = warningData.template;
        const rule = warningData.rule;

        return {
            device_id: warningData.device_id,
            device_name: warningData.device_name,
            warning_type: warningData.warning_type,
            severity: warningData.severity,
            message: warningData.message || template.description,
            current_value: warningData.current_value || warningData.measured_value,
            threshold_value: warningData.threshold_value,
            created_at: warningData.created_at || warningData.timestamp,
            status: warningData.status || 'active',
            
            // Email enhancements
            template_icon: template.icon,
            template_color: template.color,
            template_description: template.description,
            priority: rule.priority,
            notification_id: warningData.notification_id,
            escalation_level: warningData.escalation_level || 1,
            
            // Additional context
            device_location: warningData.device_location,
            device_model: warningData.device_model,
            maintenance_contact: warningData.maintenance_contact,
            additional_notes: warningData.additional_notes
        };
    }

    /**
     * Gửi email digest (tổng hợp nhiều cảnh báo)
     */
    async sendWarningDigest(warnings, options = {}) {
        try {
            if (!warnings || warnings.length === 0) {
                return { success: false, message: 'No warnings to send' };
            }

            const digestData = {
                type: 'digest',
                warning_count: warnings.length,
                critical_count: warnings.filter(w => w.severity === 'critical').length,
                high_count: warnings.filter(w => w.severity === 'high').length,
                warnings: warnings.map(w => this.buildEmailData(w)),
                created_at: new Date().toISOString(),
                ...options
            };

            const result = await mailService.sendWarningDigest?.(digestData) || 
                          await mailService.sendWarningEmail({
                              ...digestData.warnings[0],
                              type: 'digest',
                              warning_count: digestData.warning_count
                          });

            if (result.success) {
                console.log(`📧 ✅ Warning digest sent with ${warnings.length} warnings`);
                
                // Log cho tất cả warnings trong digest
                for (const warning of warnings) {
                    await this.logEmailNotification(warning, 'digest_sent', result.messageId);
                }
            }

            return result;

        } catch (error) {
            console.error('❌ Error sending warning digest:', error);
            throw error;
        }
    }

    /**
     * Xử lý email escalation (leo thang)
     */
    async processEmailEscalation(warningId, level = 2) {
        try {
            // Lấy thông tin warning
            const warning = await prisma.$queryRaw`
                SELECT * FROM device_warning_logs
                WHERE id = ${warningId} AND status = 'active'
                LIMIT 1
            `;

            if (!warning || warning.length === 0) {
                return { success: false, message: 'Warning not found or not active' };
            }

            const warningData = warning[0];
            const escalationData = {
                ...warningData,
                escalation_level: level,
                escalation_reason: `Level ${level} escalation - warning persists`,
                immediate: true // Force immediate sending for escalation
            };

            return await this.processWarningEmail(escalationData, { 
                immediate: true, 
                escalation_level: level 
            });

        } catch (error) {
            console.error('❌ Error processing email escalation:', error);
            throw error;
        }
    }

    /**
     * Gửi email resolution (đã giải quyết)
     */
    async sendResolutionEmail(warningId, resolutionData = {}) {
        try {
            const warning = await prisma.$queryRaw`
                SELECT * FROM device_warning_logs
                WHERE id = ${warningId}
                LIMIT 1
            `;

            if (!warning || warning.length === 0) {
                return { success: false, message: 'Warning not found' };
            }

            const warningData = warning[0];
            const emailData = {
                ...this.buildEmailData(warningData),
                type: 'resolution',
                status: 'resolved',
                resolution_time: new Date().toISOString(),
                resolution_notes: resolutionData.notes || 'Giá trị đã trở về bình thường',
                resolved_by: resolutionData.resolved_by || 'System Auto-Resolution',
                ...resolutionData
            };

            const result = await mailService.sendResolutionEmail?.(emailData) ||
                          await mailService.sendWarningEmail({
                              ...emailData,
                              message: `✅ RESOLVED: ${emailData.message}`,
                              subject_prefix: '✅ ĐÃ GIẢI QUYẾT'
                          });

            if (result.success) {
                await this.logEmailNotification(warningData, 'resolution_sent', result.messageId);
                console.log(`📧 ✅ Resolution email sent for ${warningData.warning_type}`);
            }

            return result;

        } catch (error) {
            console.error('❌ Error sending resolution email:', error);
            throw error;
        }
    }

    /**
     * Log email notification vào database
     */
    async logEmailNotification(warningData, status, messageId = null, error = null) {
        try {
            await prisma.$executeRaw`
                INSERT INTO email_notification_logs (
                    warning_id,
                    device_id,
                    warning_type,
                    severity,
                    status,
                    message_id,
                    error_message,
                    sent_at,
                    created_at
                ) VALUES (
                    ${warningData.id || null},
                    ${warningData.device_id},
                    ${warningData.warning_type},
                    ${warningData.severity},
                    ${status},
                    ${messageId},
                    ${error},
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `;
        } catch (logError) {
            console.error('Error logging email notification:', logError);
            // Don't throw - logging errors shouldn't break the main flow
        }
    }

    /**
     * Lấy notification rule dựa trên severity
     */
    getNotificationRule(severity) {
        for (const [ruleKey, rule] of Object.entries(this.notificationRules)) {
            if (rule.severities.includes(severity?.toLowerCase())) {
                return rule;
            }
        }
        return this.notificationRules.moderate; // Default
    }

    /**
     * Tạo notification ID unique
     */
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Lấy thống kê email notifications
     */
    async getEmailStatistics(timeRange = '24h') {
        try {
            const timeFilter = timeRange === '24h' ? 
                "sent_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'" :
                timeRange === '7d' ?
                "sent_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'" :
                "sent_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'";

            const stats = await prisma.$queryRaw`
                SELECT 
                    status,
                    severity,
                    COUNT(*) as count,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                    AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delay_seconds
                FROM email_notification_logs
                WHERE ${timeFilter}
                GROUP BY status, severity
                ORDER BY severity, status
            `;

            return stats;
        } catch (error) {
            console.error('Error getting email statistics:', error);
            return [];
        }
    }
}

// Export singleton instance
export const emailNotificationManager = new EmailNotificationManager();
