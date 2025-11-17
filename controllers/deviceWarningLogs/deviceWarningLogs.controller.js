import { PrismaClient } from '@prisma/client';
import mailService from '../../services/mailService.js';
import { simpleEmailNotificationManager } from './simpleEmailNotificationManager.js';

const prisma = new PrismaClient();

// Define warning thresholds for each device type
const WARNING_THRESHOLDS = {
    socket1_data: {
        voltage_min: 200,
        voltage_max: 240,
        current_max: 0.63,
        power_max: 150,
        device_name: "Màn hình y tế AUO"
    },
    socket2_data: {
        voltage_min: 200,
        voltage_max: 240,
        current_max: 0.41,
        power_max: 96,
        device_name: "Bộ xử lý hình ảnh"
    },
    socket4_data: {
        voltage_min: 200,
        voltage_max: 240,
        current_max: 1.05,
        power_max: 250,
        device_name: "Máy Bơm CO2"
    },
    socket3_data: {
        voltage_min: 200,
        voltage_max: 240,
        current_max: 1.9,
        power_max: 450,
        device_name: "Đèn LED Nova 300"
    },
    iot_environment_status: {
        temperature_max: 40,
        humidity_max: 80,
        leak_current_soft: 3,
        leak_current_strong: 5,
        leak_current_shutdown: 10,
        device_name: "Môi trường IoT"
    }
};

// Get all warning logs
export const getAllWarningLogs = async (req, res) => {
    try {
        const { device_type, warning_type, status } = req.query;

        let whereClause = '';
        let params = [];

        if (device_type) {
            whereClause += ' WHERE device_type = $1';
            params.push(device_type);
        }

        if (warning_type) {
            whereClause += whereClause ? ' AND warning_type = $' + (params.length + 1) : ' WHERE warning_type = $1';
            params.push(warning_type);
        }

        if (status) {
            whereClause += whereClause ? ' AND status = $' + (params.length + 1) : ' WHERE status = $1';
            params.push(status);
        }

        const warningLogs = await prisma.$queryRawUnsafe(`
            SELECT 
                id,
                device_type,
                device_name,
                device_id,
                warning_type,
                warning_severity,
                measured_value,
                threshold_value,
                warning_message,
                status,
                resolved_at,
                acknowledged_by,
                resolution_notes,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM device_warning_logs 
            ${whereClause}
            ORDER BY timestamp DESC
        `, ...params);

        return res.status(200).json({
            success: true,
            data: warningLogs,
            count: warningLogs.length,
            message: 'Successfully retrieved all warning logs'
        });
    } catch (error) {
        console.error('Error fetching warning logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve warning logs',
            error: error.message
        });
    }
};

// Get latest warning logs
export const getLatestWarningLogs = async (req, res) => {
    try {
        const latestLogs = await prisma.$queryRaw`
            SELECT 
                id,
                device_type,
                device_name,
                device_id,
                warning_type,
                warning_severity,
                measured_value,
                threshold_value,
                warning_message,
                status,
                resolved_at,
                acknowledged_by,
                resolution_notes,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM device_warning_logs 
            ORDER BY timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: latestLogs,
            count: latestLogs.length,
            message: 'Successfully retrieved all warning logs ordered by latest'
        });
    } catch (error) {
        console.error('Error fetching latest warning logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest warning logs',
            error: error.message
        });
    }
};

// Get active warnings
export const getActiveWarnings = async (req, res) => {
    try {
        const activeWarnings = await prisma.$queryRaw`
            SELECT 
                id,
                device_type,
                device_name,
                device_id,
                warning_type,
                warning_severity,
                measured_value,
                threshold_value,
                warning_message,
                status,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM device_warning_logs 
            WHERE status = 'active'
            ORDER BY warning_severity DESC, timestamp DESC
        `;

        return res.status(200).json({
            success: true,
            data: activeWarnings,
            message: 'Successfully retrieved active warnings'
        });
    } catch (error) {
        console.error('Error fetching active warnings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve active warnings',
            error: error.message
        });
    }
};

// Acknowledge warning
export const acknowledgeWarning = async (req, res) => {
    try {
        const { id } = req.params;
        const { acknowledged_by, resolution_notes } = req.body;

        // Tạm thời bỏ qua validation và set acknowledged_by = NULL
        // TODO: Cập nhật lại khi migration hoàn tất

        const result = await prisma.$queryRaw`
            UPDATE device_warning_logs 
            SET 
                status = 'acknowledged',
                acknowledged_by = NULL,
                resolution_notes = ${resolution_notes || null}
            WHERE id = ${parseInt(id)}
            RETURNING id, status, acknowledged_by
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Warning log not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: result[0],
            message: 'Warning acknowledged successfully',
            note: 'acknowledged_by được set NULL tạm thời do migration'
        });
    } catch (error) {
        console.error('Error acknowledging warning:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to acknowledge warning',
            error: error.message
        });
    }
};

// Resolve warning
export const resolveWarning = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_notes } = req.body;

        const result = await prisma.$queryRaw`
            UPDATE device_warning_logs 
            SET 
                status = 'resolved',
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = ${resolution_notes || null}
            WHERE id = ${parseInt(id)}
            RETURNING id, status, resolved_at
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Warning log not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: result[0],
            message: 'Warning resolved successfully'
        });
    } catch (error) {
        console.error('Error resolving warning:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resolve warning',
            error: error.message
        });
    }
};

// Check device data and create warnings if thresholds are exceeded
export const checkDeviceWarnings = async (deviceType, deviceData, deviceIdentifier = null) => {
    try {
        const thresholds = WARNING_THRESHOLDS[deviceType];
        if (!thresholds) {
            console.log(`No thresholds defined for device type: ${deviceType}`);
            return;
        }

        const warnings = [];

        // Check voltage warnings
        if (deviceData.voltage !== null && deviceData.voltage !== undefined) {
            if (deviceData.voltage > thresholds.voltage_max * 1.2) {
                warnings.push({
                    warning_type: 'voltage_high',
                    warning_severity: 'major',
                    measured_value: deviceData.voltage,
                    threshold_value: thresholds.voltage_max * 1.2,
                    warning_message: `Điện áp vượt ngưỡng`
                });
            } else if (deviceData.voltage > thresholds.voltage_max) {
                warnings.push({
                    warning_type: 'voltage_warning',
                    warning_severity: 'moderate',
                    measured_value: deviceData.voltage,
                    threshold_value: thresholds.voltage_max,
                    warning_message: `Điện áp vượt ngưỡng`
                });
            } else if (deviceData.voltage < thresholds.voltage_min * 0.8 && deviceData.statusOperating === true) {
                warnings.push({
                    warning_type: 'voltage_low',
                    warning_severity: 'major',
                    measured_value: deviceData.voltage,
                    threshold_value: thresholds.voltage_min * 0.8,
                    warning_message: `Điện áp dưới ngưỡng`
                });
            } else if (deviceData.voltage < thresholds.voltage_min && deviceData.statusOperating === true) {
                warnings.push({
                    warning_type: 'voltage_warning',
                    warning_severity: 'moderate',
                    measured_value: deviceData.voltage,
                    threshold_value: thresholds.voltage_min,
                    warning_message: `Điện áp dưới ngưỡng`
                });
            }
        }

        // Check current warnings
        if (deviceData.current !== null && deviceData.current !== undefined) {
            // if (deviceData.current > thresholds.current_max * 1.2) {
            //     warnings.push({
            //         warning_type: 'current_high',
            //         warning_severity: 'major',
            //         measured_value: deviceData.current,
            //         threshold_value: thresholds.current_max * 1.2,
            //         warning_message: `Dòng điện vượt ngưỡng`
            //     });
            if (deviceData.current > thresholds.current_max) {
                warnings.push({
                    warning_type: 'current_warning',
                    warning_severity: 'moderate',
                    measured_value: deviceData.current,
                    threshold_value: thresholds.current_max,
                    warning_message: `Dòng điện vượt ngưỡng`
                });
            }
        }

        // Check power warnings
        if (deviceData.power_operating !== null && deviceData.power_operating !== undefined) {
            // if (deviceData.power_operating > thresholds.power_max * 1.2) {
            //     warnings.push({
            //         warning_type: 'power_high',
            //         warning_severity: 'major',
            //         measured_value: deviceData.power_operating,
            //         threshold_value: thresholds.power_max * 1.2,
            //         warning_message: `Công suất vượt ngưỡng`
            //     });
           if (deviceData.power_operating > thresholds.power_max) {
                warnings.push({
                    warning_type: 'power_warning',
                    warning_severity: 'moderate',
                    measured_value: deviceData.power_operating,
                    threshold_value: thresholds.power_max,
                    warning_message: `Công suất vượt ngưỡng`
                });
            }
        }

        // Check environment-specific warnings
        if (deviceType === 'iot_environment_status') {
            // Temperature warning
            if (deviceData.temperature_c !== null && deviceData.temperature_c !== undefined) {
                // if (deviceData.temperature_c > thresholds.temperature_max * 1.2) {
                //     warnings.push({
                //         warning_type: 'temperature_high',
                //         warning_severity: 'critical',
                //         measured_value: deviceData.temperature_c,
                //         threshold_value: thresholds.temperature_max * 1.2,
                //         warning_message: `Nhiệt độ quá ngưỡng`
                //     });
    if (deviceData.temperature_c > thresholds.temperature_max) {
                    warnings.push({
                        warning_type: 'temperature_warning',
                        warning_severity: 'moderate',
                        measured_value: deviceData.temperature_c,
                        threshold_value: thresholds.temperature_max,
                        warning_message: `Nhiệt độ vượt ngưỡng`
                    });
                }
            }

            // Humidity warning
            if (deviceData.humidity_percent !== null && deviceData.humidity_percent !== undefined) {
                if (deviceData.humidity_percent > thresholds.humidity_max * 1.2) {
                    warnings.push({
                        warning_type: 'humidity_high',
                        warning_severity: 'major',
                        measured_value: deviceData.humidity_percent,
                        threshold_value: thresholds.humidity_max * 1.2,
                        warning_message: `Độ ẩm quá ngưỡng`
                    });
                } else if (deviceData.humidity_percent > thresholds.humidity_max) {
                    warnings.push({
                        warning_type: 'humidity_warning',
                        warning_severity: 'moderate',
                        measured_value: deviceData.humidity_percent,
                        threshold_value: thresholds.humidity_max,
                        warning_message: `Độ ẩm vượt ngưỡng`
                    });
                }
            }

            // Leak current warnings
            if (deviceData.leak_current_ma !== null && deviceData.leak_current_ma !== undefined) {
                if (deviceData.leak_current_ma >= thresholds.leak_current_shutdown) {
                    warnings.push({
                        warning_type: 'leak_current_shutdown',
                        warning_severity: 'critical',
                        measured_value: deviceData.leak_current_ma,
                        threshold_value: thresholds.leak_current_shutdown,
                        warning_message: `Dòng rò vượt ngưỡng ngắt thiết bị`
                    });
                } else if (deviceData.leak_current_ma >= thresholds.leak_current_strong) {
                    warnings.push({
                        warning_type: 'leak_current_strong',
                        warning_severity: 'major',
                        measured_value: deviceData.leak_current_ma,
                        threshold_value: thresholds.leak_current_strong,
                        warning_message: `Dòng rò vượt ngưỡng mạnh`
                    });
                } else if (deviceData.leak_current_ma >= thresholds.leak_current_soft) {
                    warnings.push({
                        warning_type: 'leak_current_soft',
                        warning_severity: 'minor',
                        measured_value: deviceData.leak_current_ma,
                        threshold_value: thresholds.leak_current_soft,
                        warning_message: `Dòng rò vượt ngưỡng nhẹ`
                    });
                } 
                // else if (deviceData.statusOperating === true) {
                //     warnings.push({
                //         warning_type: 'status_operating',
                //         warning_severity: 'info',
                //         measured_value: null,
                //         threshold_value: null,
                //         warning_message: `Thiết bị đang hoạt động bình thường`
                //     });
                // }
            }
        }

        // Chống spam: chỉ insert nếu chưa có cảnh báo active cùng loại trong 5 phút
        const WARNING_COOLDOWN_SECONDS = 300; // 5 phút
        for (const warning of warnings) { 
            // Kiểm tra cảnh báo active cùng loại, cùng thiết bị (dựa trên device_type và device_name)
            const existing = await prisma.device_warning_logs.findFirst({
                where: {
                    device_type: deviceType,
                    device_name: thresholds.device_name,
                    warning_type: warning.warning_type,
                    status: 'active' 
                },
                orderBy: { timestamp: 'desc' }
            });

            if (existing) {
                const lastTimestamp = new Date(existing.timestamp).getTime();
                const now = Date.now();
                if ((now - lastTimestamp) / 1000 < WARNING_COOLDOWN_SECONDS) {
                    // Bỏ qua, không insert mới
                    console.log(`⏳ Cooldown active for ${warning.warning_type} - skipping`);
                    continue;
                }
            }

            // Nếu chưa có hoặc đã qua cooldown, insert cảnh báo mới
            await prisma.$queryRaw`
                INSERT INTO device_warning_logs (
                    device_type,
                    device_name,
                    device_id,
                    warning_type,
                    warning_severity,
                    measured_value,
                    threshold_value,
                    warning_message,
                    status,
                    timestamp
                ) VALUES (
                    ${deviceType},
                    ${thresholds.device_name},
                    ${deviceIdentifier ? parseInt(deviceIdentifier) : null},
                    ${warning.warning_type},
                    ${warning.warning_severity},
                    ${warning.measured_value}::real,
                    ${warning.threshold_value}::real,
                    ${warning.warning_message},
                    'active',
                    CURRENT_TIMESTAMP
                )
            `;

            // Gửi mail cảnh báo với Simple Email Manager
            try {
                await simpleEmailNotificationManager.processWarningEmail({
                    id: insertResult[0]?.id || null, // Sử dụng ID từ database insert
                    device_name: thresholds.device_name,
                    device_id: deviceIdentifier,
                    device_type: deviceType,
                    warning_type: warning.warning_type,
                    warning_severity: warning.warning_severity, // Fix: thêm warning_severity
                    severity: warning.warning_severity,
                    measured_value: warning.measured_value, // Fix: thêm measured_value
                    threshold_value: warning.threshold_value, // Fix: thêm threshold_value
                    warning_message: warning.warning_message, // Fix: thêm warning_message
                    message: warning.warning_message,
                    current_value: warning.measured_value,
                    timestamp: new Date().toISOString(), // Fix: thêm timestamp
                    created_at: new Date().toISOString(),
                    status: 'active',
                    device_location: `${thresholds.device_name} - ${deviceType}`,
                    maintenance_contact: 'Phòng Kỹ thuật - Ext: 1234'
                });
                console.log(`📧 Simple mail notification processed for ${warning.warning_type}`);
            } catch (mailError) {
                console.error('Lỗi gửi mail cảnh báo:', mailError);
                
                // Fallback to basic mail service với FULL DATA
                try {
                    await mailService.sendWarningEmail({
                        device_name: thresholds.device_name,
                        device_id: deviceIdentifier,
                        device_type: deviceType,
                        warning_type: warning.warning_type,
                        warning_severity: warning.warning_severity,
                        severity: warning.warning_severity,
                        measured_value: warning.measured_value, // ✅ FIX: Thêm measured_value
                        threshold_value: warning.threshold_value, // ✅ FIX: Thêm threshold_value
                        warning_message: warning.warning_message, // ✅ FIX: Thêm warning_message
                        message: warning.warning_message,
                        current_value: warning.measured_value,
                        timestamp: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        status: 'active'
                    });
                    console.log(`📧 Fallback mail sent for ${warning.warning_type}`);
                } catch (fallbackError) {
                    console.error('Fallback mail cũng lỗi:', fallbackError);
                }
            }
        }

        if (warnings.length > 0) {
            console.log(`⚠️  Created ${warnings.length} warning(s) for ${deviceType}`);
        }

        return warnings;
    } catch (error) {
        console.error(`Error checking warnings for ${deviceType}:`, error);
    }
};

// Get warning statistics
export const getWarningStatistics = async (req, res) => {
    try {
        const stats = await prisma.$queryRaw`
            SELECT 
                device_type,
                COUNT(*) as total_warnings,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_warnings,
                COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_warnings,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_warnings,
                COUNT(CASE WHEN warning_severity = 'critical' THEN 1 END) as critical_warnings,
                COUNT(CASE WHEN warning_severity = 'major' THEN 1 END) as major_warnings,
                COUNT(CASE WHEN warning_severity = 'moderate' THEN 1 END) as moderate_warnings,
                COUNT(CASE WHEN warning_severity = 'minor' THEN 1 END) as minor_warnings
            FROM device_warning_logs 
            GROUP BY device_type
            ORDER BY device_type
        `;

        return res.status(200).json({
            success: true,
            data: stats,
            message: 'Successfully retrieved warning statistics'
        });
    } catch (error) {
        console.error('Error fetching warning statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve warning statistics',
            error: error.message
        });
    }
};

// Delete all warning logs (requires confirmation)
export const deleteAllWarningLogs = async (req, res) => {
    try {
        const { confirmReset } = req.body;

        if (confirmReset !== 'CONFIRM_DELETE_ALL_WARNING_LOGS') {
            return res.status(400).json({
                success: false,
                message: "Xác nhận xóa không hợp lệ. Vui lòng gửi confirmReset: 'CONFIRM_DELETE_ALL_WARNING_LOGS'"
            });
        }

        // Get count before deletion for confirmation
        const countResult = await prisma.$queryRaw`
            SELECT COUNT(*) as total_count FROM device_warning_logs
        `;
        const totalCount = Number(countResult[0].total_count);

        // Delete all warning logs
        await prisma.$queryRaw`
            DELETE FROM device_warning_logs
        `;

        console.log(`🗑️  Deleted ${totalCount} warning logs from database`);

        return res.status(200).json({
            success: true,
            message: 'Đã xóa toàn bộ warning logs thành công!',
            deleted_count: totalCount
        });
    } catch (error) {
        console.error('Error deleting all warning logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete warning logs',
            error: error.message
        });
    }
};

    // PATCH /warnings/:id/status - cập nhật trạng thái cảnh báo
    export const updateWarningStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { status, acknowledged_by, resolution_notes } = req.body;
            
            if (!status || !['active', 'in_progress', 'resolved', 'ignored'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: active, in_progress, resolved, ignored.'
                });
            }

            let setClause = `status = '${status}'`;
            
            if (status === 'resolved') {
                setClause += `, resolved_at = CURRENT_TIMESTAMP`;
            }
            
            // Tạm thời set acknowledged_by = NULL để tránh foreign key constraint
            // TODO: Cập nhật sau khi hoàn thành migration users
            if (acknowledged_by !== undefined) {
                setClause += `, acknowledged_by = NULL`;
            }
            
            if (resolution_notes !== undefined) {
                const escapedNotes = resolution_notes?.replace(/'/g, "''") || '';
                setClause += `, resolution_notes = '${escapedNotes}'`;
            }

            const query = `UPDATE device_warning_logs SET ${setClause} WHERE id = ${parseInt(id)} RETURNING *`;
            const result = await prisma.$queryRawUnsafe(query);

            if (!result || result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy cảnh báo với id này.'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Cập nhật trạng thái cảnh báo thành công',
                updated_warning: result[0],
                note: 'acknowledged_by được set NULL tạm thời do migration'
            });
        } catch (error) {
            console.error('Error updating warning status:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật trạng thái cảnh báo',
                error: error.message
            });
        }
    };

    // POST /warnings/test - test kiểm tra cảnh báo thủ công cho dữ liệu hiện tại
    export const testCheckWarnings = async (req, res) => {
    try {
        const { device_type, data } = req.body;
        const warnings = await checkDeviceWarnings(device_type, data);
        res.json({
            success: true,
            warnings_created: warnings?.length || 0,
            warnings: warnings || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// DELETE /warnings/:id - xóa cảnh báo theo id
export const deleteWarningById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await prisma.$queryRaw`
            DELETE FROM device_warning_logs WHERE id = ${parseInt(id)} RETURNING id
        `;
        if (!result || result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cảnh báo với id này.'
            });
        }
        return res.status(200).json({
            success: true,
            deleted_id: result[0].id
        });
    } catch (error) {
        console.error('Error deleting warning:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa cảnh báo',
            error: error.message
        });
    }
};
