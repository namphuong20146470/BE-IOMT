// Test severity mapping for email headers
import mailService from './services/mailService.js';

// Test data với các severity khác nhau
const testCases = [
    {
        name: 'Database raw data (major)',
        data: {
            device_name: 'Module xử lý hình ảnh',
            warning_type: 'voltage_high',
            warning_severity: 'major', // Từ database
            measured_value: 300,
            threshold_value: 288,
            created_at: new Date().toISOString()
        }
    },
    {
        name: 'Formatted data (high)',
        data: {
            device_name: 'Module xử lý hình ảnh',
            warning_type: 'voltage_high',
            severity: 'high', // Đã được format
            warning_severity: 'major',
            measured_value: 300,
            threshold_value: 288,
            created_at: new Date().toISOString()
        }
    },
    {
        name: 'Critical severity',
        data: {
            device_name: 'Module xử lý hình ảnh',
            warning_type: 'leak_current_shutdown',
            warning_severity: 'critical',
            severity: 'critical',
            measured_value: 15,
            threshold_value: 10,
            created_at: new Date().toISOString()
        }
    },
    {
        name: 'Moderate severity',
        data: {
            device_name: 'Module xử lý hình ảnh',
            warning_type: 'power_warning',
            warning_severity: 'moderate',
            severity: 'medium',
            measured_value: 100,
            threshold_value: 96,
            created_at: new Date().toISOString()
        }
    }
];

console.log('🧪 Testing severity mapping for email headers...\n');

testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
    console.log('📥 Input data:', {
        severity: testCase.data.severity,
        warning_severity: testCase.data.warning_severity
    });
    
    // Test getSeverityInfo directly
    const severityInfo1 = mailService.getSeverityInfo(testCase.data.severity || testCase.data.warning_severity);
    console.log('📤 getSeverityInfo result:', {
        text: severityInfo1.text,
        color: severityInfo1.color,
        icon: severityInfo1.icon
    });
    
    // Test generateWarningEmailHTML and check if header has correct color
    const htmlContent = mailService.generateWarningEmailHTML(testCase.data);
    
    // Extract header background color from HTML
    const headerMatch = htmlContent.match(/\.header\s*\{\s*background:\s*([^;]+);/);
    const extractedColor = headerMatch ? headerMatch[1].trim() : 'NOT FOUND';
    
    console.log('🎨 Header background color in HTML:', extractedColor);
    console.log('✅ Expected color:', severityInfo1.color);
    console.log('🔍 Colors match:', extractedColor === severityInfo1.color);
    
    // Test với template_color override
    if (testCase.data.template_color) {
        console.log('🎭 Template color override:', testCase.data.template_color);
    }
    
    console.log('---'.repeat(20));
});

console.log('\n🎯 Summary: All severity levels should map to correct header colors');
console.log('🔴 critical -> #d32f2f (red)');
console.log('🟠 major/high -> #f57c00 (orange)');
console.log('🟡 moderate/medium -> #fbc02d (yellow)');
console.log('🟢 minor/low -> #388e3c (green)');
console.log('⚪ default -> #757575 (gray)');
