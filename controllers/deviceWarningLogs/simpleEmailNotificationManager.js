import mailService from '../../services/mailService.js';
import { formatWarningDataForEmail, formatWarningDataWithUserInfo } from '../../utils/emailFormatter.js';

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
                subject: 'Cảnh báo',
                priority: 'high'
            },
            moderate: {
                severities: ['medium', 'moderate'],
                delay: 0,
                subject: 'Thông báo',
                priority: 'normal'
            },
            low: {
                severities: ['low', 'minor'],
                delay: 0,
                subject: 'ℹ️ Thông tin',
                priority: 'low'
            }
        };
    }

    /**
     * Xử lý và gửi email cảnh báo
     */
    async processWarningEmail(warningData) {
        try {
            console.log('📧 Processing warning email with RAW data:', JSON.stringify(warningData, null, 2));
            
            // Xác định rule dựa trên severity
            const rule = this.determineNotificationRule(warningData.severity || warningData.warning_severity);
            
            // TEMPORARY FIX: Gửi RAW data trực tiếp (bỏ qua formatter để debug)
            const emailData = {
                ...warningData,
                created_at: warningData.timestamp || warningData.created_at || new Date().toISOString(),
                // Đảm bảo có các field cần thiết
                device_id: warningData.device_id || 'N/A',
                severity: warningData.warning_severity || warningData.severity || 'medium'
            };

            console.log('📧 Sending email with data:', JSON.stringify(emailData, null, 2));

            // Gửi email ngay lập tức
            await mailService.sendWarningEmail(emailData);
            
            console.log(`📧 Simple email notification sent for ${warningData.warning_type} (${warningData.warning_severity})`);
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
            // Format dữ liệu cho email resolution (với user info)
            const emailData = await formatWarningDataWithUserInfo(warningData, 'resolution');
            
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
