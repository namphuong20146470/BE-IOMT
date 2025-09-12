// Debug email recipients - kiểm tra tại sao ngocthuongbt2021@gmail.com vẫn được gửi
import dotenv from 'dotenv';
import mailService from './services/mailService.js';

// Reload environment variables
dotenv.config();

console.log('🔍 DEBUG: Email recipients issue...\n');

// Check current environment variables
console.log('📧 Current environment variables:');
for (let i = 1; i <= 10; i++) {
    const emailKey = `ALERT_EMAIL_${i}`;
    const email = process.env[emailKey];
    if (email) {
        console.log(`${emailKey}: "${email}"`);
    } else {
        console.log(`${emailKey}: undefined`);
    }
}

// Check if the problematic email appears anywhere
const problematicEmail = 'ngocthuongbt2021@gmail.com';
console.log(`\n🔍 Searching for "${problematicEmail}" in environment:`);

let foundInEnv = false;
for (let i = 1; i <= 20; i++) {
    const emailKey = `ALERT_EMAIL_${i}`;
    const email = process.env[emailKey];
    if (email && email.includes(problematicEmail)) {
        console.log(`❌ Found in ${emailKey}: "${email}"`);
        foundInEnv = true;
    }
}

if (!foundInEnv) {
    console.log('✅ Email NOT found in environment variables');
}

// Check what getRecipients() returns
console.log('\n📋 Recipients from mailService.getRecipients():');
const recipients = mailService.getRecipients();
console.log('Total recipients:', recipients.length);
recipients.forEach((email, index) => {
    console.log(`  ${index + 1}: "${email}"`);
    if (email.includes(problematicEmail)) {
        console.log(`    ❌ FOUND PROBLEMATIC EMAIL!`);
    }
});

// Check if problematic email is in recipients
const isProblematicEmailInList = recipients.some(email => 
    email.includes(problematicEmail)
);

console.log(`\n🎯 "${problematicEmail}" in recipients list:`, isProblematicEmailInList);

// Manual check all env vars containing the email
console.log('\n🔍 Manual search in all process.env:');
let foundKeys = [];
for (const [key, value] of Object.entries(process.env)) {
    if (value && typeof value === 'string' && value.includes(problematicEmail)) {
        foundKeys.push({ key, value });
        console.log(`❌ Found in ${key}: "${value}"`);
    }
}

if (foundKeys.length === 0) {
    console.log('✅ Email NOT found in any environment variable');
}

// Check .env file content directly
console.log('\n📄 Checking .env file content...');
import fs from 'fs';
try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envLines = envContent.split('\n');
    
    let lineNumber = 0;
    let foundInFile = false;
    
    envLines.forEach((line, index) => {
        if (line.includes(problematicEmail)) {
            console.log(`❌ Found in .env file line ${index + 1}: "${line}"`);
            foundInFile = true;
        }
    });
    
    if (!foundInFile) {
        console.log('✅ Email NOT found in .env file');
    }
    
} catch (error) {
    console.error('Error reading .env file:', error.message);
}

// Show mailService status
console.log('\n📊 MailService status:');
const status = mailService.getStatus();
console.log('Recipients from status:', status.recipients);

console.log('\n💡 Possible causes:');
console.log('1. Server needs restart after .env changes');
console.log('2. There might be cached environment variables');
console.log('3. Email might be hardcoded somewhere in the code');
console.log('4. Multiple .env files or PM2 ecosystem config');
console.log('5. Docker container with old environment variables');

console.log('\n🔧 Solutions:');
console.log('1. Restart the Node.js process completely');
console.log('2. Check if using PM2: pm2 restart all');
console.log('3. Check if using Docker: docker-compose restart');
console.log('4. Clear any process manager cache');
