// Test timestamp parsing function
function parseMqttTimestamp(timestampStr) {
    if (!timestampStr) return new Date();
    
    try {
        // Expected format: "HH:mm:ss DD/MM/YYYY"
        const match = timestampStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
        
        if (match) {
            const [, hours, minutes, seconds, day, month, year] = match;
            // JavaScript Date: months are 0-indexed
            const date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            );
            
            // Validate the date is valid
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Fallback: try native Date parsing
        const date = new Date(timestampStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        // If all parsing fails, use current time
        console.warn(`⚠️  Invalid timestamp format: "${timestampStr}", using current time`);
        return new Date();
        
    } catch (error) {
        console.error(`❌ Error parsing timestamp "${timestampStr}":`, error.message);
        return new Date();
    }
}

console.log('\n🧪 TESTING TIMESTAMP PARSING\n');
console.log('='.repeat(60));

const testCases = [
    // Valid MQTT format
    "16:38:46 17/12/2025",
    "09:15:30 01/01/2024",
    "23:59:59 31/12/2025",
    
    // Invalid formats
    "17/12/2025 16:38:46",  // Wrong order
    "2025-12-17T16:38:46",  // ISO format
    "invalid",
    null,
    undefined,
    ""
];

testCases.forEach(testCase => {
    const result = parseMqttTimestamp(testCase);
    const isValid = !isNaN(result.getTime());
    
    console.log(`\nInput: "${testCase}"`);
    console.log(`  Result: ${result.toISOString()}`);
    console.log(`  Valid: ${isValid ? '✅' : '❌'}`);
    console.log(`  Local: ${result.toLocaleString('vi-VN')}`);
});

console.log('\n' + '='.repeat(60));
console.log('\n✅ All test cases completed\n');
