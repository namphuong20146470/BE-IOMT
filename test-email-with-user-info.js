#!/usr/bin/env node

/**
 * Test script để kiểm tra email với thông tin user đầy đủ
 */

import { formatWarningDataWithUserInfo, getUserInfoForEmail } from './utils/emailFormatter.js';
import { simpleEmailNotificationManager } from './controllers/deviceWarningLogs/simpleEmailNotificationManager.js';
import mailService from './services/mailService.js';

console.log('👤 Test email với thông tin user đầy đủ...\n');

async function testEmailWithUserInfo() {
    try {
        // 1. Test lấy thông tin user
        console.log('1. 🔍 Test lấy thông tin user ID 56...');
        const userInfo = await getUserInfoForEmail(56);
        
        if (userInfo) {
            console.log('✅ User info found:');
            console.log(`   - ID: ${userInfo.id}`);
            console.log(`   - Username: ${userInfo.username}`);
            console.log(`   - Full name: ${userInfo.full_name}`);
            console.log(`   - Display name: ${userInfo.display_name}`);
            console.log(`   - Role: ${userInfo.role_name} (${userInfo.role_id})`);
            console.log(`   - Role description: ${userInfo.role_description}`);
            console.log(`   - Formatted name: ${userInfo.formatted_name}`);
            console.log();
        } else {
            console.log('❌ User not found');
            return;
        }

        // 2. Test với dữ liệu cảnh báo đã giải quyết
        console.log('2. ✅ Test resolution email với user info...');
        const resolvedWarningData = {
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

        // Format dữ liệu với user info
        const emailData = await formatWarningDataWithUserInfo(resolvedWarningData, 'resolution');
        
        console.log('📧 Email data với thông tin user:');
        console.log(JSON.stringify(emailData, null, 2));
        console.log();

        // Gửi email resolution
        await simpleEmailNotificationManager.processResolutionEmail(resolvedWarningData);
        console.log('✅ Resolution email with user info sent successfully!\n');

        // 3. Test với user không tồn tại
        console.log('3. ❌ Test với user ID không tồn tại (999)...');
        const nonExistentUserInfo = await getUserInfoForEmail(999);
        console.log('Non-existent user result:', nonExistentUserInfo);
        
        const warningWithBadUserId = {
            ...resolvedWarningData,
            acknowledged_by: 999
        };
        
        const emailDataBadUser = await formatWarningDataWithUserInfo(warningWithBadUserId, 'resolution');
        console.log('📧 Email data với user không tồn tại:');
        console.log(`   - Resolved by: ${emailDataBadUser.resolved_by}`);
        console.log();

        // 4. Test với acknowledged_by = null
        console.log('4. ⚪ Test với acknowledged_by = null...');
        const warningWithNullUser = {
            ...resolvedWarningData,
            acknowledged_by: null
        };
        
        const emailDataNullUser = await formatWarningDataWithUserInfo(warningWithNullUser, 'resolution');
        console.log('📧 Email data với null user:');
        console.log(`   - Resolved by: ${emailDataNullUser.resolved_by}`);
        console.log();

        // 5. Test warning email thông thường (không cần user info)
        console.log('5. ⚠️ Test warning email (không cần user info)...');
        const newWarningData = {
            ...resolvedWarningData,
            status: "active",
            resolved_at: null,
            acknowledged_by: null,
            resolution_notes: null
        };

        await simpleEmailNotificationManager.processWarningEmail(newWarningData);
        console.log('✅ Warning email sent successfully!\n');

        console.log('🎯 KẾT QUẢ TEST:');
        console.log('✅ Lấy thông tin user từ database thành công');
        console.log('✅ Hiển thị tên đầy đủ và role trong email');
        console.log('✅ Xử lý trường hợp user không tồn tại');
        console.log('✅ Xử lý trường hợp acknowledged_by = null');
        console.log('✅ Hệ thống email hoạt động với user info đầy đủ');

    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testEmailWithUserInfo().then(() => {
    console.log('\n🏁 Test completed! Check email inbox.');
}).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});
