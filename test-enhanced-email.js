import { emailNotificationManager } from './controllers/deviceWarningLogs/emailNotificationManager.js';
import mailService from './services/mailService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test Enhanced Email Notification System
 */
async function testEnhancedEmailSystem() {
    console.log('🧪 Testing Enhanced Email Notification System...\n');

    try {
        // Test 1: Basic MailService Status
        console.log('📊 1. MailService Status:');
        const status = mailService.getStatus();
        console.log(JSON.stringify(status, null, 2));
        console.log();

        // Test 2: Connection Test
        console.log('🔌 2. Testing SMTP Connection:');
        const connectionTest = await mailService.testConnection();
        console.log('Connection result:', connectionTest);
        console.log();

        if (!connectionTest.success) {
            console.log('❌ Cannot proceed without SMTP connection');
            return;
        }

        // Test 3: Single Warning Email (Enhanced)
        console.log('📧 3. Testing Enhanced Warning Email:');
        const testWarningData = {
            id: 'test-warning-001',
            device_id: 'DEVICE_001',
            device_name: 'Màn hình y tế AUO - Phòng 101',
            device_model: 'AUO-MED-2024',
            device_location: 'Phòng 101 - Khoa Nội',
            warning_type: 'temperature_high',
            severity: 'high',
            message: 'Nhiệt độ vượt ngưỡng an toàn',
            current_value: '45.2°C',
            threshold_value: '40°C',
            created_at: new Date().toISOString(),
            status: 'active',
            maintenance_contact: 'Phòng Kỹ thuật - Ext: 1234',
            additional_notes: 'Cần kiểm tra hệ thống làm mát ngay lập tức'
        };

        const enhancedResult = await emailNotificationManager.processWarningEmail(testWarningData, {
            immediate: true
        });
        console.log('Enhanced email result:', enhancedResult);
        console.log();

        // Test 4: Critical Warning (Immediate)
        console.log('🚨 4. Testing Critical Warning (Immediate):');
        const criticalWarning = {
            ...testWarningData,
            id: 'test-critical-001',
            device_name: 'Thiết bị cấp cứu - ICU',
            warning_type: 'device_offline',
            severity: 'critical',
            message: 'Thiết bị mất kết nối hoàn toàn',
            current_value: 'Offline',
            threshold_value: 'Online',
            device_location: 'ICU - Tầng 3'
        };

        const criticalResult = await emailNotificationManager.processWarningEmail(criticalWarning);
        console.log('Critical email result:', criticalResult);
        console.log();

        // Test 5: Warning Digest
        console.log('📊 5. Testing Warning Digest:');
        const multipleWarnings = [
            {
                ...testWarningData,
                id: 'digest-warning-1',
                device_name: 'Thiết bị A',
                severity: 'critical',
                warning_type: 'voltage_abnormal'
            },
            {
                ...testWarningData,
                id: 'digest-warning-2',
                device_name: 'Thiết bị B',
                severity: 'high',
                warning_type: 'current_overload'
            },
            {
                ...testWarningData,
                id: 'digest-warning-3',
                device_name: 'Thiết bị C',
                severity: 'medium',
                warning_type: 'humidity_high'
            }
        ];

        const digestResult = await emailNotificationManager.sendWarningDigest(multipleWarnings, {
            digest_period: '1 hour',
            generated_by: 'System Scheduler'
        });
        console.log('Digest email result:', digestResult);
        console.log();

        // Test 6: Resolution Email
        console.log('✅ 6. Testing Resolution Email:');
        const resolutionResult = await emailNotificationManager.sendResolutionEmail('test-warning-001', {
            resolved_by: 'Nguyễn Văn A - Kỹ thuật viên',
            notes: 'Đã thay thế cảm biến nhiệt độ và kiểm tra hệ thống làm mát',
            resolution_time: new Date().toISOString()
        });
        console.log('Resolution email result:', resolutionResult);
        console.log();

        // Test 7: Email Escalation
        console.log('⬆️ 7. Testing Email Escalation:');
        const escalationResult = await emailNotificationManager.processEmailEscalation('test-warning-001', 2);
        console.log('Escalation email result:', escalationResult);
        console.log();

        // Test 8: Direct MailService Features
        console.log('🔧 8. Testing Direct MailService Features:');
        
        // Test different email types
        const resolutionEmailDirect = await mailService.sendResolutionEmail({
            device_name: 'Test Device Direct',
            device_id: 'DIRECT_001',
            warning_type: 'test_resolution',
            severity: 'medium',
            message: 'Test resolution message',
            created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            resolution_time: new Date().toISOString(),
            resolved_by: 'Test System',
            resolution_notes: 'Resolved by test system'
        });
        console.log('Direct resolution email result:', resolutionEmailDirect);

        // Test digest email directly
        const digestEmailDirect = await mailService.sendWarningDigest({
            warning_count: 3,
            critical_count: 1,
            high_count: 2,
            warnings: multipleWarnings.slice(0, 2) // Just first 2
        });
        console.log('Direct digest email result:', digestEmailDirect);
        console.log();

        // Test 9: Error Handling
        console.log('⚠️ 9. Testing Error Handling:');
        try {
            await emailNotificationManager.processWarningEmail({
                // Missing required fields to test error handling
                device_id: 'ERROR_TEST'
            });
        } catch (error) {
            console.log('Expected error caught:', error.message);
        }

        // Test 10: Performance Test
        console.log('⚡ 10. Performance Test (Multiple Emails):');
        const startTime = Date.now();
        const promises = [];
        
        for (let i = 0; i < 3; i++) {
            const perfTestData = {
                ...testWarningData,
                id: `perf-test-${i}`,
                device_name: `Test Device ${i}`,
                warning_type: 'performance_test',
                severity: i === 0 ? 'critical' : i === 1 ? 'high' : 'medium'
            };
            
            promises.push(emailNotificationManager.processWarningEmail(perfTestData, {
                immediate: true
            }));
        }
        
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        
        console.log(`Processed ${promises.length} emails in ${endTime - startTime}ms`);
        console.log('Results:', results.map(r => r.status));
        console.log();

        console.log('✅ Enhanced Email System Test Completed Successfully!');
        
        // Summary
        console.log('\n📈 Test Summary:');
        console.log(`- SMTP Connection: ${connectionTest.success ? 'OK' : 'FAILED'}`);
        console.log(`- Enhanced Warning Email: ${enhancedResult.success ? 'OK' : 'FAILED'}`);
        console.log(`- Critical Warning: ${criticalResult.success ? 'OK' : 'FAILED'}`);
        console.log(`- Digest Email: ${digestResult.success ? 'OK' : 'FAILED'}`);
        console.log(`- Resolution Email: ${resolutionResult.success ? 'OK' : 'FAILED'}`);
        console.log(`- Performance Test: ${results.filter(r => r.status === 'fulfilled').length}/${results.length} succeeded`);

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Run the test
console.log('🚀 Starting Enhanced Email System Test Suite...');
console.log('================================================\n');

testEnhancedEmailSystem().catch(console.error);
