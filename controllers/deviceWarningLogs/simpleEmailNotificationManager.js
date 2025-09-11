import mailService from '../../services/mailService.js';
import { formatWarningDataForEmail } from '../../utils/emailFormatter.js';

/**
 * Simplified Email Notification Manager
 * Chỉ sử dụng mailService cơ bản, không cần các bảng phức tạp
 */
export class SimpleEmailNotificationManager {
    constructor() {
        // Cấu hình notification rules
        this.notificationRules = {
            immediate: {
                severities: ['critical'],
                delay: 0,
                subject: '🚨 CẢNH BÁO KHẨN CẤP',
                priority: 'urgent'
            },
            standard: {
                severities: ['high', 'major'],
                delay: 0, // Gửi ngay lập tức
                subject: '⚠️ Cảnh báo thiết bị',
                priority: 'high'
            },
            moderate: {
                severities: ['medium', 'moderate'],
                delay: 0,
                subject: '⚠️ Thông báo thiết bị',
                priority: 'normal'
            },
            low: {
                severities: ['low', 'minor'],
                delay: 0,
                subject: 'ℹ️ Thông tin thiết bị',
                priority: 'low'
            }
        };
    }

    /**
     * Xử lý và gửi email cảnh báo
     */
    async processWarningEmail(warningData) {
        try {
            // Xác định rule dựa trên severity
            const rule = this.determineNotificationRule(warningData.severity);
            
            // Format dữ liệu cho email sử dụng formatter
            const emailData = formatWarningDataForEmail(warningData, 'warning');

            // Gửi email ngay lập tức
            await mailService.sendWarningEmail(emailData);
            
            console.log(`📧 Simple email notification sent for ${warningData.warning_type} (${warningData.severity})`);
            return { success: true, method: 'immediate' };

        } catch (error) {
            console.error('❌ Error in SimpleEmailNotificationManager:', error);
            throw error;
        }
    }

    /**
     * Gửi email thông báo giải quyết cảnh báo
     */
    async processResolutionEmail(warningData) {
        try {
            // Format dữ liệu cho email resolution
            const emailData = formatWarningDataForEmail(warningData, 'resolution');
            
            // Gửi email resolution
            await mailService.sendResolutionEmail(emailData);
            
            console.log(`📧 Resolution email sent for ${warningData.warning_type}`);
            return { success: true, method: 'resolution' };

        } catch (error) {
            console.error('❌ Error sending resolution email:', error);
            throw error;
        }
    }

    /**
     * Xác định rule notification dựa trên severity
     */
    determineNotificationRule(severity) {
        for (const [ruleName, rule] of Object.entries(this.notificationRules)) {
            if (rule.severities.includes(severity)) {
                return { name: ruleName, ...rule };
            }
        }
        
        // Default rule nếu không tìm thấy
        return {
            name: 'default',
            severities: [severity],
            delay: 0,
            subject: '⚠️ Thông báo thiết bị',
            priority: 'normal'
        };
    }
}

// Export instance
export const simpleEmailNotificationManager = new SimpleEmailNotificationManager();
