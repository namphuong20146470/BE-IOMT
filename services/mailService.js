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
      const emailType = warningData.type || 'warning';
      
      let htmlContent, textContent, subject;
      
      switch(emailType) {
        case 'digest':
          htmlContent = this.generateDigestEmailHTML(warningData);
          textContent = this.generateDigestEmailText(warningData);
          subject = `📊 Tổng hợp cảnh báo: ${warningData.warning_count} cảnh báo`;
          break;
        case 'resolution':
          htmlContent = this.generateResolutionEmailHTML(warningData);
          textContent = this.generateResolutionEmailText(warningData);
          subject = `✅ ĐÃ GIẢI QUYẾT: ${warningData.device_name} - ${warningData.warning_type}`;
          break;
        default:
          htmlContent = this.generateWarningEmailHTML(warningData);
          textContent = this.generateWarningEmailText(warningData);
          subject = this.generateEmailSubject(warningData);
      }

      const mailOptions = {
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: recipients.join(','),
        subject: subject,
        text: textContent,
        html: htmlContent,
        priority: this.getEmailPriority(warningData.priority || warningData.severity),
        headers: {
          'X-Priority': this.getPriorityNumber(warningData.priority || warningData.severity),
          'X-MSMail-Priority': this.getMSMailPriority(warningData.priority || warningData.severity),
          'Importance': warningData.priority || 'normal',
          'X-Warning-Type': warningData.warning_type,
          'X-Device-ID': warningData.device_id,
          'X-Notification-ID': warningData.notification_id || 'none'
        }
      };

      if (this.debugMode) {
        console.log('📧 Sending warning email:', {
          type: emailType,
          to: recipients,
          subject: mailOptions.subject,
          device: warningData.device_name,
          warning: warningData.warning_type,
          priority: warningData.priority || warningData.severity
        });
      }

      const result = await this.transporter.sendMail(mailOptions);
      this.sentCount++;
      
      console.log(`✅ ${emailType} email sent successfully:`, result.messageId);
      return { 
        success: true, 
        messageId: result.messageId,
        recipients: recipients.length,
        type: emailType
      };

    } catch (error) {
      console.error(`❌ Failed to send ${warningData.type || 'warning'} email:`, error);
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
    const templateIcon = data.template_icon || severity.icon;
    const templateColor = data.template_color || severity.color;
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
            .header { background: ${templateColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .warning-box { background: ${severity.bgColor}; border-left: 4px solid ${templateColor}; padding: 15px; margin: 15px 0; }
            .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .info-table th, .info-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .info-table th { background-color: #f8f9fa; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .escalation-badge { background: #ff5722; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px; }
            .notification-id { font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 2px; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${templateIcon} CẢNH BÁO THIẾT BỊ IoT</h1>
                <p>Hệ thống giám sát</p>
                ${data.escalation_level > 1 ? `<span class="escalation-badge">LEVEL ${data.escalation_level} ESCALATION</span>` : ''}
            </div>
            
            <div class="content">
                <div class="warning-box">
                    <h2>⚠️ ${data.warning_type}</h2>
                    <p><strong>Thiết bị:</strong> ${data.device_name} ${data.device_model ? `(${data.device_model})` : ''} (ID: ${data.device_id})</p>
                    <p><strong>Mức độ:</strong> <span class="status-badge" style="background: ${templateColor}; color: white;">${severity.text}</span></p>
                    ${data.device_location ? `<p><strong>Vị trí:</strong> ${data.device_location}</p>` : ''}
                    ${data.template_description ? `<p><strong>Mô tả:</strong> ${data.template_description}</p>` : ''}
                </div>
                
                <table class="info-table">
                    <tr><th>Thông tin</th><th>Chi tiết</th></tr>
                    <tr><td>Thời gian phát hiện</td><td>${new Date(data.created_at).toLocaleString('vi-VN')}</td></tr>
                    <tr><td>Giá trị hiện tại</td><td>${data.current_value || 'N/A'}</td></tr>
                    <tr><td>Ngưỡng cảnh báo</td><td>${data.threshold_value || 'N/A'}</td></tr>
                    <tr><td>Mô tả</td><td>${data.message || 'Không có mô tả'}</td></tr>
                    <tr><td>Trạng thái</td><td>${data.status === 'active' ? '🔴 Đang hoạt động' : '✅ Đã giải quyết'}</td></tr>
                    <tr><td>Độ ưu tiên</td><td>${this.getPriorityText(data.priority || data.severity)}</td></tr>
                    ${data.escalation_level > 1 ? `<tr><td>Mức leo thang</td><td>Level ${data.escalation_level}</td></tr>` : ''}
                    ${data.notification_id ? `<tr><td>Mã thông báo</td><td><span class="notification-id">${data.notification_id}</span></td></tr>` : ''}
                    <tr><td>Thời gian gửi email</td><td>${now}</td></tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 4px;">
                    <h3>📋 Khuyến nghị xử lý:</h3>
                    <ul>
                        <li>Kiểm tra ngay thiết bị <strong>${data.device_name}</strong></li>
                        <li>Xác minh các thông số kỹ thuật</li>
                        <li>Ghi lại hành động khắc phục trong hệ thống</li>
                        ${data.maintenance_contact ? `<li>Liên hệ bảo trì: <strong>${data.maintenance_contact}</strong></li>` : '<li>Liên hệ kỹ thuật nếu cần hỗ trợ</li>'}
                        ${data.escalation_level > 1 ? '<li><strong>⚠️ Đây là cảnh báo leo thang - cần xử lý ngay lập tức</strong></li>' : ''}
                    </ul>
                    ${data.additional_notes ? `<p><strong>Ghi chú thêm:</strong> ${data.additional_notes}</p>` : ''}
                </div>
            </div>
            
            <div class="footer">
                <p>Email tự động từ Hệ thống giám sát IoT</p>
                <p>Thời gian: ${now} | Không trả lời email này</p>
                ${data.notification_id ? `<p>Notification ID: ${data.notification_id}</p>` : ''}
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

  // =================== NEW METHODS FOR ENHANCED EMAIL ===================

  /**
   * Generate email subject based on warning data
   */
  generateEmailSubject(data) {
    const severityIcon = this.getSeverityIcon(data.severity);
    const templateIcon = data.template_icon || severityIcon;
    const escalation = data.escalation_level > 1 ? ` [LEVEL ${data.escalation_level}]` : '';
    
    return `${templateIcon} ${data.subject_prefix || 'Cảnh báo thiết bị'}: ${data.device_name} - ${data.warning_type}${escalation}`;
  }

  /**
   * Generate digest email HTML
   */
  generateDigestEmailHTML(data) {
    const now = new Date().toLocaleString('vi-VN');
    const criticalWarnings = data.warnings.filter(w => w.severity === 'critical');
    const highWarnings = data.warnings.filter(w => w.severity === 'high');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Tổng hợp cảnh báo thiết bị IoT</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #d32f2f, #f57c00); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .summary-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; }
            .warning-item { background: #f9f9f9; border-left: 3px solid #ddd; margin: 10px 0; padding: 12px; border-radius: 4px; }
            .warning-critical { border-left-color: #d32f2f; background: #ffebee; }
            .warning-high { border-left-color: #f57c00; background: #fff3e0; }
            .warning-medium { border-left-color: #fbc02d; background: #fffde7; }
            .footer { background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 TỔNG HỢP CẢNH BÁO IoT</h1>
                <p>Hệ thống giám sát</p>
                <p><strong>${data.warning_count} cảnh báo</strong> trong khoảng thời gian qua</p>
            </div>
            
            <div class="content">
                <div class="summary-box">
                    <h3>📈 Tổng quan cảnh báo:</h3>
                    <ul>
                        <li><strong>Tổng số cảnh báo:</strong> ${data.warning_count}</li>
                        <li><strong>Nghiêm trọng:</strong> ${data.critical_count} cảnh báo</li>
                        <li><strong>Cao:</strong> ${data.high_count} cảnh báo</li>
                        <li><strong>Thời gian tổng hợp:</strong> ${now}</li>
                    </ul>
                </div>
                
                ${criticalWarnings.length > 0 ? `
                <h3>🔴 Cảnh báo nghiêm trọng (${criticalWarnings.length}):</h3>
                ${criticalWarnings.map(w => `
                    <div class="warning-item warning-critical">
                        <strong>${w.device_name}</strong> - ${w.warning_type}<br>
                        <small>Giá trị: ${w.current_value} | Ngưỡng: ${w.threshold_value} | ${new Date(w.created_at).toLocaleString('vi-VN')}</small>
                    </div>
                `).join('')}
                ` : ''}
                
                ${highWarnings.length > 0 ? `
                <h3>🟠 Cảnh báo mức cao (${highWarnings.length}):</h3>
                ${highWarnings.slice(0, 5).map(w => `
                    <div class="warning-item warning-high">
                        <strong>${w.device_name}</strong> - ${w.warning_type}<br>
                        <small>Giá trị: ${w.current_value} | Ngưỡng: ${w.threshold_value} | ${new Date(w.created_at).toLocaleString('vi-VN')}</small>
                    </div>
                `).join('')}
                ${highWarnings.length > 5 ? `<p><em>... và ${highWarnings.length - 5} cảnh báo khác</em></p>` : ''}
                ` : ''}
                
                <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 4px;">
                    <h3>📋 Hành động được khuyến nghị:</h3>
                    <ul>
                        <li>Ưu tiên xử lý các cảnh báo nghiêm trọng trước</li>
                        <li>Kiểm tra tình trạng các thiết bị có cảnh báo</li>
                        <li>Liên hệ nhóm bảo trì nếu cần thiết</li>
                        <li>Cập nhật trạng thái xử lý trong hệ thống</li>
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <p>Tổng hợp tự động từ Hệ thống giám sát IoT - BVĐKTP</p>
                <p>Thời gian: ${now} | Không trả lời email này</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate digest email text
   */
  generateDigestEmailText(data) {
    const now = new Date().toLocaleString('vi-VN');
    return `
📊 TỔNG HỢP CẢNH BÁO IoT - BVĐKTP

📈 Tổng quan:
- Tổng số cảnh báo: ${data.warning_count}
- Nghiêm trọng: ${data.critical_count}
- Cao: ${data.high_count}
- Thời gian: ${now}

🔴 Cảnh báo nghiêm trọng:
${data.warnings.filter(w => w.severity === 'critical').map(w => 
  `- ${w.device_name}: ${w.warning_type} (${w.current_value})`
).join('\n') || 'Không có'}

🟠 Cảnh báo mức cao:
${data.warnings.filter(w => w.severity === 'high').slice(0, 5).map(w => 
  `- ${w.device_name}: ${w.warning_type} (${w.current_value})`
).join('\n') || 'Không có'}

📋 Hành động khuyến nghị:
1. Ưu tiên xử lý cảnh báo nghiêm trọng
2. Kiểm tra tình trạng thiết bị
3. Liên hệ bảo trì nếu cần
4. Cập nhật trạng thái xử lý

---
Hệ thống giám sát IoT - BVĐKTP
Tổng hợp tự động - Không trả lời
    `;
  }

  /**
   * Generate resolution email HTML
   */
  generateResolutionEmailHTML(data) {
    const now = new Date().toLocaleString('vi-VN');
    const resolutionTime = new Date(data.resolution_time).toLocaleString('vi-VN');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Đã giải quyết cảnh báo thiết bị IoT</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: #4caf50; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .resolution-box { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; }
            .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .info-table th, .info-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .info-table th { background-color: #f8f9fa; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ ĐÃ GIẢI QUYẾT CẢNH BÁO</h1>
                <p>Hệ thống giám sát</p>
            </div>
            
            <div class="content">
                <div class="resolution-box">
                    <h2>✅ ${data.warning_type}</h2>
                    <p><strong>Thiết bị:</strong> ${data.device_name} (ID: ${data.device_id})</p>
                    <p><strong>Trạng thái:</strong> <span style="color: #4caf50; font-weight: bold;">Đã giải quyết</span></p>
                </div>
                
                <table class="info-table">
                    <tr><th>Thông tin</th><th>Chi tiết</th></tr>
                    <tr><td>Thời gian cảnh báo</td><td>${new Date(data.created_at).toLocaleString('vi-VN')}</td></tr>
                    <tr><td>Thời gian giải quyết</td><td>${resolutionTime}</td></tr>
                    <tr><td>Thời gian xử lý</td><td>${this.calculateDuration(data.created_at, data.resolution_time)}</td></tr>
                    <tr><td>Người xử lý</td><td>${data.resolved_by}</td></tr>
                    <tr><td>Ghi chú giải quyết</td><td>${data.resolution_notes}</td></tr>
                    <tr><td>Giá trị hiện tại</td><td>${data.current_value || 'N/A'}</td></tr>
                    <tr><td>Ngưỡng cảnh báo</td><td>${data.threshold_value || 'N/A'}</td></tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 4px;">
                    <h3>📋 Thông tin giải quyết:</h3>
                    <p>Cảnh báo <strong>${data.warning_type}</strong> cho thiết bị <strong>${data.device_name}</strong> đã được giải quyết thành công.</p>
                    <p>Giá trị hiện tại đã trở về mức bình thường và hệ thống đang hoạt động ổn định.</p>
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

  /**
   * Generate resolution email text
   */
  generateResolutionEmailText(data) {
    const now = new Date().toLocaleString('vi-VN');
    const resolutionTime = new Date(data.resolution_time).toLocaleString('vi-VN');
    
    return `
✅ ĐÃ GIẢI QUYẾT CẢNH BÁO - BVĐKTP

🔧 Cảnh báo: ${data.warning_type}
📱 Thiết bị: ${data.device_name} (ID: ${data.device_id})
✅ Trạng thái: Đã giải quyết

⏱️ Thời gian:
- Cảnh báo: ${new Date(data.created_at).toLocaleString('vi-VN')}
- Giải quyết: ${resolutionTime}
- Thời gian xử lý: ${this.calculateDuration(data.created_at, data.resolution_time)}

👤 Người xử lý: ${data.resolved_by}
📝 Ghi chú: ${data.resolution_notes}

📊 Giá trị:
- Hiện tại: ${data.current_value || 'N/A'}
- Ngưỡng: ${data.threshold_value || 'N/A'}

---
Hệ thống giám sát IoT - BVĐKTP
Email tự động - Không trả lời
    `;
  }

  /**
   * Get email priority based on severity
   */
  getEmailPriority(severity) {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'high';
      case 'high': 
      case 'major': return 'high';
      case 'medium':
      case 'moderate': return 'normal';
      default: return 'low';
    }
  }

  /**
   * Get priority number for headers
   */
  getPriorityNumber(severity) {
    switch(severity?.toLowerCase()) {
      case 'critical': return '1';
      case 'high':
      case 'major': return '2';
      case 'medium':
      case 'moderate': return '3';
      default: return '4';
    }
  }

  /**
   * Get MS Mail priority
   */
  getMSMailPriority(severity) {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'High';
      case 'high':
      case 'major': return 'High';
      default: return 'Normal';
    }
  }

  /**
   * Get priority text for display
   */
  getPriorityText(priority) {
    switch(priority?.toLowerCase()) {
      case 'urgent':
      case 'critical': return '🔴 KHẨN CẤP';
      case 'high': return '🟠 CAO';
      case 'normal':
      case 'medium': return '🟡 TRUNG BÌNH';
      case 'low': return '🟢 THẤP';
      default: return '⚪ KHÔNG XÁC ĐỊNH';
    }
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    switch(severity?.toLowerCase()) {
      case 'critical': return '🚨';
      case 'high':
      case 'major': return '⚠️';
      case 'medium':
      case 'moderate': return '⚠️';
      default: return 'ℹ️';
    }
  }

  /**
   * Calculate duration between two timestamps
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    } else {
      return `${minutes} phút`;
    }
  }

  /**
   * Send warning digest email
   */
  async sendWarningDigest(digestData) {
    return await this.sendWarningEmail({
      ...digestData,
      type: 'digest'
    });
  }

  /**
   * Send resolution email
   */
  async sendResolutionEmail(resolutionData) {
    return await this.sendWarningEmail({
      ...resolutionData,
      type: 'resolution'
    });
  }
}

export default new MailService();
