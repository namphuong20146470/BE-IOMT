#!/usr/bin/env node

/**
 * Test script sử dụng dữ liệu đầy đủ từ database để gửi email
 */

import { formatWarningDataForEmail, formatWarningsDigestForEmail } from './utils/emailFormatter.js';
import { simpleEmailNotificationManager } from './controllers/deviceWarningLogs/simpleEmailNotificationManager.js';
import mailService from './services/mailService.js';

console.log('📧 Test email với dữ liệu đầy đủ từ database...\n');

async function testFullDatabaseFormatEmail() {
    try {
        // Dữ liệu mẫu từ database (như bạn cung cấp)
        const warningFromDB = {
            "id": 8220,
            "device_type": "camera_control_unit",
            "device_name": "Module xử lý hình ảnh",
            "device_id": null,
            "warning_type": "power_warning",
            "warning_severity": "moderate",
            "measured_value": 100,
            "threshold_value": 96,
            "warning_message": "Công suất vượt ngưỡng",
            "status": "active", // Thay đổi để test warning email
            "resolved_at": null,
            "acknowledged_by": null,
            "resolution_notes": null,
            "timestamp": "2025-09-11T15:46:13.083Z",
            "formatted_time": "2025-09-11 15:46:13"
        };

        console.log('📊 Dữ liệu gốc từ database:');
        console.log(JSON.stringify(warningFromDB, null, 2));
        console.log();

        // 1. Test gửi warning email
        console.log('1. 🚨 Test gửi WARNING EMAIL...');
        const warningEmailData = formatWarningDataForEmail(warningFromDB, 'warning');
        
        console.log('📧 Dữ liệu đã format cho warning email:');
        console.log(JSON.stringify(warningEmailData, null, 2));
        console.log();
        
        // Gửi qua SimpleEmailNotificationManager
        await simpleEmailNotificationManager.processWarningEmail(warningFromDB);
        console.log('✅ Warning email sent successfully!\n');

        // 2. Test gửi resolution email
        console.log('2. ✅ Test gửi RESOLUTION EMAIL...');
        const resolvedWarning = {
            ...warningFromDB,
            "status": "resolved",
            "resolved_at": "2025-09-11T15:48:32.523Z",
            "acknowledged_by": 56,
            "resolution_notes": "Đã xử lý xong từ giao diện người dùng"
        };

        const resolutionEmailData = formatWarningDataForEmail(resolvedWarning, 'resolution');
        
        console.log('📧 Dữ liệu đã format cho resolution email:');
        console.log(JSON.stringify(resolutionEmailData, null, 2));
        console.log();
        
        // Gửi qua SimpleEmailNotificationManager
        await simpleEmailNotificationManager.processResolutionEmail(resolvedWarning);
        console.log('✅ Resolution email sent successfully!\n');

        // 3. Test gửi digest email
        console.log('3. 📊 Test gửi DIGEST EMAIL...');
        const multipleWarnings = [
            warningFromDB,
            {
                "id": 8221,
                "device_type": "auo_display",
                "device_name": "Màn hình y tế AUO",
                "device_id": 12345,
                "warning_type": "voltage_high",
                "warning_severity": "critical",
                "measured_value": 350,
                "threshold_value": 240,
                "warning_message": "Điện áp vượt ngưỡng nghiêm trọng",
                "status": "active",
                "timestamp": "2025-09-11T15:50:00.000Z"
            },
            {
                "id": 8222,
                "device_type": "iot_environment_status",
                "device_name": "Môi trường IoT",
                "device_id": 67890,
                "warning_type": "temperature_high",
                "warning_severity": "major",
                "measured_value": 50,
                "threshold_value": 40,
                "warning_message": "Nhiệt độ quá cao",
                "status": "active",
                "timestamp": "2025-09-11T15:45:00.000Z"
            }
        ];

        const digestEmailData = formatWarningsDigestForEmail(multipleWarnings);
        
        console.log('📧 Dữ liệu đã format cho digest email:');
        console.log(JSON.stringify(digestEmailData, null, 2));
        console.log();
        
        // Gửi digest email trực tiếp qua mailService
        await mailService.sendWarningDigest(digestEmailData);
        console.log('✅ Digest email sent successfully!\n');

        // 4. Tóm tắt các trường quan trọng
        console.log('4. 📋 TÓM TẮT CÁC TRƯỜNG QUAN TRỌNG CHO EMAIL:');
        console.log('');
        console.log('🔸 TRƯỜNG BẮT BUỘC:');
        console.log('   - id: ID cảnh báo trong database');
        console.log('   - device_name: Tên thiết bị');
        console.log('   - device_type: Loại thiết bị');
        console.log('   - warning_type: Loại cảnh báo');
        console.log('   - warning_severity: Mức độ nghiêm trọng');
        console.log('   - warning_message: Mô tả cảnh báo');
        console.log('   - timestamp: Thời gian phát hiện');
        console.log('');
        console.log('🔸 TRƯỜNG HỮU ÍCH:');
        console.log('   - device_id: ID thiết bị (có thể null)');
        console.log('   - measured_value: Giá trị đo được');
        console.log('   - threshold_value: Ngưỡng cảnh báo');
        console.log('   - status: Trạng thái (active/resolved)');
        console.log('');
        console.log('🔸 TRƯỜNG CHO RESOLUTION EMAIL:');
        console.log('   - resolved_at: Thời gian giải quyết');
        console.log('   - acknowledged_by: ID người giải quyết');
        console.log('   - resolution_notes: Ghi chú giải quyết');
        console.log('');
        console.log('🎯 emailFormatter.js sẽ tự động:');
        console.log('   ✅ Mapping severity thành format chuẩn');
        console.log('   ✅ Thêm icons và colors phù hợp');
        console.log('   ✅ Tạo subject line đẹp');
        console.log('   ✅ Thêm thông tin vị trí và liên hệ');
        console.log('   ✅ Tạo notification ID từ warning ID');
        console.log('   ✅ Tính toán priority từ severity');

    } catch (error) {
        console.error('❌ Lỗi:', error);
    }
}

testFullDatabaseFormatEmail().then(() => {
    console.log('\n🏁 Test hoàn tất! Kiểm tra email trong hộp thư.');
}).catch(error => {
    console.error('💥 Test thất bại:', error);
});
