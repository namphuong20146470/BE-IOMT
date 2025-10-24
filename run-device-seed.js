/**
 * 🚀 DEVICE SEEDING RUNNER
 * Simple script to run device module seeding
 */

import seedDeviceData from './seed-devices.js';

console.log('🏥 IOMT DEVICE MODULE SEEDING');
console.log('=============================');

try {
    const result = await seedDeviceData();
    
    console.log('\n✅ SEEDING SUCCESSFUL!');
    console.log('Result:', result);
    
} catch (error) {
    console.error('\n❌ SEEDING FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}