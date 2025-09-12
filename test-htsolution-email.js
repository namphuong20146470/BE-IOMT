// Test gửi email cho địa chỉ ALERT_EMAIL_3=htsolutiontech@gmail.com
import dotenv from 'dotenv';
import mailService from './services/mailService.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing email cho địa chỉ htsolutiontech@gmail.com...\n');

// Check environment variables
console.log('📧 Environment variables check:');
console.log('ALERT_EMAIL_1:', process.env.ALERT_EMAIL_1);
console.log('ALERT_EMAIL_2:', process.env.ALERT_EMAIL_2);
console.log('ALERT_EMAIL_3:', process.env.ALERT_EMAIL_3);
console.log('ALERT_EMAIL_4:', process.env.ALERT_EMAIL_4);
console.log('ALERT_EMAIL_5:', process.env.ALERT_EMAIL_5);

// Check recipients function
console.log('\n📋 Recipients từ getRecipients():');
const recipients = mailService.getRecipients();
console.log('Total recipients:', recipients.length);
recipients.forEach((email, index) => {
    console.log(`  ${index + 1}: ${email}`);
});

// Check if htsolutiontech@gmail.com is in the list
const targetEmail = 'htsolutiontech@gmail.com';
const isIncluded = recipients.includes(targetEmail);
console.log(`\n🎯 Target email "${targetEmail}" included:`, isIncluded);

if (!isIncluded) {
    console.log('❌ Email không có trong danh sách recipients!');
    console.log('🔍 Kiểm tra lại ALERT_EMAIL_3 value:', `"${process.env.ALERT_EMAIL_3}"`);
    console.log('🔍 Length:', process.env.ALERT_EMAIL_3?.length);
    console.log('🔍 Có ký tự đặc biệt không:', JSON.stringify(process.env.ALERT_EMAIL_3));
} else {
    console.log('✅ Email có trong danh sách recipients');
}

// Test email validation
console.log('\n📝 Email validation test:');
const emailToTest = process.env.ALERT_EMAIL_3;
console.log('Email value:', `"${emailToTest}"`);
console.log('Is truthy:', !!emailToTest);
console.log('After trim:', `"${emailToTest?.trim()}"`);
console.log('Contains @:', emailToTest?.includes('@'));
console.log('Validation result:', !!(emailToTest && emailToTest.trim() && emailToTest.includes('@')));

// Test SMTP connection
console.log('\n🔌 Testing SMTP connection...');
try {
    const connectionTest = await mailService.testConnection();
    console.log('Connection result:', connectionTest);
} catch (error) {
    console.error('Connection error:', error.message);
}

// Test sending actual email
console.log('\n📤 Testing actual email send...');

const testWarningData = {
    device_name: 'Test Device for htsolutiontech@gmail.com',
    device_id: 'TEST_001',
    warning_type: 'test_email',
    warning_severity: 'major',
    severity: 'high',
    measured_value: 100,
    threshold_value: 90,
    warning_message: 'Test email cho htsolutiontech@gmail.com',
    created_at: new Date().toISOString(),
    status: 'active',
    template_icon: '🧪',
    template_color: '#f57c00',
    notification_id: `TEST-${Date.now()}`
};

try {
    console.log('🚀 Sending test email...');
    console.log('Recipients will be:', recipients);
    
    const result = await mailService.sendWarningEmail(testWarningData);
    console.log('📧 Email send result:', result);
    
    if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log('📨 Message ID:', result.messageId);
        console.log('👥 Sent to', result.recipients, 'recipients');
    } else {
        console.log('❌ Email sending failed:', result.error);
    }
    
} catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.error('Stack:', error.stack);
}

// Check mailService status
console.log('\n📊 MailService status:');
const status = mailService.getStatus();
console.log('Enabled:', status.enabled);
console.log('Transporter initialized:', status.transporter);
console.log('Rate limit:', status.rateLimit);
console.log('Sent count:', status.sentCount);
console.log('Recipients count:', status.recipients.length);
console.log('All recipients:', status.recipients);
