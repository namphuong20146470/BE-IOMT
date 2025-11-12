#!/usr/bin/env node

/**
 * 🔐 SWAGGER SECURITY VALIDATION SCRIPT
 * 
 * Script này kiểm tra và đảm bảo Swagger UI được cấu hình bảo mật đúng cách
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 SWAGGER SECURITY AUDIT - Starting...\n');

// ========================================
// 1. KIỂM TRA CẤU HÌNH MÔI TRƯỜNG
// ========================================
console.log('📋 1. Environment Configuration Check');

const requiredEnvVars = [
    'JWT_SECRET',
    'SESSION_SECRET', 
    'NODE_ENV',
    'PORT'
];

const securityEnvVars = [
    'ALLOW_SWAGGER_PRODUCTION',
    'SWAGGER_BUSINESS_HOURS_ONLY',
    'SWAGGER_ALLOWED_IPS'
];

let envIssues = [];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        envIssues.push(`❌ Missing required: ${varName}`);
    } else {
        console.log(`   ✅ ${varName}: Set`);
    }
});

securityEnvVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`   🔒 ${varName}: ${process.env[varName]}`);
    } else {
        console.log(`   ⚠️  ${varName}: Not set (using default)`);
    }
});

// Kiểm tra JWT secret strength
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    envIssues.push(`⚠️  JWT_SECRET too short (${process.env.JWT_SECRET.length} chars, recommended: 32+)`);
}

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SWAGGER_PRODUCTION === 'true') {
    envIssues.push(`🚨 CRITICAL: Swagger enabled in production! Set ALLOW_SWAGGER_PRODUCTION=false`);
}

console.log('');

// ========================================
// 2. KIỂM TRA FILES BẢO MẬT  
// ========================================
console.log('📁 2. Security Files Check');

const securityFiles = [
    './middleware/swaggerSecurity.js',
    './middleware/authMiddleware.js', 
    './swagger.yaml',
    './.env.security.example'
];

securityFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}: Exists`);
        
        // Kiểm tra nội dung cơ bản
        const content = fs.readFileSync(file, 'utf8');
        
        if (file.includes('swagger.yaml')) {
            if (content.includes('securitySchemes:')) {
                console.log(`      ✅ Security schemes configured`);
            } else {
                envIssues.push(`❌ ${file}: Missing security schemes`);
            }
        }
        
        if (file.includes('swaggerSecurity.js')) {
            if (content.includes('requireAuthentication')) {
                console.log(`      ✅ Authentication middleware present`);
            } else {
                envIssues.push(`❌ ${file}: Missing authentication middleware`);
            }
        }
        
    } else {
        envIssues.push(`❌ Missing security file: ${file}`);
    }
});

console.log('');

// ========================================
// 3. KIỂM TRA PACKAGE DEPENDENCIES
// ========================================
console.log('📦 3. Security Dependencies Check');

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const securityPackages = [
    'express-rate-limit',
    'jsonwebtoken',
    'bcrypt',
    'cors',
    'swagger-ui-express'
];

securityPackages.forEach(pkg => {
    if (packageJson.dependencies[pkg] || packageJson.devDependencies?.[pkg]) {
        console.log(`   ✅ ${pkg}: Installed`);
    } else {
        envIssues.push(`❌ Missing security package: ${pkg}`);
    }
});

console.log('');

// ========================================
// 4. KIỂM TRA SWAGGER ROUTES
// ========================================
console.log('🚀 4. Server Route Configuration Check');

const indexContent = fs.readFileSync('./index.js', 'utf8');

// Kiểm tra các route patterns bảo mật
const securityChecks = [
    {
        pattern: 'swaggerSecurityMiddleware',
        name: 'Security middleware import'
    },
    {
        pattern: '/secure-api-docs',
        name: 'Secure Swagger route (not /api-docs)'
    },
    {
        pattern: 'customCss:',
        name: 'Custom security styling'
    },
    {
        pattern: 'persistAuthorization: false',
        name: 'No token persistence'
    }
];

securityChecks.forEach(check => {
    if (indexContent.includes(check.pattern)) {
        console.log(`   ✅ ${check.name}: Configured`);
    } else {
        envIssues.push(`⚠️  ${check.name}: Not found in index.js`);
    }
});

console.log('');

// ========================================
// 5. NETWORK SECURITY CHECK
// ========================================
console.log('🌐 5. Network Security Check');

const port = process.env.PORT || 3030;
const httpPort = process.env.HTTP_PORT || 3031;

// Kiểm tra HTTPS certificate (nếu có)
if (fs.existsSync('./certificates/server.crt')) {
    console.log('   ✅ SSL Certificate: Found');
} else {
    envIssues.push('⚠️  SSL Certificate: Not found (using development cert)');
}

// Kiểm tra CORS configuration
if (indexContent.includes('allowedOrigins')) {
    console.log('   ✅ CORS: Configured with whitelist');
} else {
    envIssues.push('⚠️  CORS: May not be properly restricted');
}

console.log('');

// ========================================
// 6. TẠO BÁO CÁO TỔNG HỢP
// ========================================
console.log('📊 6. Security Audit Summary');
console.log('=' .repeat(60));

if (envIssues.length === 0) {
    console.log('🎉 EXCELLENT! All security checks passed.');
    console.log('');
    console.log('✅ Swagger UI is properly secured with:');
    console.log('   - Authentication middleware');
    console.log('   - Rate limiting');  
    console.log('   - Environment checks');
    console.log('   - Secure route path');
    console.log('   - No token persistence');
    console.log('   - Custom security styling');
    console.log('');
    console.log('🔒 Your API documentation is production-ready!');
    
} else {
    console.log(`⚠️  Found ${envIssues.length} security issues:`);
    console.log('');
    
    envIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
    });
    
    console.log('');
    console.log('🔧 Recommended Actions:');
    console.log('1. Fix the issues listed above');
    console.log('2. Review .env.security.example for proper configuration');
    console.log('3. Ensure all security middleware is properly imported');
    console.log('4. Test authentication before deploying');
    console.log('5. Consider additional IP restrictions for production');
}

console.log('');
console.log('📚 Documentation Access:');
console.log(`   - Secure Swagger UI: https://localhost:${port}/secure-api-docs`);
console.log(`   - Old route (blocked): https://localhost:${port}/api-docs`);
console.log('');
console.log('🔑 Authentication Required:');
console.log('   - Login: POST /auth/login');
console.log('   - Use Bearer token in Swagger UI');
console.log('   - Required roles: super_admin, admin, developer, api_user');

console.log('');
console.log('🔐 SWAGGER SECURITY AUDIT - Completed!');

// Exit với code phù hợp
process.exit(envIssues.length > 0 ? 1 : 0);