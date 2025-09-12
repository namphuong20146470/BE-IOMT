// Test với dữ liệu thực tế từ database format
import mailService from './services/mailService.js';
import { formatWarningDataForEmail } from './utils/emailFormatter.js';

// Simulated data từ database như trong controller
const simulatedDBData = {
    "id": 8220,
    "device_type": "camera_control_unit", 
    "device_name": "Module xử lý hình ảnh",
    "device_id": null,
    "warning_type": "voltage_high",
    "warning_severity": "major", // Từ database
    "measured_value": 300,
    "threshold_value": 288,
    "warning_message": "Điện áp vượt ngưỡng cao",
    "status": "active",
    "timestamp": "2025-09-12T08:00:00.000Z"
};

console.log('🧪 Testing với dữ liệu thực tế từ database format...\n');

console.log('📥 Raw database data:');
console.log('  warning_severity:', simulatedDBData.warning_severity);
console.log('  warning_type:', simulatedDBData.warning_type);
console.log('  measured_value:', simulatedDBData.measured_value);
console.log('  threshold_value:', simulatedDBData.threshold_value);

// Format data qua emailFormatter (như trong controller)
const formattedData = await formatWarningDataForEmail(simulatedDBData, 'warning');

console.log('\n📤 Formatted data:');
console.log('  severity:', formattedData.severity);
console.log('  warning_severity:', formattedData.warning_severity);
console.log('  template_icon:', formattedData.template_icon);
console.log('  template_color:', formattedData.template_color);

// Test generateWarningEmailHTML với formatted data
console.log('\n🎨 Testing HTML generation...');
const htmlContent = mailService.generateWarningEmailHTML(formattedData);

// Extract colors from HTML
const headerMatch = htmlContent.match(/\.header\s*\{\s*background:\s*([^;]+);/);
const warningBoxMatch = htmlContent.match(/\.warning-box\s*\{\s*background:[^;]*border-left:[^;]*solid\s*([^;]+);/);

const headerColor = headerMatch ? headerMatch[1].trim() : 'NOT FOUND';
const borderColor = warningBoxMatch ? warningBoxMatch[1].trim() : 'NOT FOUND';

console.log('  Header background color:', headerColor);
console.log('  Warning box border color:', borderColor);

// Test severity mapping
const severityInfo = mailService.getSeverityInfo(formattedData.severity || formattedData.warning_severity);
console.log('\n📊 Severity mapping result:');
console.log('  Input severity:', formattedData.severity || formattedData.warning_severity);
console.log('  Mapped to:', severityInfo.text);
console.log('  Color:', severityInfo.color);
console.log('  Icon:', severityInfo.icon);

console.log('\n✅ Validation:');
console.log('  Header color matches:', headerColor === severityInfo.color);
console.log('  Expected color (major/high):', '#f57c00');
console.log('  Actual header color:', headerColor);

// Test với critical severity
console.log('\n🔴 Testing với critical severity...');
const criticalData = {
    ...simulatedDBData,
    warning_severity: 'critical',
    warning_type: 'leak_current_shutdown'
};

const formattedCritical = await formatWarningDataForEmail(criticalData, 'warning');
const criticalHTML = mailService.generateWarningEmailHTML(formattedCritical);
const criticalHeaderMatch = criticalHTML.match(/\.header\s*\{\s*background:\s*([^;]+);/);
const criticalHeaderColor = criticalHeaderMatch ? criticalHeaderMatch[1].trim() : 'NOT FOUND';

console.log('  Critical header color:', criticalHeaderColor);
console.log('  Expected (critical):', '#d32f2f');
console.log('  Critical color correct:', criticalHeaderColor === '#d32f2f');

console.log('\n🎯 Summary: Header colors should correctly reflect severity levels!');
