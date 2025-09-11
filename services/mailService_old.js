import nodemailer from 'nodemailer';
import { WARNING_RECIPIENTS } from '../config/warningRecipients.js';

// Cấu hình transporter cho mail server
const transporter = nodemailer.createTransport({
    host: 'mail.hoangphucthanh.vn',
    port: 587, // STARTTLS port
    secure: false, // false for STARTTLS
    auth: {
        user: 'haismile0901@gmail.com',
        pass: 'Hai0947976244'
    },
    tls: {
        ciphers: 'SSLv3'
    },
    debug: true, // Enable debug logging
    logger: true // Enable logger
});

/**
 * Gửi mail cảnh báo tới tất cả người nhận trong file cấu hình
 * @param {Object} warning - Thông tin cảnh báo
 */
export async function sendWarningMail(warning) {
    console.log('🔄 Đang chuẩn bị gửi mail cảnh báo...');
    console.log('📧 Người nhận:', WARNING_RECIPIENTS);
    console.log('⚠️ Nội dung cảnh báo:', warning);
    
    const mailOptions = {
        from: 'IoT Warning <haismile0901@gmail.com>',
        to: WARNING_RECIPIENTS.join(','),
        subject: `Cảnh báo thiết bị: ${warning.device_name}`,
        text:
            `Loại cảnh báo: ${warning.warning_type}\n` +
            `Mức độ: ${warning.warning_severity}\n` +
            `Thông điệp: ${warning.warning_message}\n` +
            `Thời gian: ${warning.timestamp}\n` +
            `Thiết bị: ${warning.device_id || 'Không xác định'}`
    };
    try {
        console.log('📤 Đang gửi mail...');
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Gửi mail thành công!', result.messageId);
        return { success: true };
    } catch (error) {
        console.error('❌ Lỗi gửi mail:', error.message);
        return { success: false, error: error.message };
    }
}
