#!/usr/bin/env node

/**
 * 🚀 IoMT System Setup (Simplified)
 * 
 * Version đơn giản tránh lỗi Prisma generation trên Windows
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

console.log('🚀 IoMT System Setup (Simplified) Started...\n');

async function setupSystem() {
    try {
        // 1. Test database connection
        console.log('📋 1. Testing Database Connection...');
        await prisma.$connect();
        console.log('   ✅ Database connected successfully');

        // 2. Get existing permissions
        console.log('\n🔑 2. Getting Existing Permissions...');
        const existingPermissions = await prisma.permissions.findMany({
            where: { is_active: true },
            select: { name: true }
        });
        
        const permissionNames = existingPermissions.map(p => p.name);
        console.log(`   ✅ Found ${permissionNames.length} existing permissions:`, permissionNames.join(', '));

        // 3. Create default roles
        console.log('\n👑 3. Creating Roles...');
        
        // Define roles with permissions that exist in the system
        const roles = [
            { 
                name: 'Super Admin', 
                description: 'Quyền cao nhất hệ thống, quản lý toàn bộ',
                permissions: permissionNames // All available permissions
            },
            { 
                name: 'Organization Admin', 
                description: 'Quản trị viên tổ chức',
                permissions: permissionNames.filter(p => 
                    !p.includes('system') && 
                    (p.includes('user') || p.includes('role') || p.includes('device') || p.includes('organization'))
                )
            },
            { 
                name: 'Department Manager', 
                description: 'Quản lý phòng ban',
                permissions: permissionNames.filter(p => 
                    p.includes('device') || p.includes('patient') || p.includes('department')
                )
            },
            { 
                name: 'Bác sĩ', 
                description: 'Bác sĩ',
                permissions: permissionNames.filter(p => 
                    p.includes('device_read') || p.includes('patient') || p.includes('view')
                )
            },
            { 
                name: 'Y tá', 
                description: 'Y tá có quyền hạn tương tự bác sĩ',
                permissions: permissionNames.filter(p => 
                    p.includes('device_read') || p.includes('patient_data_read') || p.includes('view')
                )
            }
        ];

        for (const roleData of roles) {
            const role = await prisma.roles.upsert({
                where: { name: roleData.name },
                update: { description: roleData.description },
                create: {
                    id: uuidv4(),
                    name: roleData.name,
                    description: roleData.description,
                    created_at: new Date()
                }
            });

            // Assign permissions
            for (const permCode of roleData.permissions) {
                const permission = await prisma.permissions.findUnique({
                    where: { name: permCode }
                });
                
                if (permission) {
                    await prisma.role_permissions.upsert({
                        where: {
                            role_id_permission_id: {
                                role_id: role.id,
                                permission_id: permission.id
                            }
                        },
                        update: {},
                        create: {
                            id: uuidv4(),
                            role_id: role.id,
                            permission_id: permission.id
                        }
                    });
                }
            }
        }
        console.log(`   ✅ Created ${roles.length} roles`);

        // 4. Create default organization
        console.log('\n🏥 4. Creating Organization...');
        
        // Try to find existing organization first
        let org = await prisma.organizations.findFirst({
            where: { code: 'IOMT_HOSP' }
        });
        
        if (!org) {
            org = await prisma.organizations.create({
                data: {
                    id: uuidv4(),
                    name: 'IoMT Hospital System',
                    type: 'hospital', // Required field
                    code: 'IOMT_HOSP',
                    description: 'Main hospital organization',
                    address: '123 Healthcare Ave',
                    phone: '+1-555-0123',
                    email: 'contact@iomt.com',
                    is_active: true,
                    created_at: new Date()
                }
            });
        }
        console.log('   ✅ Organization ready:', org.name);

        // 5. Create default departments
        console.log('\n🏢 5. Creating Departments...');
        const departments = [
            { name: 'Emergency Department', code: 'EMERGENCY' },
            { name: 'Intensive Care Unit', code: 'ICU' },
            { name: 'Surgery Department', code: 'SURGERY' },
            { name: 'Administration', code: 'ADMIN' }
        ];

        const deptList = [];
        for (const dept of departments) {
            let department = await prisma.departments.findFirst({
                where: {
                    organization_id: org.id,
                    code: dept.code
                }
            });

            if (!department) {
                department = await prisma.departments.create({
                    data: {
                        id: uuidv4(),
                        organization_id: org.id,
                        name: dept.name,
                        code: dept.code,
                        description: dept.name,
                        created_at: new Date()
                    }
                });
            }
            deptList.push(department);
        }
        console.log(`   ✅ Created ${deptList.length} departments`);

        // Default department for admin users
        const adminDept = deptList.find(d => d.code === 'ADMIN');

        // 6. Create default users
        console.log('\n👤 4. Creating Users...');
        const users = [
            { username: 'superadmin', email: 'superadmin@iomt.com', full_name: 'Super Administrator', password: 'SuperAdmin@2024!', role: 'Super Admin' },
            { username: 'orgadmin', email: 'orgadmin@iomt.com', full_name: 'Organization Administrator', password: 'OrgAdmin@2024!', role: 'Organization Admin' },
            { username: 'deptmanager', email: 'manager@hospital.com', full_name: 'Department Manager', password: 'Manager@2024!', role: 'Department Manager' },
            { username: 'doctor1', email: 'doctor1@hospital.com', full_name: 'Dr. John Smith', password: 'Doctor@2024!', role: 'Bác sĩ' },
            { username: 'nurse1', email: 'nurse1@hospital.com', full_name: 'Nurse Mary Johnson', password: 'Nurse@2024!', role: 'Y tá' }
        ];

        for (const userData of users) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            const user = await prisma.users.upsert({
                where: { username: userData.username },
                update: {
                    email: userData.email,
                    full_name: userData.full_name,
                    is_active: true
                },
                create: {
                    id: uuidv4(),
                    username: userData.username,
                    email: userData.email,
                    full_name: userData.full_name,
                    password_hash: hashedPassword,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });

            // Assign role
            const role = await prisma.roles.findUnique({
                where: { name: userData.role }
            });

            if (role) {
                await prisma.user_roles.upsert({
                    where: {
                        user_id_role_id_organization_id_department_id: {
                            user_id: user.id,
                            role_id: role.id,
                            organization_id: org.id,
                            department_id: adminDept.id
                        }
                    },
                    update: {},
                    create: {
                        id: uuidv4(),
                        user_id: user.id,
                        role_id: role.id,
                        organization_id: org.id,
                        department_id: adminDept.id,
                        is_active: true,
                        assigned_at: new Date()
                    }
                });
            }

            console.log(`   ✅ Created user: ${userData.username}`);
        }

        // 6. Create default departments (using existing org)



        // 7. Final health check
        console.log('\n🔍 7. Final Health Check...');
        const stats = {
            users: await prisma.users.count(),
            roles: await prisma.roles.count(),
            permissions: await prisma.permissions.count(),
            organizations: await prisma.organizations.count(),
            departments: await prisma.departments.count()
        };

        console.log(`   👥 Users: ${stats.users}`);
        console.log(`   👑 Roles: ${stats.roles}`);
        console.log(`   🔑 Permissions: ${stats.permissions}`);
        console.log(`   🏥 Organizations: ${stats.organizations}`);
        console.log(`   🏢 Departments: ${stats.departments}`);

        // 8. Save setup report
        const report = {
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
            stats,
            credentials: users.map(u => ({
                username: u.username,
                role: u.role,
                note: 'Password in setup output'
            }))
        };

        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs');
        }
        fs.writeFileSync('./logs/simple-setup-report.json', JSON.stringify(report, null, 2));

        console.log('\n🎉 SETUP COMPLETED SUCCESSFULLY!\n');
        
        console.log('📋 SUMMARY:');
        console.log('==========================================');
        console.log(`✅ Users created: ${stats.users}`);
        console.log(`✅ Roles created: ${stats.roles}`);
        console.log(`✅ Permissions: ${stats.permissions}`);
        console.log(`✅ Organizations: ${stats.organizations}`);
        console.log(`✅ Departments: ${stats.departments}`);
        console.log('');
        
        console.log('🔑 LOGIN CREDENTIALS:');
        console.log('==========================================');
        users.forEach(user => {
            console.log(`${user.username.padEnd(12)} / ${user.password} (${user.role})`);
        });
        console.log('');
        
        console.log('🚀 NEXT STEPS:');
        console.log('==========================================');
        console.log('1. npm run dev                           # Start server');
        console.log('2. http://localhost:3030/secure-api-docs # Swagger UI');
        console.log('3. Login với credentials ở trên');
        console.log('');
        
        console.log('⚠️ IMPORTANT:');
        console.log('==========================================');
        console.log('- Change passwords trước khi production!');
        console.log('- Update JWT_SECRET trong .env');
        console.log('- Configure SSL certificates');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        
        if (error.message.includes('EPERM')) {
            console.log('\n💡 Windows Permission Issue Detected:');
            console.log('Try running as Administrator or:');
            console.log('1. Close all VS Code instances');
            console.log('2. Run: taskkill /F /IM node.exe');
            console.log('3. Run setup again');
        }
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

setupSystem();