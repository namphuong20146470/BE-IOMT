/**
 * Helper function để format dữ liệu cảnh báo từ database thành format phù hợp cho mailService
 * 
 * @param {Object} warningData - Dữ liệu cảnh báo từ database
 * @param {string} emailType - Loại email: 'warning', 'resolution', 'digest'
 * @param {Object} userInfo - Thông tin user (optional, để tránh query thêm)
 * @returns {Object} - Dữ liệu đã format cho mailService
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function formatWarningDataForEmail(warningData, emailType = 'warning', userInfo = null) {
    // Mapping severity từ database sang format chuẩn
    const severityMapping = {
        'critical': 'critical',
        'major': 'high',
        'moderate': 'medium', 
        'minor': 'low'
    };

    // Mapping warning_type sang mô tả dễ hiểu
    const warningTypeDescriptions = {
        'voltage_high': 'Điện áp quá cao',
        'voltage_low': 'Điện áp thấp',
        'voltage_warning': 'Cảnh báo điện áp',
        'current_high': 'Dòng điện quá cao',
        'current_warning': 'Cảnh báo dòng điện',
        'power_high': 'Công suất quá cao',
        'power_warning': 'Cảnh báo công suất',
        'temperature_high': 'Nhiệt độ quá cao',
        'temperature_warning': 'Cảnh báo nhiệt độ',
        'humidity_high': 'Độ ẩm quá cao',
        'humidity_warning': 'Cảnh báo độ ẩm',
        'leak_current_shutdown': 'Dòng rò nguy hiểm',
        'leak_current_strong': 'Dòng rò mạnh',
        'leak_current_soft': 'Dòng rò nhẹ'
    };

    // Format cơ bản cho tất cả loại email
    const baseFormat = {
        // Thông tin thiết bị
        device_name: warningData.device_name || 'Thiết bị không xác định',
        device_id: warningData.device_id || 'N/A',
        device_type: warningData.device_type || 'unknown',
        
        // Thông tin cảnh báo  
        warning_type: warningData.warning_type,
        warning_message: warningData.warning_message || 'Không có mô tả',
        severity: severityMapping[warningData.warning_severity] || warningData.warning_severity || 'medium',
        warning_severity: warningData.warning_severity || 'medium',
        message: warningData.warning_message || 'Không có mô tả',
        
        // Giá trị và ngưỡng - Đảm bảo có cả raw values và formatted values
        measured_value: warningData.measured_value,
        threshold_value: warningData.threshold_value,
        current_value: formatMeasuredValue(warningData.measured_value, warningData.warning_type),
        formatted_threshold: formatThresholdValue(warningData.threshold_value, warningData.warning_type),
        raw_current_value: warningData.measured_value,
        raw_threshold_value: warningData.threshold_value,
        value_comparison: getValueComparisonText(warningData.measured_value, warningData.threshold_value, warningData.warning_type),
        
        // Thời gian - FIX: sử dụng timestamp thay vì created_at
        created_at: warningData.timestamp || warningData.created_at || new Date().toISOString(),
        
        // Trạng thái
        status: warningData.status || 'active',
        
        // Mô tả dễ hiểu
        template_description: warningTypeDescriptions[warningData.warning_type] || warningData.warning_message || warningData.warning_type,
        
        // Metadata - FIX: đảm bảo có ID
        notification_id: warningData.id ? `WRN-${warningData.id}` : `WRN-${Date.now()}`,
        priority: severityMapping[warningData.warning_severity] || 'medium'
    };

    // Format đặc biệt cho email resolution
    if (emailType === 'resolution' && warningData.resolved_at) {
        // Lấy thông tin người xử lý nếu chưa có
        let resolvedByName = 'Hệ thống tự động';
        if (warningData.acknowledged_by) {
            if (userInfo) {
                resolvedByName = userInfo.full_name || userInfo.username || `Người dùng #${warningData.acknowledged_by}`;
            } else {
                resolvedByName = await getResolvedByName(warningData.acknowledged_by);
            }
        }

        return {
            ...baseFormat,
            type: 'resolution',
            resolution_time: warningData.resolved_at,
            resolved_by: resolvedByName,
            resolution_notes: warningData.resolution_notes || 'Đã giải quyết thành công',
            subject_prefix: '✅ ĐÃ GIẢI QUYẾT',
            template_icon: '✅'
        };
    }

    // Format cho email warning thông thường
    if (emailType === 'warning') {
        const severityConfig = getSeverityConfig(warningData.warning_severity);
        
        return {
            ...baseFormat,
            type: 'warning',
            template_icon: severityConfig.icon,
            template_color: severityConfig.color,
            subject_prefix: severityConfig.subject_prefix,
            
            // Thông tin bổ sung
            device_location: getDeviceLocation(warningData.device_type, warningData.device_name),
            maintenance_contact: 'Phòng Kỹ thuật - Ext: 1234',
            
            // Ghi chú thêm dựa trên loại cảnh báo
            additional_notes: getAdditionalNotes(warningData.warning_type, warningData.warning_severity),
            
            // Escalation level (nếu có)
            escalation_level: 1 // Có thể tính toán dựa trên số lần cảnh báo
        };
    }

    // Format cho digest email
    if (emailType === 'digest') {
        return {
            type: 'digest',
            warning_count: 1, // Sẽ được override khi gọi
            critical_count: warningData.warning_severity === 'critical' ? 1 : 0,
            high_count: warningData.warning_severity === 'major' ? 1 : 0,
            warnings: [baseFormat],
            subject_prefix: '📊 Tổng hợp cảnh báo'
        };
    }

    return baseFormat;
}

/**
 * Format multiple warnings for digest email
 */
export function formatWarningsDigestForEmail(warningsList) {
    const severityMapping = {
        'critical': 'critical',
        'major': 'high',
        'moderate': 'medium', 
        'minor': 'low'
    };

    const formattedWarnings = warningsList.map(warning => ({
        device_name: warning.device_name,
        device_id: warning.device_id,
        warning_type: warning.warning_type,
        severity: severityMapping[warning.warning_severity] || warning.warning_severity,
        current_value: warning.measured_value,
        threshold_value: warning.threshold_value,
        created_at: warning.timestamp,
        message: warning.warning_message
    }));

    return {
        type: 'digest',
        warning_count: warningsList.length,
        critical_count: warningsList.filter(w => w.warning_severity === 'critical').length,
        high_count: warningsList.filter(w => w.warning_severity === 'major').length,
        warnings: formattedWarnings,
        subject_prefix: '📊 Tổng hợp cảnh báo',
        template_icon: '📊'
    };
}

/**
 * Format measured value based on warning type
 */
function formatMeasuredValue(value, warningType) {
    if (value === null || value === undefined) return 'N/A';
    
    const units = getUnitForWarningType(warningType);
    const formattedValue = formatNumberWithPrecision(value, warningType);
    
    return `${formattedValue}${units}`;
}

/**
 * Format threshold value based on warning type
 */
function formatThresholdValue(value, warningType) {
    if (value === null || value === undefined) return 'N/A';
    
    const units = getUnitForWarningType(warningType);
    const formattedValue = formatNumberWithPrecision(value, warningType);
    
    return `${formattedValue}${units}`;
}

/**
 * Get appropriate unit for warning type
 */
function getUnitForWarningType(warningType) {
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
        
        // Công suất
        'power_high': 'W',
        'power_warning': 'W',
        
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
 * Format number with appropriate precision based on warning type
 */
function formatNumberWithPrecision(value, warningType) {
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
function getValueComparisonText(measuredValue, thresholdValue, warningType) {
    if (!measuredValue || !thresholdValue) return '';
    
    const measured = parseFloat(measuredValue);
    const threshold = parseFloat(thresholdValue);
    
    if (isNaN(measured) || isNaN(threshold)) return '';
    
    const difference = measured - threshold;
    const percentageDiff = ((difference / threshold) * 100);
    
    const units = getUnitForWarningType(warningType);
    const formattedDiff = formatNumberWithPrecision(Math.abs(difference), warningType);
    const formattedPercent = Math.abs(percentageDiff).toFixed(1);
    
    if (difference > 0) {
        return `Vượt ngưỡng ${formattedDiff}${units} (${formattedPercent}%)`;
    } else if (difference < 0) {
        return `Thấp hơn ngưỡng ${formattedDiff}${units} (${formattedPercent}%)`;
    } else {
        return `Đúng ngưỡng`;
    }
}

/**
 * Get severity configuration
 */
function getSeverityConfig(warning_severity) {
    switch (warning_severity?.toLowerCase()) {
        case 'critical':
            return {
                icon: '🚨',
                color: '#d32f2f',
                subject_prefix: '🚨 KHẨN CẤP'
            };
        case 'major':
            return {
                icon: '⚠️',
                color: '#f57c00',
                subject_prefix: '⚠️ Cảnh báo nghiêm trọng'
            };
        case 'moderate':
            return {
                icon: '⚠️',
                color: '#fbc02d',
                subject_prefix: '⚠️ Cảnh báo thiết bị'
            };
        case 'minor':
            return {
                icon: 'ℹ️',
                color: '#388e3c',
                subject_prefix: 'ℹ️ Thông báo thiết bị'
            };
        default:
            return {  
                icon: '⚪',
                color: '#757575',
                subject_prefix: '⚠️ Cảnh báo thiết bị'
            };
    }
}

/**
 * Get device location based on type and name
 */
function getDeviceLocation(deviceType, deviceName) {
    const locationMapping = {
        'auo_display': 'Phòng khám A1-A5',
        'camera_control_unit': 'Phòng nội soi',
        'electronic_endoflator': 'Phòng phẫu thuật nội soi',
        'led_nova_100': 'Phòng phẫu thuật nội soi',
        'iot_environment_status': 'Khu vực giám sát môi trường'
    };
    
    return locationMapping[deviceType] || `${deviceName} - Vị trí không xác định`;
}

/**
 * Get additional notes based on warning type and severity
 */
function getAdditionalNotes(warningType, severity) {
    const notes = {
        'voltage_high': 'Kiểm tra nguồn điện và hệ thống ổn áp. Có thể gây hỏng thiết bị.',
        'voltage_low': 'Kiểm tra nguồn điện, có thể thiết bị không hoạt động ổn định.',
        'current_high': 'Kiểm tra tải thiết bị, có thể quá tải hoặc sự cố nội bộ.',
        'power_high': 'Thiết bị tiêu thụ điện năng cao bất thường, cần kiểm tra ngay.',
        'temperature_high': 'Nhiệt độ cao có thể làm hỏng linh kiện, kiểm tra hệ thống làm mát.',
        'humidity_high': 'Độ ẩm cao có thể gây chập mạch, kiểm tra hệ thống thông gió.',
        'leak_current_shutdown': 'RẤT NGUY HIỂM! Ngắt điện thiết bị ngay lập tức.',
        'leak_current_strong': 'Dòng rò mạnh, cần kiểm tra cách điện thiết bị.',
        'leak_current_soft': 'Dòng rò nhẹ, theo dõi và lên lịch bảo trì.'
    };
    
    let note = notes[warningType] || 'Kiểm tra thiết bị và thực hiện biện pháp khắc phục phù hợp.';
    
    if (severity === 'critical') {
        note += ' **ƯU TIÊN KHẨN CẤP - XỬ LÝ NGAY!**';
    }
    
    return note;
}

/**
 * Get user information for email
 */
export async function getUserInfoForEmail(userId) {
    try {
        if (!userId) return null;
        
        const user = await prisma.users.findUnique({
            where: { id: parseInt(userId) },
            select: {
                id: true,
                username: true,
                full_name: true,
                roles: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        id_role: true
                    }
                }
            }
        });
        
        if (!user) return null;
        
        return {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            display_name: user.full_name || user.username,
            role_name: user.roles?.name || 'N/A',
            role_description: user.roles?.description || '',
            role_id: user.roles?.id_role || '',
            formatted_name: `${user.full_name || user.username} (${user.roles?.name || 'N/A'})`
        };
        
    } catch (error) {
        console.error('Error getting user info:', error);
        return null;
    }
}

/**
 * Format warning data for email with enhanced user info
 */
export async function formatWarningDataWithUserInfo(warningData, emailType = 'warning') {
    let userInfo = null;
    
    // Lấy thông tin user nếu có acknowledged_by
    if (warningData.acknowledged_by) {
        userInfo = await getUserInfoForEmail(warningData.acknowledged_by);
    }
    
    return await formatWarningDataForEmail(warningData, emailType, userInfo);
}
async function getResolvedByName(userId) {
    try {
        if (!userId) return 'Hệ thống tự động';
        
        const user = await prisma.users.findUnique({
            where: { id: parseInt(userId) },
            select: {
                id: true,
                username: true,
                full_name: true,
                roles: {
                    select: {
                        name: true,
                        description: true
                    }
                }
            }
        });
        
        if (!user) {
            return `Người dùng #${userId} (không tìm thấy)`;
        }
        
        // Ưu tiên full_name, fallback về username
        const displayName = user.full_name || user.username;
        const roleName = user.roles?.name || 'N/A';
        
        return `${displayName} (${roleName})`;
        
    } catch (error) {
        console.error('Error getting user info for email:', error);
        return `Người dùng #${userId}`;
    }
}

/**
 * Example usage:
 * 
 * const warningFromDB = {
 *   "id": 8220,
 *   "device_type": "camera_control_unit", 
 *   "device_name": "Module xử lý hình ảnh",
 *   "device_id": null,
 *   "warning_type": "power_warning",
 *   "warning_severity": "moderate",
 *   "measured_value": 100,
 *   "threshold_value": 96,
 *   "warning_message": "Công suất vượt ngưỡng",
 *   "status": "resolved",
 *   "resolved_at": "2025-09-11T15:48:32.523Z",
 *   "acknowledged_by": 56,
 *   "resolution_notes": "Đã xử lý xong từ giao diện người dùng",
 *   "timestamp": "2025-09-11T15:46:13.083Z"
 * };
 * 
 * // Để gửi email warning
 * const emailData = formatWarningDataForEmail(warningFromDB, 'warning');
 * await mailService.sendWarningEmail(emailData);
 * 
 * // Để gửi email resolution
 * const resolutionEmailData = formatWarningDataForEmail(warningFromDB, 'resolution');
 * await mailService.sendResolutionEmail(resolutionEmailData);
 */
