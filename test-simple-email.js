#!/usr/bin/env node

import mailService from './services/mailService.js';
import { simpleEmailNotificationManager } from './controllers/deviceWarningLogs/simpleEmailNotificationManager.js';

console.log('📧 Test gửi email đơn giản...\n');

async function simpleEmailTest() {
    try {
        console.log('1. Test mailService trực tiếp...');
        
        const testWarningData = {
            device_name: 'Test Device - Direct MailService',
            device_id: 'TEST_DIRECT',
            warning_type: 'test_direct',
            severity: 'major',
            message: 'Đây là test email trực tiếp từ mailService',
            created_at: new Date().toISOString()
        };
        
        await mailService.sendWarningEmail(testWarningData);
        console.log('✅ Direct mailService test - SUCCESS\n');
        
        console.log('2. Test qua SimpleEmailNotificationManager...');
        
        const testWarningData2 = {
            device_name: 'Test Device - Simple Manager',
            device_id: 'TEST_SIMPLE',
            warning_type: 'test_simple',
            severity: 'critical',
            message: 'Đây là test email qua SimpleEmailNotificationManager',
            current_value: 300,
            threshold_value: 240,
            created_at: new Date().toISOString(),
            device_location: 'Test Room 101',
            maintenance_contact: 'Test Team - Ext: 1234'
        };
        
        await simpleEmailNotificationManager.processWarningEmail(testWarningData2);
        console.log('✅ SimpleEmailNotificationManager test - SUCCESS\n');
        
        console.log('🎉 CẢ HAI PHƯƠNG PHÁP GỬI EMAIL ĐỀU HOẠT ĐỘNG!');
        console.log('📬 Kiểm tra hộp thư để xác nhận email đã được gửi.');
        
    } catch (error) {
        console.error('❌ Lỗi:', error);
    }
}

simpleEmailTest();
