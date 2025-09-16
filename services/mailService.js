import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { 
  formatWarningDataForEmail, 
  formatWarningDataWithUserInfo,
  formatWarningsDigestForEmail 
} from '../utils/emailFormatter.js';

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
      
      // Auto-format warning data using emailFormatter utilities
      let formattedData;
      if (warningData.acknowledged_by && emailType === 'resolution') {
        formattedData = await formatWarningDataWithUserInfo(warningData, emailType);
      } else {
        formattedData = await formatWarningDataForEmail(warningData, emailType);
      }
      
      // Merge original data with formatted data (formatted data takes precedence for formatting)
      const enhancedData = {
        ...warningData,
        ...formattedData,
        // Ensure proper unit formatting
        formatted_measured_value: this.formatValueWithUnit(warningData.measured_value, warningData.warning_type, warningData.device_type),
        formatted_threshold_value: this.formatValueWithUnit(warningData.threshold_value, warningData.warning_type, warningData.device_type)
      };
      
      let htmlContent, textContent, subject;
      
      switch(emailType) {
        case 'digest':
          htmlContent = this.generateDigestEmailHTML(enhancedData);
          textContent = this.generateDigestEmailText(enhancedData);
          subject = `📊 Tổng hợp cảnh báo: ${enhancedData.warning_count} cảnh báo`;
          break;
        case 'resolution':
          htmlContent = this.generateResolutionEmailHTML(enhancedData);
          textContent = this.generateResolutionEmailText(enhancedData);
          subject = `✅ ĐÃ GIẢI QUYẾT: ${enhancedData.device_name} - ${enhancedData.warning_type}`;
          break;
        default:
          htmlContent = this.generateWarningEmailHTML(enhancedData);
          textContent = this.generateWarningEmailText(enhancedData);
          subject = this.generateEmailSubject(enhancedData);
      }

      const mailOptions = {
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: recipients.join(','),
        subject: subject,
        text: textContent,
        html: htmlContent,
        priority: this.getEmailPriority(enhancedData.priority || enhancedData.severity),
        headers: {
          'X-Priority': this.getPriorityNumber(enhancedData.priority || enhancedData.severity),
          'X-MSMail-Priority': this.getMSMailPriority(enhancedData.priority || enhancedData.severity),
          'Importance': enhancedData.priority || 'normal',
          'X-Warning-Type': enhancedData.warning_type,
          'X-Device-ID': enhancedData.device_id,
          'X-Notification-ID': enhancedData.notification_id || 'none'
        }
      };

      if (this.debugMode) {
        console.log('📧 Sending warning email:', {
          type: emailType,
          to: recipients,
          subject: mailOptions.subject,
          device: enhancedData.device_name,
          warning: enhancedData.warning_type,
          priority: enhancedData.priority || enhancedData.severity,
          measured_value: enhancedData.formatted_measured_value,
          threshold_value: enhancedData.formatted_threshold_value
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
    
    // Collect all ALERT_EMAIL_* environment variables
    for (let i = 1; i <= 20; i++) {
      const emailKey = `ALERT_EMAIL_${i}`;
      const email = process.env[emailKey];
      if (email && email.trim() && email.includes('@')) {
        recipients.push(email.trim());
      }
    }
    
    console.log(`📧 Found ${recipients.length} alert email recipients:`, recipients);
    
    // Fallback if no recipients found
    if (recipients.length === 0) {
      console.warn('⚠️ No valid alert email recipients found in environment variables');
      recipients.push(process.env.MAIL_FROM_ADDRESS || 'admin@example.com');
    }
    
    return recipients;
  }


  generateWarningEmailHTML(data) {
    const severity = this.getSeverityInfo(data.severity || data.warning_severity);
    const templateIcon = data.template_icon || severity.icon;
    const templateColor = data.template_color || severity.color;
    const now = new Date().toLocaleString('vi-VN');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>CẢNH BÁO THIẾT BỊ IoMT</title>
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
                <h1>${templateIcon} ${data.warning_message.toUpperCase()} CHO PHÉP</h1>
                <p>Hệ thống giám sát thiết bị y tế thông minh AIoMT </p>
                ${data.escalation_level > 1 ? `<span class="escalation-badge">LEVEL ${data.escalation_level} ESCALATION</span>` : ''}
            </div>
            
            <div class="content">
                <div class="warning-box">
                    <h2>Giá trị vượt ngưỡng</h2>
                    <h1>${data.formatted_measured_value || this.formatValueWithUnit(data.measured_value )} </h1>
                </div>
                
                <table class="info-table">
                    <tr><th>Thông số</th><th>Nội dung</th></tr>
                    ${data.device_name !== "Môi trường IoT" ? `<tr><td>Thiết bị</td><td>${data.device_name}</td></tr>` : ''}
                    <tr><td>Giá trị đo </td><td><strong>${data.formatted_measured_value || this.formatValueWithUnit(data.measured_value || data.current_value, data.warning_type) || 'N/A'}</strong></td></tr>
                    <tr><td>Ngưỡng cho phép </td><td><strong>${data.formatted_threshold_value || this.formatValueWithUnit(data.threshold_value, data.warning_type) || 'N/A'}</strong></td></tr>
                    <tr><td>Thời gian ghi nhận</td><td>${new Date(data.created_at).toLocaleString('vi-VN')}</td></tr>
                    <tr><td>Vị trí</td><td>Tầng 2 - HOPT</td></tr>
                    ${data.escalation_level > 1 ? `<tr><td>Mức leo thang</td><td>Level ${data.escalation_level}</td></tr>` : ''}
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 4px;">
                    <h3>📋 Khuyến nghị:</h3>
                    <ul>
                        <li>Kiểm tra tình trạng thiết bị/cảm biến ngay khi nhận cảnh báo.</li>
                        <li>Xác nhận giá trị đo và so sánh với ngưỡng cho phép.</li>
                        <li>Ghi nhận kết quả và hành động khắc phục vào hệ thống.</li>
                        <li>Liên hệ bộ phận kỹ thuật nếu sự cố vượt khả năng xử lý tại chỗ.</li>
                        ${data.escalation_level > 1 ? '<li><strong>⚠️ Đây là cảnh báo leo thang - cần xử lý ngay lập tức</strong></li>' : ''}
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <p>Đây là email cảnh báo tự động từ hệ thống HOPT AIoMT.</p>
                <p>Thời gian: ${now} | Vui lòng không trả lời email này.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generateWarningEmailText(data) {
    const severity = this.getSeverityInfo(data.severity || data.warning_severity);
    const formattedMeasured = data.formatted_measured_value || this.formatValueWithUnit(data.measured_value || data.current_value, data.warning_type) || 'N/A';
    const formattedThreshold = data.formatted_threshold_value || this.formatValueWithUnit(data.threshold_value, data.warning_type) || 'N/A';
    const valueComparison = data.value_comparison || this.getValueComparisonText(data.measured_value || data.current_value, data.threshold_value, data.warning_type, data.device_type);
    
    return `
🚨 CẢNH BÁO THIẾT BỊ IoMT

⚠️ Loại cảnh báo: ${data.warning_type}
${data.device_name !== "Môi trường IoT" ? `📱 Thiết bị: ${data.device_name} (ID: ${data.device_id})` : ''}
🔥 Mức độ: ${severity.text}
⏰ Thời gian: ${new Date(data.created_at).toLocaleString('vi-VN')}

📊 Chi tiết:
- Giá trị đo được: ${formattedMeasured}
- Ngưỡng cảnh báo: ${formattedThreshold}
${valueComparison ? `- So sánh: ${valueComparison}` : ''}
- Mô tả: ${data.warning_message || data.message || 'Không có mô tả'}
- Trạng thái: ${data.status === 'active' ? 'Đang hoạt động' : 'Đã giải quyết'}

🔧 Khuyến nghị:
1. Kiểm tra ngay thiết bị
2. Xác minh thông số kỹ thuật
3. Ghi lại hành động khắc phục
4. Liên hệ kỹ thuật nếu cần

---
Hệ thống giám sát IoMT
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
                <p>Hệ thống giám sát IoMT</p>
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
      case 'major':
      case 'high':
        return {
          text: 'CAO',
          color: '#f57c00',
          bgColor: '#fff3e0',
          icon: '🟠'
        };
      case 'moderate':
      case 'medium':
        return {
          text: 'TRUNG BÌNH',
          color: '#fbc02d',
          bgColor: '#fffde7',
          icon: '🟡'
        };
      case 'minor':
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

  // =================== HELPER METHODS FOR VALUE FORMATTING ===================

  /**
   * Format value with appropriate unit based on warning type
   */
  formatValueWithUnit(value, warningType, deviceType = null) {
    if (value === null || value === undefined) return 'N/A';
    
    const units = this.getUnitForWarningType(warningType, deviceType);
    const formattedValue = this.formatNumberWithPrecision(value, warningType);
    
    // Thêm khoảng cách giữa giá trị và đơn vị nếu có đơn vị
    return units ? `${formattedValue} ${units}` : formattedValue;
  }

  /**
   * Get appropriate unit for warning type
   */
  getUnitForWarningType(warningType, deviceType = null) {
    const unitMapping = {
      // Điện áp
      'voltage_high': 'V',
      'voltage_low': 'V', 
      'voltage_warning': 'V',
      
      // Dòng điện
      'current_high': 'A',
      'current_warning': 'A',
      'leak_current_shutdown': 'mA',
      'leak_current_strong': 'mA',
      'leak_current_soft': 'mA',
      
      // Công suất - phụ thuộc vào device_type
      'power_high': this.getPowerUnit(deviceType),
      'power_warning': this.getPowerUnit(deviceType),
      
      // Nhiệt độ
      'temperature_high': '°C',
      'temperature_warning': '°C',
      
      // Độ ẩm
      'humidity_high': '%',
      'humidity_warning': '%',
      
      // Default
      'default': ''
    };
    
    return unitMapping[warningType] || unitMapping['default'];
  }

  /**
   * Get power unit based on device type
   * Only auo_display uses W (Watt), others use VA (Volt-Ampere)
   */
  getPowerUnit(deviceType) {
    switch(deviceType) {
      case 'auo_display':
        return 'W';  // Watt cho màn hình AUO
      case 'camera_control_unit':
      case 'electronic_endoflator':
      case 'led_nova_100':
      case 'iot_environment_status':
      default:
        return 'VA'; // Volt-Ampere cho các thiết bị khác
    }
  }

  /**
   * Format number with appropriate precision based on warning type
   */
  formatNumberWithPrecision(value, warningType) {
    if (value === null || value === undefined) return 'N/A';
    
    const num = parseFloat(value);
    if (isNaN(num)) return value.toString();
    
    // Precision rules based on warning type
    const precisionMapping = {
      // Điện áp - 1 số thập phân
      'voltage_high': 1,
      'voltage_low': 1,
      'voltage_warning': 1,
      
      // Dòng điện - 2 số thập phân cho A, 1 cho mA
      'current_high': 2,
      'current_warning': 2,
      'leak_current_shutdown': 1,
      'leak_current_strong': 1,
      'leak_current_soft': 1,
      
      // Công suất - Không thập phân cho W
      'power_high': 0,
      'power_warning': 0,
      
      // Nhiệt độ - 1 số thập phân
      'temperature_high': 1,
      'temperature_warning': 1,
      
      // Độ ẩm - 1 số thập phân
      'humidity_high': 1,
      'humidity_warning': 1,
      
      // Default
      'default': 1
    };
    
    const precision = precisionMapping[warningType] !== undefined 
      ? precisionMapping[warningType] 
      : precisionMapping['default'];
    
    return num.toFixed(precision);
  }

  /**
   * Get comparison text between measured and threshold values
   */
  getValueComparisonText(measuredValue, thresholdValue, warningType, deviceType = null) {
    if (!measuredValue || !thresholdValue) return '';
    
    const measured = parseFloat(measuredValue);
    const threshold = parseFloat(thresholdValue);
    
    if (isNaN(measured) || isNaN(threshold)) return '';
    
    const difference = measured - threshold;
    const percentageDiff = ((difference / threshold) * 100);
    
    const units = this.getUnitForWarningType(warningType, deviceType);
    const formattedDiff = this.formatNumberWithPrecision(Math.abs(difference), warningType);
    const formattedPercent = Math.abs(percentageDiff).toFixed(1);
    
    if (difference > 0) {
      return `Vượt ngưỡng ${formattedDiff}${units ? ' ' + units : ''} (${formattedPercent}%)`;
    } else if (difference < 0) {
      return `Thấp hơn ngưỡng ${formattedDiff}${units ? ' ' + units : ''} (${formattedPercent}%)`;
    } else {
      return `Đúng ngưỡng`;
    }
  }

  // =================== NEW METHODS FOR ENHANCED EMAIL ===================

  /**
   * Generate email subject based on warning data
   */
  generateEmailSubject(data) {
    const severityIcon = this.getSeverityIcon(data.severity);
    const templateIcon = data.template_icon || severityIcon;
    const escalation = data.escalation_level > 1 ? ` [LEVEL ${data.escalation_level}]` : '';

    return `${templateIcon} Cảnh báo ${data.warning_message.toLowerCase()} tại Tầng 2 HOPT`;
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
        <title>Tổng hợp ${data.warning_message.toUpperCase()} CHO PHÉP</title>
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
                        <small>Giá trị: ${this.formatValueWithUnit(w.current_value, w.warning_type)} | Ngưỡng: ${this.formatValueWithUnit(w.threshold_value, w.warning_type)} | ${new Date(w.created_at).toLocaleString('vi-VN')}</small>
                    </div>
                `).join('')}
                ` : ''}
                
                ${highWarnings.length > 0 ? `
                <h3>🟠 Cảnh báo mức cao (${highWarnings.length}):</h3>
                ${highWarnings.slice(0, 5).map(w => `
                    <div class="warning-item warning-high">
                        <strong>${w.device_name}</strong> - ${w.warning_type}<br>
                        <small>Giá trị: ${this.formatValueWithUnit(w.current_value, w.warning_type)} | Ngưỡng: ${this.formatValueWithUnit(w.threshold_value, w.warning_type)} | ${new Date(w.created_at).toLocaleString('vi-VN')}</small>
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
                <p>Tổng hợp tự động từ Hệ thống giám sát IoMT</p>
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
📊 TỔNG HỢP CẢNH BÁO IoMT

📈 Tổng quan:
- Tổng số cảnh báo: ${data.warning_count}
- Nghiêm trọng: ${data.critical_count}
- Cao: ${data.high_count}
- Thời gian: ${now}

🔴 Cảnh báo nghiêm trọng:
${data.warnings.filter(w => w.severity === 'critical').map(w => 
  `- ${w.device_name}: ${w.warning_type} (${this.formatValueWithUnit(w.current_value, w.warning_type)})`
).join('\n') || 'Không có'}

🟠 Cảnh báo mức cao:
${data.warnings.filter(w => w.severity === 'high').slice(0, 5).map(w => 
  `- ${w.device_name}: ${w.warning_type} (${this.formatValueWithUnit(w.current_value, w.warning_type)})`
).join('\n') || 'Không có'}

📋 Hành động khuyến nghị:
1. Ưu tiên xử lý cảnh báo nghiêm trọng
2. Kiểm tra tình trạng thiết bị
3. Liên hệ bảo trì nếu cần
4. Cập nhật trạng thái xử lý

---
Hệ thống giám sát IoMT
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
        <title>Đã giải quyết CẢNH BÁO THIẾT BỊ IoMT</title>
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
                    ${data.device_name !== "Môi trường IoT" ? `<p><strong>Thiết bị:</strong> ${data.device_name} (ID: ${data.device_id})</p>` : ''}
                    <p><strong>Trạng thái:</strong> <span style="color: #4caf50; font-weight: bold;">Đã giải quyết</span></p>
                </div>
                
                <table class="info-table">
                    <tr><th>Thông tin</th><th>Chi tiết</th></tr>
                    <tr><td>Thời gian cảnh báo</td><td>${new Date(data.created_at).toLocaleString('vi-VN')}</td></tr>
                    <tr><td>Thời gian giải quyết</td><td>${resolutionTime}</td></tr>
                    <tr><td>Thời gian xử lý</td><td>${this.calculateDuration(data.created_at, data.resolution_time)}</td></tr>
                    <tr><td>Người xử lý</td><td>${data.resolved_by}</td></tr>
                    <tr><td>Ghi chú giải quyết</td><td>${data.resolution_notes}</td></tr>
                    <tr><td>Giá trị đo được</td><td>${data.formatted_measured_value || this.formatValueWithUnit(data.current_value || data.measured_value, data.warning_type) || 'N/A'}</td></tr>
                    <tr><td>Ngưỡng cảnh báo</td><td>${data.formatted_threshold_value || this.formatValueWithUnit(data.threshold_value, data.warning_type) || 'N/A'}</td></tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 4px;">
                    <h3>📋 Thông tin giải quyết:</h3>
                    <p>Cảnh báo <strong>${data.warning_type}</strong>${data.device_name !== "Môi trường IoT" ? ` cho thiết bị <strong>${data.device_name}</strong>` : ''} đã được giải quyết thành công.</p>
                    <p>Giá trị hiện tại đã trở về mức bình thường và hệ thống đang hoạt động ổn định.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Đây là email cảnh báo tự động từ hệ thống HOPT AIoMT.</p>
                <p>Thời gian: ${now} | Vui lòng không trả lời email này.</p>
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
    const formattedMeasured = data.formatted_measured_value || this.formatValueWithUnit(data.current_value || data.measured_value, data.warning_type) || 'N/A';
    const formattedThreshold = data.formatted_threshold_value || this.formatValueWithUnit(data.threshold_value, data.warning_type) || 'N/A';
    
    return `
✅ ĐÃ GIẢI QUYẾT CẢNH BÁO

🔧 Cảnh báo: ${data.warning_type}
${data.device_name !== "Môi trường IoT" ? `📱 Thiết bị: ${data.device_name} (ID: ${data.device_id})` : ''}
✅ Trạng thái: Đã giải quyết

⏱️ Thời gian:
- Cảnh báo: ${new Date(data.created_at).toLocaleString('vi-VN')}
- Giải quyết: ${resolutionTime}
- Thời gian xử lý: ${this.calculateDuration(data.created_at, data.resolution_time)}

👤 Người xử lý: ${data.resolved_by}
📝 Ghi chú: ${data.resolution_notes}

📊 Giá trị:
- Đo được: ${formattedMeasured}
- Ngưỡng: ${formattedThreshold}

---
Hệ thống giám sát IoMT
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
      case 'high': 
      case 'major': return '🟠 CAO';
      case 'normal':
      case 'medium':
      case 'moderate': return '🟡 TRUNG BÌNH';
      case 'low':
      case 'minor': return '🟢 THẤP';
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
   * Send warning digest email with proper unit formatting
   */
  async sendWarningDigest(digestData) {
    // Format warnings list with units
    if (digestData.warnings && digestData.warnings.length > 0) {
      const formattedDigestData = formatWarningsDigestForEmail(digestData.warnings);
      return await this.sendWarningEmail({
        ...digestData,
        ...formattedDigestData,
        type: 'digest'
      });
    }
    
    return await this.sendWarningEmail({
      ...digestData,
      type: 'digest'
    });
  }

  /**
   * Send resolution email with proper unit formatting
   */
  async sendResolutionEmail(resolutionData) {
    return await this.sendWarningEmail({
      ...resolutionData,
      type: 'resolution'
    });
  }
}

export default new MailService();
