import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class MailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = process.env.EMAIL_ENABLED === 'true';
    this.debugMode = process.env.DEBUG_EMAILS === 'true';
    this.rateLimit = parseInt(process.env.EMAIL_RATE_LIMIT) || 100;
    this.sentCount = 0;
    this.lastResetTime = new Date();
    
    if (this.isEnabled) {
      this.initTransporter();
    }
  }

  initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT),
        secure: process.env.MAIL_ENCRYPTION === 'ssl', // true for 465, false for other ports
        auth: {
          user: process.env.MAIL_USERNAME,
          pass: process.env.MAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email transporter verification failed:', error);
        } else {
          console.log('✅ Email service ready for messages');
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
    }
  }

  checkRateLimit() {
    const now = new Date();
    const hoursPassed = (now - this.lastResetTime) / (1000 * 60 * 60);
    
    if (hoursPassed >= 1) {
      this.sentCount = 0;
      this.lastResetTime = now;
    }
    
    return this.sentCount < this.rateLimit;
  }

  async sendWarningEmail(warningData) {
    if (!this.isEnabled) {
      console.log('📧 Email sending disabled');
      return { success: false, message: 'Email sending disabled' };
    }

    if (!this.checkRateLimit()) {
      console.log('📧 Rate limit exceeded, skipping email');
      return { success: false, message: 'Rate limit exceeded' };
    }

    if (!this.transporter) {
      console.error('❌ Email transporter not initialized');
      return { success: false, message: 'Email transporter not initialized' };
    }

    try {
      const recipients = this.getRecipients();
      const htmlContent = this.generateWarningEmailHTML(warningData);
      const textContent = this.generateWarningEmailText(warningData);

      const mailOptions = {
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: recipients.join(','),
        subject: `🚨 Cảnh báo thiết bị: ${warningData.device_name} - ${warningData.warning_type}`,
        text: textContent,
        html: htmlContent,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };

      if (this.debugMode) {
        console.log('📧 Sending warning email:', {
          to: recipients,
          subject: mailOptions.subject,
          device: warningData.device_name,
          warning: warningData.warning_type
        });
      }

      const result = await this.transporter.sendMail(mailOptions);
      this.sentCount++;
      
      console.log('✅ Warning email sent successfully:', result.messageId);
      return { 
        success: true, 
        messageId: result.messageId,
        recipients: recipients.length 
      };

    } catch (error) {
      console.error('❌ Failed to send warning email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMaintenanceNotification(maintenanceData) {
    if (!this.isEnabled) {
      return { success: false, message: 'Email sending disabled' };
    }

    if (!this.checkRateLimit()) {
      return { success: false, message: 'Rate limit exceeded' };
    }

    try {
      const recipients = this.getRecipients();
      const htmlContent = this.generateMaintenanceEmailHTML(maintenanceData);

      const mailOptions = {
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: recipients.join(','),
        subject: `🔧 Thông báo bảo trì: ${maintenanceData.device_name}`,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.sentCount++;
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send maintenance notification:', error);
      return { success: false, error: error.message };
    }
  }

  getRecipients() {
    const recipients = [];
    
    if (process.env.ALERT_EMAIL_1) recipients.push(process.env.ALERT_EMAIL_1);
    if (process.env.ALERT_EMAIL_2) recipients.push(process.env.ALERT_EMAIL_2);
    if (process.env.ALERT_EMAIL_3) recipients.push(process.env.ALERT_EMAIL_3);
    
    return recipients.filter(email => email && email.includes('@'));
  }

  generateWarningEmailHTML(data) {
    const severity = this.getSeverityInfo(data.severity);
    const now = new Date().toLocaleString('vi-VN');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Cảnh báo thiết bị IoT</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: ${severity.color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .warning-box { background: ${severity.bgColor}; border-left: 4px solid ${severity.color}; padding: 15px; margin: 15px 0; }
            .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .info-table th, .info-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .info-table th { background-color: #f8f9fa; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${severity.icon} CẢNH BÁO THIẾT BỊ IoT</h1>
                <p>Hệ thống giám sát - Bệnh viện Đa khoa Thái Phương</p>
            </div>
            
            <div class="content">
                <div class="warning-box">
                    <h2>⚠️ ${data.warning_type}</h2>
                    <p><strong>Thiết bị:</strong> ${data.device_name} (ID: ${data.device_id})</p>
                    <p><strong>Mức độ:</strong> <span class="status-badge" style="background: ${severity.color}; color: white;">${severity.text}</span></p>
                </div>
                
                <table class="info-table">
                    <tr><th>Thông tin</th><th>Chi tiết</th></tr>
                    <tr><td>Thời gian phát hiện</td><td>${new Date(data.created_at).toLocaleString('vi-VN')}</td></tr>
                    <tr><td>Giá trị hiện tại</td><td>${data.current_value || 'N/A'}</td></tr>
                    <tr><td>Ngưỡng cảnh báo</td><td>${data.threshold_value || 'N/A'}</td></tr>
                    <tr><td>Mô tả</td><td>${data.message || 'Không có mô tả'}</td></tr>
                    <tr><td>Trạng thái</td><td>${data.status === 'active' ? '🔴 Đang hoạt động' : '✅ Đã giải quyết'}</td></tr>
                    <tr><td>Thời gian gửi email</td><td>${now}</td></tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 4px;">
                    <h3>📋 Khuyến nghị xử lý:</h3>
                    <ul>
                        <li>Kiểm tra ngay thiết bị <strong>${data.device_name}</strong></li>
                        <li>Xác minh các thông số kỹ thuật</li>
                        <li>Ghi lại hành động khắc phục trong hệ thống</li>
                        <li>Liên hệ kỹ thuật nếu cần hỗ trợ</li>
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <p>Email tự động từ Hệ thống giám sát IoT - BVĐKTP</p>
                <p>Thời gian: ${now} | Không trả lời email này</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generateWarningEmailText(data) {
    const severity = this.getSeverityInfo(data.severity);
    return `
🚨 CẢNH BÁO THIẾT BỊ IoT - BVĐKTP

⚠️ Loại cảnh báo: ${data.warning_type}
📱 Thiết bị: ${data.device_name} (ID: ${data.device_id})
🔥 Mức độ: ${severity.text}
⏰ Thời gian: ${new Date(data.created_at).toLocaleString('vi-VN')}

📊 Chi tiết:
- Giá trị hiện tại: ${data.current_value || 'N/A'}
- Ngưỡng cảnh báo: ${data.threshold_value || 'N/A'}
- Mô tả: ${data.message || 'Không có mô tả'}
- Trạng thái: ${data.status === 'active' ? 'Đang hoạt động' : 'Đã giải quyết'}

🔧 Khuyến nghị:
1. Kiểm tra ngay thiết bị
2. Xác minh thông số kỹ thuật
3. Ghi lại hành động khắc phục
4. Liên hệ kỹ thuật nếu cần

---
Hệ thống giám sát IoT - BVĐKTP
Email tự động - Không trả lời
    `;
  }

  generateMaintenanceEmailHTML(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Thông báo bảo trì thiết bị</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .footer { background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔧 THÔNG BÁO BẢO TRÌ</h1>
            </div>
            <div class="content">
                <h2>Thiết bị: ${data.device_name}</h2>
                <p><strong>Loại bảo trì:</strong> ${data.maintenance_type}</p>
                <p><strong>Thời gian dự kiến:</strong> ${new Date(data.scheduled_date).toLocaleString('vi-VN')}</p>
                <p><strong>Mô tả:</strong> ${data.description}</p>
            </div>
            <div class="footer">
                <p>Hệ thống giám sát IoT - BVĐKTP</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getSeverityInfo(severity) {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return {
          text: 'NGHIÊM TRỌNG',
          color: '#d32f2f',
          bgColor: '#ffebee',
          icon: '🔴'
        };
      case 'high':
        return {
          text: 'CAO',
          color: '#f57c00',
          bgColor: '#fff3e0',
          icon: '🟠'
        };
      case 'medium':
        return {
          text: 'TRUNG BÌNH',
          color: '#fbc02d',
          bgColor: '#fffde7',
          icon: '🟡'
        };
      case 'low':
        return {
          text: 'THẤP',
          color: '#388e3c',
          bgColor: '#e8f5e8',
          icon: '🟢'
        };
      default:
        return {
          text: 'KHÔNG XÁC ĐỊNH',
          color: '#757575',
          bgColor: '#f5f5f5',
          icon: '⚪'
        };
    }
  }

  async testConnection() {
    if (!this.transporter) {
      return { success: false, message: 'Transporter not initialized' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      transporter: !!this.transporter,
      rateLimit: this.rateLimit,
      sentCount: this.sentCount,
      recipients: this.getRecipients(),
      lastReset: this.lastResetTime
    };
  }

  // Legacy function để tương thích với code cũ
  async sendWarningMail(warning) {
    return await this.sendWarningEmail(warning);
  }
}

export default new MailService();
