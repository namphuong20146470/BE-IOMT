/**
 * Demo gửi email với format giá trị chuẩn - dữ liệu thực từ user
 */

import { formatWarningDataWithUserInfo } from './utils/emailFormatter.js';
import mailService from './services/mailService.js';

// Dữ liệu thực từ user
const realWarningData = {
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

async function sendFormattedValueDemo() {
    console.log('📧 Demo Email với Format Giá Trị Chuẩn');
    console.log('=====================================\n');
    
    try {
        console.log('📊 Dữ liệu gốc:');
        console.log(`   Device: ${realWarningData.device_name}`);
        console.log(`   Warning: ${realWarningData.warning_message}`);
        console.log(`   Measured: ${realWarningData.measured_value} (raw)`);
        console.log(`   Threshold: ${realWarningData.threshold_value} (raw)`);
        console.log(`   Status: ${realWarningData.status}`);
        console.log('');
        
        // Format dữ liệu cho email
        console.log('✨ Format dữ liệu...');
        const formattedData = await formatWarningDataWithUserInfo(realWarningData, 'resolution');
        
        console.log('📋 Dữ liệu đã format:');
        console.log(`   Current Value: ${formattedData.current_value}`);
        console.log(`   Threshold Value: ${formattedData.threshold_value}`);
        console.log(`   Comparison: ${formattedData.value_comparison}`);
        console.log(`   Resolved by: ${formattedData.resolved_by}`);
        console.log('');
        
        // Tạo email content preview
        const emailPreview = {
            subject: `${formattedData.subject_prefix}: ${formattedData.device_name} - ${formattedData.template_description}`,
            body: `
📍 Thiết bị: ${formattedData.device_name}
🔧 Loại: ${formattedData.template_description}
⚠️ Mức độ: ${formattedData.severity.toUpperCase()} ${formattedData.template_icon}

📊 Giá trị:
• Giá trị hiện tại: ${formattedData.current_value}
• Ngưỡng cảnh báo: ${formattedData.threshold_value}  
• So sánh: ${formattedData.value_comparison}

✅ Đã giải quyết:
• Người xử lý: ${formattedData.resolved_by}
• Thời gian: ${new Date(formattedData.resolution_time).toLocaleString('vi-VN')}
• Ghi chú: ${formattedData.resolution_notes}

📝 Message: ${formattedData.message}
🏥 Vị trí: ${formattedData.device_location}
☎️ Liên hệ: ${formattedData.maintenance_contact}
            `.trim()
        };
        
        console.log('📧 Email Preview:');
        console.log('================');
        console.log(`Subject: ${emailPreview.subject}`);
        console.log('');
        console.log('Body:');
        console.log(emailPreview.body);
        console.log('');
        
        // Gửi email thật
        console.log('🚀 Gửi email...');
        const result = await mailService.sendResolutionEmail(formattedData);
        
        if (result.success) {
            console.log('✅ Email đã được gửi thành công!');
            console.log(`📤 Message ID: ${result.messageId}`);
        } else {
            console.log('❌ Lỗi gửi email:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

sendFormattedValueDemo().catch(console.error);
