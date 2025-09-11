import mailService from './services/mailService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 Environment variables loaded:');
console.log('EMAIL_ENABLED:', process.env.EMAIL_ENABLED);
console.log('MAIL_HOST:', process.env.MAIL_HOST);
console.log('MAIL_USERNAME:', process.env.MAIL_USERNAME ? '***' : 'NOT SET');
console.log(''); 

async function testSMTPConnection() {
    console.log('🧪 Testing SMTP configuration...\n');
    
    // Test 1: Check service status
    console.log('📊 Service Status:');
    const status = mailService.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log('\n');
    
    // Test 2: Test SMTP connection
    console.log('🔌 Testing SMTP connection...');
    const connectionTest = await mailService.testConnection();
    console.log('Connection result:', connectionTest);
    console.log('\n');
    
    // Test 3: Send test warning email
    if (connectionTest.success) {
        console.log('📧 Sending test warning email...');
        const testWarningData = {
            device_id: 'TEST_DEVICE_001',
            device_name: 'Thiết bị test SMTP',
            warning_type: 'TEST_WARNING',
            severity: 'medium',
            message: 'Đây là email test để kiểm tra cấu hình SMTP',
            current_value: '25.5°C',
            threshold_value: '30°C',
            status: 'active',
            created_at: new Date().toISOString()
        };
        
        const emailResult = await mailService.sendWarningEmail(testWarningData);
        console.log('Email result:', emailResult);
    } else {
        console.log('❌ Skipping email test due to connection failure');
    }
}

// Run the test
testSMTPConnection().catch(console.error);
