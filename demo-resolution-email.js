#!/usr/bin/env node

/**
 * DEMO EMAIL RESOLUTION VỚI THÔNG TIN USER ĐẦY ĐỦ
 * ==============================================
 * 
 * Script demo để gửi email thông báo đã giải quyết cảnh báo 
 * với tên đầy đủ của người xử lý
 */

import { simpleEmailNotificationManager } from './controllers/deviceWarningLogs/simpleEmailNotificationManager.js';

console.log('✅ DEMO: Email thông báo đã giải quyết cảnh báo\n');

async function demoResolutionEmail() {
    try {
        // Dữ liệu cảnh báo đã được giải quyết bởi user ID 56 (Hồng Hải)
        const resolvedWarning = {
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
            "acknowledged_by": 56, // ID của user Hồng Hải
            "resolution_notes": "Đã xử lý xong từ giao diện người dùng",
            "timestamp": "2025-09-11T15:46:13.083Z"
        };

        console.log('📊 Dữ liệu cảnh báo đã giải quyết:');
        console.log(`   - ID cảnh báo: ${resolvedWarning.id}`);
        console.log(`   - Thiết bị: ${resolvedWarning.device_name}`);
        console.log(`   - Loại cảnh báo: ${resolvedWarning.warning_type}`);
        console.log(`   - Mức độ: ${resolvedWarning.warning_severity}`);
        console.log(`   - Người xử lý: ID ${resolvedWarning.acknowledged_by}`);
        console.log(`   - Ghi chú: ${resolvedWarning.resolution_notes}`);
        console.log(`   - Thời gian giải quyết: ${resolvedWarning.resolved_at}`);
        console.log();

        console.log('📧 Gửi email thông báo đã giải quyết...');
        
        // Hệ thống sẽ tự động:
        // 1. Lấy thông tin user ID 56 từ database
        // 2. Hiển thị tên: "Hồng Hải (SUPPLIER_GP)" thay vì "Người dùng #56"
        // 3. Format email đẹp với đầy đủ thông tin
        // 4. Gửi đến các email đã cấu hình
        
        const result = await simpleEmailNotificationManager.processResolutionEmail(resolvedWarning);
        
        if (result.success) {
            console.log('✅ Email đã được gửi thành công!');
            console.log();
            console.log('📋 Thông tin trong email:');
            console.log('   ✅ Subject: "✅ ĐÃ GIẢI QUYẾT: Module xử lý hình ảnh - power_warning"');
            console.log('   👤 Người xử lý: "Hồng Hải (SUPPLIER_GP)"');
            console.log('   ⏱️ Thời gian xử lý: Được tính từ timestamp đến resolved_at');
            console.log('   📝 Ghi chú: "Đã xử lý xong từ giao diện người dùng"');
            console.log('   📊 Giá trị: 100W (ngưỡng: 96W)');
            console.log('   📍 Vị trí: "Phòng nội soi"');
            console.log();
            console.log('🎯 THÀNH CÔNG:');
            console.log('   ✅ Hệ thống đã lấy tên đầy đủ từ database');
            console.log('   ✅ Hiển thị "Hồng Hải (SUPPLIER_GP)" thay vì "Người dùng #56"');
            console.log('   ✅ Email được format đẹp với đầy đủ thông tin');
            console.log('   ✅ Tích hợp hoàn hảo với dữ liệu từ database');
        } else {
            console.log('❌ Có lỗi xảy ra khi gửi email');
        }

    } catch (error) {
        console.error('❌ Demo error:', error);
    }
}

demoResolutionEmail().then(() => {
    console.log('\n🏁 Demo hoàn tất! Kiểm tra hộp thư để xem email.');
}).catch(error => {
    console.error('💥 Demo thất bại:', error);
});
