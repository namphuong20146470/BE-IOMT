import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🌱 Starting IoMT database seeding...');

        // Clean existing data (optional - for development)
        console.log('🧹 Cleaning existing data...');
        await prisma.user_roles.deleteMany();
        await prisma.role_permissions.deleteMany();
        await prisma.device_connectivity.deleteMany();
        await prisma.warranty_info.deleteMany();
        await prisma.specifications.deleteMany();
        await prisma.device.deleteMany();
        await prisma.device_models.deleteMany();
        await prisma.device_categories.deleteMany();
        await prisma.suppliers.deleteMany();
        await prisma.manufacturers.deleteMany();
        await prisma.users.deleteMany();
        await prisma.permissions.deleteMany();
        await prisma.roles.deleteMany();
        await prisma.departments.deleteMany();
        await prisma.organizations.deleteMany();
        await prisma.auo_display.deleteMany();
        await prisma.iot_environment_status.deleteMany();

        // 1. Create Organizations
        console.log('📊 Creating organizations...');
        const organization = await prisma.organizations.create({
            data: {
                id: '7e983a73-c2b2-475d-a1dd-85b722ab4581',
                name: 'Bệnh viện Đa khoa Thành phố',
                type: 'hospital',
                code: 'BVDK-TP',
                address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
                phone: '028-3822-1234',
                email: 'contact@bvdkthanh.vn',
                website: 'https://bvdkthanh.vn',
                status: 'ACTIVE'
            }
        });

        // 2. Create Departments
        console.log('🏢 Creating departments...');
        const departments = await Promise.all([
            prisma.departments.create({
                data: {
                    name: 'Phòng Xét nghiệm',
                    organization_id: organization.id,
                    description: 'Phòng xét nghiệm tổng hợp'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng Chẩn đoán hình ảnh',
                    organization_id: organization.id,
                    description: 'Phòng X-quang, CT, MRI, siêu âm'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng Hồi sức cấp cứu',
                    organization_id: organization.id,
                    description: 'Phòng hồi sức tích cực'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng IT',
                    organization_id: organization.id,
                    description: 'Phòng Công nghệ thông tin'
                }
            })
        ]);

        // 3. Create Roles
        console.log('👥 Creating roles...');
        const roles = await Promise.all([
            prisma.roles.create({
                data: {
                    name: 'Admin',
                    description: 'Quản trị viên hệ thống',
                    is_system_role: true,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'Manager',
                    description: 'Quản lý phòng ban',
                    is_system_role: false,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'Technician',
                    description: 'Kỹ thuật viên thiết bị',
                    is_system_role: false,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'User',
                    description: 'Người dùng cơ bản',
                    is_system_role: false,
                    organization_id: organization.id
                }
            })
        ]);

        // 4. Create Permissions
        console.log('🔐 Creating permissions...');
        const permissions = await Promise.all([
            // Device permissions
            prisma.permissions.create({
                data: {
                    name: 'device.read',
                    description: 'Xem thông tin thiết bị',
                    resource: 'device',
                    action: 'read'
                }
            }),
            prisma.permissions.create({
                data: {
                    name: 'device.create',
                    description: 'Tạo thiết bị mới',
                    resource: 'device',
                    action: 'create'
                }
            }),
            prisma.permissions.create({
                data: {
                    name: 'device.update',
                    description: 'Cập nhật thiết bị',
                    resource: 'device',
                    action: 'update'
                }
            }),
            prisma.permissions.create({
                data: {
                    name: 'device.delete',
                    description: 'Xóa thiết bị',
                    resource: 'device',
                    action: 'delete'
                }
            }),
            // User permissions
            prisma.permissions.create({
                data: {
                    name: 'user.read',
                    description: 'Xem thông tin người dùng',
                    resource: 'user',
                    action: 'read'
                }
            }),
            prisma.permissions.create({
                data: {
                    name: 'user.create',
                    description: 'Tạo người dùng mới',
                    resource: 'user',
                    action: 'create'
                }
            }),
            // System permissions
            prisma.permissions.create({
                data: {
                    name: 'system.admin',
                    description: 'Quản trị hệ thống',
                    resource: 'system',
                    action: 'admin'
                }
            })
        ]);

        // 5. Assign permissions to roles
        console.log('🔗 Assigning permissions to roles...');
        await Promise.all([
            // Admin has all permissions
            ...permissions.map(permission => 
                prisma.role_permissions.create({
                    data: {
                        role_id: roles[0].id,
                        permission_id: permission.id
                    }
                })
            ),
            // Manager has device and user permissions
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id,
                    permission_id: permissions[0].id // device.read
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id,
                    permission_id: permissions[1].id // device.create
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id,
                    permission_id: permissions[4].id // user.read
                }
            }),
            // Technician has device read/update
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id,
                    permission_id: permissions[0].id // device.read
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id,
                    permission_id: permissions[2].id // device.update
                }
            }),
            // User has basic read permissions
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id,
                    permission_id: permissions[0].id // device.read
                }
            })
        ]);

        // 6. Create Users
        console.log('👤 Creating users...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const users = await Promise.all([
            prisma.users.create({
                data: {
                    username: 'admin',
                    email: 'admin@bvdkthanh.vn',
                    password_hash: hashedPassword,
                    full_name: 'Quản trị viên',
                    phone: '0123456789',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[3].id }
                    }
                }
            }),
            prisma.users.create({
                data: {
                    username: 'BSNHhai',
                    email: 'hai.nguyen@bvdkthanh.vn',
                    password_hash: await bcrypt.hash('password123', 10),
                    full_name: 'BS. Nguyễn Hồng Hải',
                    phone: '0987654321',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[0].id }
                    }
                }
            }),
            prisma.users.create({
                data: {
                    username: 'technician1',
                    email: 'tech1@bvdkthanh.vn',
                    password_hash: await bcrypt.hash('tech123', 10),
                    full_name: 'Nguyễn Văn Tâm',
                    phone: '0912345678',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[1].id }
                    }
                }
            })
        ]);

        // 7. Assign roles to users
        console.log('🔗 Assigning roles to users...');
        await Promise.all([
            prisma.user_roles.create({
                data: {
                    user_id: users[0].id,
                    role_id: roles[0].id, // Admin role
                    assigned_by: users[0].id,
                    is_active: true
                }
            }),
            prisma.user_roles.create({
                data: {
                    user_id: users[1].id,
                    role_id: roles[1].id, // Manager role
                    assigned_by: users[0].id,
                    is_active: true
                }
            }),
            prisma.user_roles.create({
                data: {
                    user_id: users[2].id,
                    role_id: roles[2].id, // Technician role
                    assigned_by: users[0].id,
                    is_active: true
                }
            })
        ]);

        // 8. Create Device Categories
        console.log('📱 Creating device categories...');
        const categories = await Promise.all([
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị y tế',
                    description: 'Tất cả thiết bị y tế trong bệnh viện'
                }
            })
        ]);

        const subCategories = await Promise.all([
            prisma.device_categories.create({
                data: {
                    name: 'Máy xét nghiệm',
                    description: 'Các loại máy xét nghiệm tự động',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Máy chẩn đoán hình ảnh',
                    description: 'X-quang, CT, MRI, siêu âm',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị hồi sức',
                    description: 'Máy thở, monitor, máy sốc tim',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị môi trường',
                    description: 'Cảm biến nhiệt độ, độ ẩm, ánh sáng',
                    parent_id: categories[0].id
                }
            })
        ]);

        // 8. Create Manufacturers & Suppliers
        console.log('🏭 Creating manufacturers and suppliers...');
        const manufacturers = await Promise.all([
            prisma.manufacturers.create({
                data: {
                    name: 'Roche Diagnostics',
                    country: 'Germany',
                    website: 'https://www.roche.com',
                    contact_info: {
                        email: 'contact@roche.com',
                        phone: '+49-7624-14-0'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'Siemens Healthineers',
                    country: 'Germany', 
                    website: 'https://www.siemens-healthineers.com',
                    contact_info: {
                        email: 'contact@siemens.com',
                        phone: '+49-9131-84-0'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'GE Healthcare',
                    country: 'USA',
                    website: 'https://www.gehealthcare.com',
                    contact_info: {
                        email: 'contact@ge.com',
                        phone: '+1-262-544-3011'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'AUO Corporation',
                    country: 'Taiwan',
                    website: 'https://www.auo.com',
                    contact_info: {
                        email: 'contact@auo.com',
                        phone: '+886-3-520-8888'
                    }
                }
            })
        ]);

        const suppliers = await Promise.all([
            prisma.suppliers.create({
                data: {
                    name: 'Công ty TNHH Thiết bị Y tế Việt Nam',
                    country: 'Vietnam',
                    website: 'https://medviet.com',
                    contact_info: {
                        contact_person: 'Nguyễn Văn A',
                        phone: '028-3456-7890',
                        email: 'info@medviet.com',
                        address: '123 Lê Lợi, Q1, TP.HCM'
                    }
                }
            }),
            prisma.suppliers.create({
                data: {
                    name: 'Công ty CP Công nghệ Y tế Quốc tế',
                    country: 'Vietnam',
                    website: 'https://intlmed.vn',
                    contact_info: {
                        contact_person: 'Trần Thị B',
                        phone: '024-3456-7891',
                        email: 'sales@intlmed.vn',
                        address: '456 Trần Hưng Đạo, Hà Nội'
                    }
                }
            })
        ]);

        // 9. Create Device Models
        console.log('🔧 Creating device models...');
        const deviceModels = await Promise.all([
            prisma.device_models.create({
                data: {
                    category_id: subCategories[0].id, // Lab equipment
                    name: 'Cobas 6000',
                    model_number: 'COBAS-6000',
                    manufacturer_id: manufacturers[0].id, // Roche
                    supplier_id: suppliers[0].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[1].id, // Imaging
                    name: 'Multix Select DR',
                    model_number: 'MULTIX-SELECT-DR',
                    manufacturer_id: manufacturers[1].id, // Siemens
                    supplier_id: suppliers[0].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[1].id, // Imaging
                    name: 'LOGIQ P9',
                    model_number: 'LOGIQ-P9',
                    manufacturer_id: manufacturers[2].id, // GE
                    supplier_id: suppliers[1].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[3].id, // Environment
                    name: 'AUO Display G070VW01',
                    model_number: 'G070VW01',
                    manufacturer_id: manufacturers[3].id, // AUO
                    supplier_id: suppliers[1].id
                }
            })
        ]);

        // 10. Create Devices
        console.log('🖥️ Creating devices...');
        const devices = await Promise.all([
            prisma.device.create({
                data: {
                    model_id: deviceModels[0].id,
                    organization_id: organization.id,
                    department_id: departments[0].id,
                    serial_number: 'RC6000-2024-001',
                    asset_tag: 'XN-001',
                    status: 'active',
                    purchase_date: new Date('2024-01-15'),
                    installation_date: new Date('2024-02-01'),
                    location: 'Phòng XN - Tầng 2'
                }
            }),
            prisma.device.create({
                data: {
                    model_id: deviceModels[1].id,
                    organization_id: organization.id,
                    department_id: departments[1].id,
                    serial_number: 'SI-DR-2024-003',
                    asset_tag: 'CDHA-001',
                    status: 'active',
                    purchase_date: new Date('2024-02-20'),
                    installation_date: new Date('2024-03-15'),
                    location: 'Phòng X-quang - Tầng 1'
                }
            }),
            prisma.device.create({
                data: {
                    model_id: deviceModels[3].id,
                    organization_id: organization.id,
                    department_id: departments[0].id,
                    serial_number: 'AUO-ENV-001',
                    asset_tag: 'ENV-001',
                    status: 'active',
                    purchase_date: new Date('2024-03-01'),
                    installation_date: new Date('2024-03-10'),
                    location: 'Phòng XN - Cảm biến môi trường'
                }
            })
        ]);

        // 11. Create Device Connectivity
        console.log('📡 Creating device connectivity...');
        await Promise.all([
            prisma.device_connectivity.create({
                data: {
                    device_id: devices[0].id,
                    mqtt_user: 'cobas_6000_001',
                    mqtt_pass: 'secure_password_123',
                    mqtt_topic: 'hospital/lab/cobas6000/001',
                    broker_host: 'broker.hivemq.com',
                    broker_port: 1883,
                    ssl_enabled: false,
                    heartbeat_interval: 300,
                    is_active: true
                }
            }),
            prisma.device_connectivity.create({
                data: {
                    device_id: devices[2].id, // AUO Display
                    mqtt_user: 'auo_display_001',
                    mqtt_pass: 'auo_secure_123',
                    mqtt_topic: 'iot/auo-display',
                    broker_host: 'broker.hivemq.com',
                    broker_port: 1883,
                    ssl_enabled: false,
                    heartbeat_interval: 180,
                    is_active: true
                }
            })
        ]);

        // 12. Create Warranty Information
        console.log('📋 Creating warranty information...');
        await Promise.all([
            prisma.warranty_info.create({
                data: {
                    device_id: devices[0].id,
                    warranty_start: new Date('2024-02-01'),
                    warranty_end: new Date('2027-02-01'),
                    provider: 'Roche Diagnostics Vietnam'
                }
            }),
            prisma.warranty_info.create({
                data: {
                    device_id: devices[1].id,
                    warranty_start: new Date('2024-03-15'),
                    warranty_end: new Date('2029-03-15'),
                    provider: 'Siemens Healthineers Vietnam'
                }
            })
        ]);

        // 13. Create Specifications (skip for now due to complex schema)
        console.log('📝 Skipping device specifications (complex schema)...');

        // 14. Create some sample IoT data tables (skip for now)
        console.log('🌡️ Skipping IoT data tables (will be populated by MQTT)...');

        console.log('✅ IoMT database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`- Organizations: 1`);
        console.log(`- Departments: ${departments.length}`);
        console.log(`- Users: ${users.length}`);
        console.log(`- Roles: ${roles.length}`);
        console.log(`- Permissions: ${permissions.length}`);
        console.log(`- Device Categories: ${categories.length + subCategories.length}`);
        console.log(`- Device Models: ${deviceModels.length}`);
        console.log(`- Devices: ${devices.length}`);
        console.log('\n🔑 Login credentials:');
        console.log('Username: admin | Password: admin123');
        console.log('Username: BSNHhai | Password: password123');
        console.log('Username: technician1 | Password: tech123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });