/**
 * HƯỚNG DẪN SỬ DỤNG HỆ THỐNG EMAIL CẢNH BÁO
 * ==========================================
 * 
 * Hệ thống đã được tối ưu để gửi email từ dữ liệu đầy đủ trong database
 */

// 1. IMPORT CÁC MODULE CẦN THIẾT
import { formatWarningDataForEmail, formatWarningsDigestForEmail } from './utils/emailFormatter.js';
import { simpleEmailNotificationManager } from './controllers/deviceWarningLogs/simpleEmailNotificationManager.js';
import mailService from './services/mailService.js';

// 2. DỮ LIỆU MẪU TỪ DATABASE (như bạn cung cấp)
const warningFromDatabase = {
    "id": 8220,
    "device_type": "camera_control_unit",
    "device_name": "Module xử lý hình ảnh",
    "device_id": null,
    "warning_type": "power_warning",
    "warning_severity": "moderate",
    "measured_value": 100,
    "threshold_value": 96,
    "warning_message": "Công suất vượt ngưỡng",
    "status": "resolved",
    "resolved_at": "2025-09-11T15:48:32.523Z",
    "acknowledged_by": 56,
    "resolution_notes": "Đã xử lý xong từ giao diện người dùng",
    "timestamp": "2025-09-11T15:46:13.083Z",
    "formatted_time": "2025-09-11 15:46:13"
};

// =================== CÁCH SỬ DỤNG ===================

/**
 * 3A. GỬI EMAIL CẢNH BÁO MỚI (khi tạo warning)
 */
async function sendWarningEmail(warningData) {
    try {
        // Cách 1: Sử dụng SimpleEmailNotificationManager (KHUYÊN DÙNG)
        await simpleEmailNotificationManager.processWarningEmail(warningData);
        
        // Cách 2: Format thủ công rồi gửi
        const emailData = formatWarningDataForEmail(warningData, 'warning');
        await mailService.sendWarningEmail(emailData);
        
    } catch (error) {
        console.error('Lỗi gửi email cảnh báo:', error);
    }
}

/**
 * 3B. GỬI EMAIL THÔNG BÁO ĐÃ GIẢI QUYẾT (khi resolve warning)
 */
async function sendResolutionEmail(resolvedWarningData) {
    try {
        // Cách 1: Sử dụng SimpleEmailNotificationManager (KHUYÊN DÙNG)
        await simpleEmailNotificationManager.processResolutionEmail(resolvedWarningData);
        
        // Cách 2: Format thủ công rồi gửi
        const emailData = formatWarningDataForEmail(resolvedWarningData, 'resolution');
        await mailService.sendResolutionEmail(emailData);
        
    } catch (error) {
        console.error('Lỗi gửi email giải quyết:', error);
    }
}

/**
 * 3C. GỬI EMAIL TỔNG HỢP (digest)
 */
async function sendDigestEmail(warningsList) {
    try {
        const digestData = formatWarningsDigestForEmail(warningsList);
        await mailService.sendWarningDigest(digestData);
        
    } catch (error) {
        console.error('Lỗi gửi email tổng hợp:', error);
    }
}

// =================== TÍCH HỢP VÀO HỆ THỐNG ===================

/**
 * 4A. TRONG deviceWarningLogs.controller.js (đã tích hợp)
 */
export const resolveWarningWithEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_notes } = req.body;

        // Cập nhật database
        const result = await prisma.$queryRaw`
            UPDATE device_warning_logs 
            SET 
                status = 'resolved',
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = ${resolution_notes || null}
            WHERE id = ${parseInt(id)}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Warning log not found'
            });
        }

        // GỬI EMAIL THÔNG BÁO ĐÃ GIẢI QUYẾT
        const warningData = result[0];
        try {
            await simpleEmailNotificationManager.processResolutionEmail(warningData);
            console.log(`📧 Resolution email sent for warning ${id}`);
        } catch (emailError) {
            console.error('Lỗi gửi email resolution:', emailError);
            // Không fail request nếu email lỗi
        }

        return res.status(200).json({
            success: true,
            data: result[0],
            message: 'Warning resolved and email sent successfully'
        });

    } catch (error) {
        console.error('Error resolving warning:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resolve warning',
            error: error.message
        });
    }
};

/**
 * 4B. TRONG MQTT/Controller khi tạo warning mới (đã tích hợp)
 */
// Trong checkDeviceWarnings function
await prisma.$queryRaw`INSERT INTO device_warning_logs (...)`;

// Lấy warning vừa tạo
const newWarning = await prisma.device_warning_logs.findFirst({
    where: { 
        device_type: deviceType,
        warning_type: warning.warning_type 
    },
    orderBy: { timestamp: 'desc' }
});

// Gửi email
await simpleEmailNotificationManager.processWarningEmail(newWarning);

/**
 * 4C. TẠO SCHEDULED JOB CHO DIGEST EMAIL
 */
import cron from 'node-cron';

// Gửi digest email hàng ngày lúc 8:00 AM
cron.schedule('0 8 * * *', async () => {
    try {
        const activeWarnings = await prisma.device_warning_logs.findMany({
            where: { 
                status: 'active',
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h qua
                }
            },
            orderBy: { warning_severity: 'desc' }
        });

        if (activeWarnings.length > 0) {
            await sendDigestEmail(activeWarnings);
            console.log(`📊 Daily digest sent: ${activeWarnings.length} warnings`);
        }
    } catch (error) {
        console.error('Lỗi gửi daily digest:', error);
    }
});

// =================== MAPPING CÁC TRƯỜNG QUAN TRỌNG ===================

/**
 * 5. TÓM TẮT CÁC TRƯỜNG ĐƯỢC SỬ DỤNG TỪ DATABASE:
 * 
 * TRƯỜNG BẮT BUỘC (có trong database):
 * ✅ id - ID cảnh báo (dùng tạo notification_id)
 * ✅ device_name - Tên thiết bị 
 * ✅ device_type - Loại thiết bị
 * ✅ warning_type - Loại cảnh báo
 * ✅ warning_severity - Mức độ (critical/major/moderate/minor)
 * ✅ warning_message - Mô tả cảnh báo
 * ✅ timestamp - Thời gian tạo
 * 
 * TRƯỜNG HỮU ÍCH (có thể null):
 * ⚪ device_id - ID thiết bị (có thể null)
 * ⚪ measured_value - Giá trị đo được
 * ⚪ threshold_value - Ngưỡng cảnh báo
 * ⚪ status - active/resolved
 * 
 * TRƯỜNG CHO RESOLUTION EMAIL:
 * ✅ resolved_at - Thời gian giải quyết
 * ✅ acknowledged_by - ID người giải quyết  
 * ✅ resolution_notes - Ghi chú giải quyết
 * 
 * FORMATTER TỰ ĐỘNG THÊM:
 * 🎨 template_icon, template_color - Icons và màu sắc
 * 📧 subject_prefix - Tiền tố subject
 * 📍 device_location - Vị trí thiết bị
 * 🔧 maintenance_contact - Thông tin liên hệ
 * 📝 additional_notes - Ghi chú thêm
 * 🔢 notification_id - Mã thông báo từ ID
 * ⚡ escalation_level - Mức leo thang
 */

export {
    sendWarningEmail,
    sendResolutionEmail,
    sendDigestEmail,
    resolveWarningWithEmail
};
