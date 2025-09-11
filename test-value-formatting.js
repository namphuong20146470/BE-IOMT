/**
 * Test script để kiểm tra format giá trị hiện tại và ngưỡng cảnh báo
 */

import { formatWarningDataWithUserInfo } from './utils/emailFormatter.js';

// Dữ liệu test từ user
const testWarningData = {
    "id": 8220,
    "device_type": "camera_control_unit",
    "device_name": "Module xử lý hình ảnh",
    "device_id": null,
    "warning_type": "power_warning",
    "warning_severity": "moderate",
    "measured_value": 100,
    "threshold_value": 96,
    "warning_message": "Công suất vượt ngưỡng",
    "status": "resolved",
    "resolved_at": "2025-09-11T15:48:32.523Z",
    "acknowledged_by": 56,
    "resolution_notes": "Đã xử lý xong từ giao diện người dùng",
    "timestamp": "2025-09-11T15:46:13.083Z",
    "formatted_time": "2025-09-11 15:46:13"
};

// Test cases khác nhau
const testCases = [
    {
        name: "Power Warning - Công suất vượt ngưỡng",
        data: { ...testWarningData }
    },
    {
        name: "Voltage High - Điện áp cao",
        data: {
            ...testWarningData,
            warning_type: "voltage_high",
            measured_value: 220.5,
            threshold_value: 215.0,
            warning_message: "Điện áp quá cao"
        }
    },
    {
        name: "Current High - Dòng điện cao",
        data: {
            ...testWarningData,
            warning_type: "current_high",
            measured_value: 15.75,
            threshold_value: 12.50,
            warning_message: "Dòng điện quá cao"
        }
    },
    {
        name: "Temperature High - Nhiệt độ cao",
        data: {
            ...testWarningData,
            warning_type: "temperature_high",
            measured_value: 85.2,
            threshold_value: 80.0,
            warning_message: "Nhiệt độ quá cao"
        }
    },
    {
        name: "Leak Current - Dòng rò",
        data: {
            ...testWarningData,
            warning_type: "leak_current_strong",
            measured_value: 5.8,
            threshold_value: 3.0,
            warning_message: "Dòng rò mạnh"
        }
    },
    {
        name: "Humidity High - Độ ẩm cao", 
        data: {
            ...testWarningData,
            warning_type: "humidity_high",
            measured_value: 78.5,
            threshold_value: 70.0,
            warning_message: "Độ ẩm quá cao"
        }
    }
];

async function runTests() {
    console.log('🧪 Test Format Giá Trị và Ngưỡng Cảnh Báo\n');
    console.log('='.repeat(60));
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
        console.log('-'.repeat(40));
        
        try {
            // Test warning email
            const warningFormat = await formatWarningDataWithUserInfo(testCase.data, 'warning');
            
            console.log(`📊 Giá trị gốc:`);
            console.log(`   Measured: ${testCase.data.measured_value}`);
            console.log(`   Threshold: ${testCase.data.threshold_value}`);
            console.log();
            
            console.log(`✨ Giá trị đã format:`);
            console.log(`   Current Value: ${warningFormat.current_value}`);
            console.log(`   Threshold Value: ${warningFormat.threshold_value}`);
            console.log(`   Comparison: ${warningFormat.value_comparison}`);
            console.log();
            
            console.log(`📧 Email Info:`);
            console.log(`   Subject: ${warningFormat.subject_prefix}: ${warningFormat.device_name} - ${warningFormat.warning_type}`);
            console.log(`   Severity: ${warningFormat.severity} ${warningFormat.template_icon}`);
            console.log(`   Message: ${warningFormat.message}`);
            
            // Test resolution email nếu đã resolved
            if (testCase.data.status === 'resolved') {
                console.log();
                console.log(`✅ Resolution Format:`);
                const resolutionFormat = await formatWarningDataWithUserInfo(testCase.data, 'resolution');
                console.log(`   Resolved by: ${resolutionFormat.resolved_by}`);
                console.log(`   Resolution time: ${resolutionFormat.resolution_time}`);
                console.log(`   Notes: ${resolutionFormat.resolution_notes}`);
            }
            
        } catch (error) {
            console.error(`❌ Error in test ${i + 1}:`, error.message);
        }
        
        console.log('='.repeat(60));
    }
    
    console.log('\n🎉 Test hoàn thành!');
}

runTests().catch(console.error);
