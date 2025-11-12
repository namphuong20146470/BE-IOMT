# 🚀 IoMT System Setup & Management Guide

## 📋 Tổng Quan

Hướng dẫn complete để setup và quản lý hệ thống IoMT từ đầu.

---

## 🎯 One-Click Setup (Recommended)

### **Setup Hệ Thống Mới**
```bash
# 1. Clone repository
git clone https://github.com/your-org/iomt-backend.git
cd iomt-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.security.example .env
# Edit .env với database URL và secrets

# 4. Run complete setup (ONE COMMAND!)
npm run setup
```

**Script này sẽ tự động:**
- ✅ Validate environment
- ✅ Setup database schema 
- ✅ Create roles & permissions
- ✅ Create default users
- ✅ Setup organizations & departments
- ✅ Create device categories & models
- ✅ Generate sample devices
- ✅ Run security validation
- ✅ Generate setup report

---

## 🔧 Available Scripts

### **🏗️ System Setup**
```bash
npm run setup              # Complete system setup từ đầu
npm run setup:reset        # Reset toàn bộ và setup lại (⚠️ XÓA DATA!)
npm run system:status      # Kiểm tra tình trạng hệ thống
npm run system:health      # Health check chi tiết
npm run security:audit     # Audit bảo mật Swagger UI
```

### **🗄️ Database Management**
```bash
npm run db:migrate         # Chạy database migrations
npm run db:generate        # Generate Prisma client
npm run db:studio          # Mở Prisma Studio GUI
npm run db:reset           # Reset database (⚠️ XÓA DATA!)
npm run db:deploy          # Deploy migrations (production)
```

### **🧪 Testing**
```bash
npm test                   # Chạy tất cả tests
npm run test:unit          # Chỉ unit tests
npm run test:integration   # Chỉ integration tests
npm run test:coverage      # Test coverage report
npm run test:watch         # Watch mode
```

### **🚀 Server Management**
```bash
npm run dev                # Development server với hot reload
npm start                  # Production server
```

---

## 📊 Setup Output Example

Khi chạy `npm run setup`, bạn sẽ thấy output như sau:

```bash
🚀 IoMT System Complete Setup Started...

📋 1. Validating Environment...
   ✅ All required environment variables present

🗄️ 2. Setting up Database...
   ✅ Database connection successful
   📊 Running database migrations...
   🔧 Generating Prisma client...
   ✅ Database setup completed

👥 3. Creating Roles & Permissions...
   🔑 Creating permissions...
   👑 Creating roles...
   ✅ Roles & Permissions created successfully

👤 4. Creating Default Users...
   ✅ Created user: superadmin (Super Administrator)
   ✅ Created user: admin (System Administrator)
   ✅ Created user: doctor1 (Dr. John Smith)
   ✅ Created user: nurse1 (Nurse Mary Johnson)
   ✅ Created user: tech1 (Technician Bob Wilson)
   ✅ Created user: apiuser (API Integration User)

🏥 5. Creating Organizations & Departments...
   ✅ Created department: Emergency Department
   ✅ Created department: Intensive Care Unit
   ✅ Created department: Cardiology Department
   ✅ Created department: Surgery Department
   ✅ Created department: Radiology Department
   ✅ Created department: Laboratory
   ✅ Organization & Departments created successfully

📱 6. Creating Device Categories & Models...
   ✅ Created category: Patient Monitoring with 3 models
   ✅ Created category: Diagnostic Equipment with 2 models
   ✅ Created category: Life Support with 2 models

🏥 7. Creating Sample Devices...
   ✅ Created devices for: Emergency Department
   ✅ Created devices for: Intensive Care Unit
   ✅ Created devices for: Cardiology Department
   ✅ Created devices for: Surgery Department
   ✅ Created devices for: Radiology Department
   ✅ Created devices for: Laboratory
   ✅ Created 18 sample devices

🔐 8. Running Security Validation...
   ✅ Security validation completed

🔍 9. System Health Check...
   ✅ Database connectivity: OK
   ✅ Users created: 6
   ✅ Roles created: 7
   ✅ Permissions created: 20
   ✅ Devices created: 18
   ✅ Organizations created: 1
   ✅ System health check passed

📊 10. Generating Setup Report...
   ✅ Setup report generated: ./logs/setup-report.json

🎉 IoMT System Setup Completed Successfully!

📋 SETUP SUMMARY:
==========================================
✅ Users created: 6
✅ Roles created: 7
✅ Organizations: 1
✅ Devices created: 18

🔑 DEFAULT LOGIN CREDENTIALS:
==========================================
SuperAdmin: superadmin / SuperAdmin@2024!
Admin:      admin / Admin@2024!
Doctor:     doctor1 / Doctor@2024!
Nurse:      nurse1 / Nurse@2024!
Technician: tech1 / Tech@2024!
API User:   apiuser / ApiUser@2024!

🚀 NEXT STEPS:
==========================================
1. Start server: npm run dev
2. Access Swagger: http://localhost:3030/secure-api-docs
3. Login with any of the credentials above
4. Test API endpoints

🔒 SECURITY REMINDER:
==========================================
⚠️  Change default passwords in production!
⚠️  Update JWT_SECRET in .env file!
⚠️  Configure proper SSL certificates!
⚠️  Review user permissions before go-live!
```

---

## 🔍 System Status Check

Chạy `npm run system:status` để kiểm tra tình trạng hệ thống:

```bash
🔍 IoMT System Status Check...

📋 Checking Database Connection...
   ✅ Database: Connected

📊 Checking Database Schema...
   ✅ Table users: Exists
   ✅ Table roles: Exists
   ✅ Table permissions: Exists
   ✅ Table devices: Exists
   ✅ Table organizations: Exists
   ✅ Table departments: Exists

📈 Checking Data Integrity...
   👥 Users: 6
   👑 Roles: 7
   🔑 Permissions: 20
   🏥 Organizations: 1
   🏢 Departments: 6
   📱 Devices: 18

👤 Checking Admin Users...
   ✅ Admin user: superadmin (active: true)
   ✅ Admin user: admin (active: true)

⚙️ Checking Environment Configuration...
   ✅ JWT_SECRET: Configured
   ✅ SESSION_SECRET: Configured
   ✅ DATABASE_URL: Configured
   ✅ PORT: Configured

📁 Checking File System...
   ✅ ./logs: Exists
   ✅ ./docs: Exists
   ✅ ./tests: Exists
   ✅ ./scripts: Exists
   ✅ ./prisma/schema.prisma: Exists

📊 Overall System Status...
   🎉 System Status: HEALTHY

🚀 System is ready for use!
   - Start server: npm run dev
   - Access Swagger: http://localhost:3030/secure-api-docs
```

---

## 🔄 Reset System (Clean Setup)

Nếu cần reset toàn bộ hệ thống:

```bash
npm run setup:reset
```

**⚠️ WARNING: Script này sẽ:**
- ❌ XÓA TOÀN BỘ dữ liệu database
- ✅ Tạo backup trước khi xóa
- ✅ Setup lại từ đầu với dữ liệu mới

**Confirmation Required:**
```bash
⚠️  WARNING: This will DELETE ALL DATA in the database!
⚠️  This action is IRREVERSIBLE!

🔍 Current Database: postgresql://***@localhost:5433/dev_iomt

❓ Are you sure you want to RESET the entire system? (type "yes" to confirm): yes

❓ This will DELETE ALL DATA. Are you absolutely sure? (type "yes" to confirm): yes

🚀 Starting system reset...
```

---

## 🗄️ Database Schema Overview

Sau khi setup, database sẽ có các tables chính:

### **👥 User Management**
- `users` - User accounts
- `roles` - User roles (super_admin, admin, doctor, nurse, etc.)
- `permissions` - System permissions
- `user_roles` - User-role assignments
- `role_permissions` - Role-permission assignments  
- `user_permissions` - Individual user permission overrides
- `user_sessions` - User login sessions

### **🏥 Organization Structure**
- `organizations` - Hospital/clinic organizations
- `departments` - Medical departments (ICU, Emergency, etc.)

### **📱 Device Management**
- `device_categories` - Device categories (Patient Monitoring, etc.)
- `device_models` - Device models với JSONB specifications
- `devices` - Individual devices với asset tags

---

## 🔐 Security Features

### **Authentication & Authorization**
- JWT-based authentication với refresh tokens
- Role-based access control (RBAC)
- Individual permission overrides
- Session management với HttpOnly cookies

### **API Security**
- Rate limiting (300 req/min per user)
- Input validation với Joi schemas  
- SQL injection prevention với Prisma ORM
- CORS protection với whitelist domains

### **Swagger UI Security**
- Authentication required để access documentation
- Role-based access (super_admin, admin, developer, api_user)
- Rate limiting cho documentation access
- Environment-based protection

---

## 📱 Default User Accounts

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `superadmin` | `SuperAdmin@2024!` | super_admin | Full system access |
| `admin` | `Admin@2024!` | admin | Management access |
| `doctor1` | `Doctor@2024!` | doctor | Medical device & patient data |
| `nurse1` | `Nurse@2024!` | nurse | Patient monitoring |
| `tech1` | `Tech@2024!` | technician | Device maintenance |
| `apiuser` | `ApiUser@2024!` | api_user | System integration |

**🔒 Security Note:** Change all default passwords trước khi deploy production!

---

## 🚀 Next Steps After Setup

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Access Swagger UI**
   - URL: `http://localhost:3030/secure-api-docs`
   - Login với any user account ở trên
   - Test API endpoints

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Monitor System**
   ```bash
   npm run system:status  # Check health
   npm run security:audit  # Security validation
   ```

5. **Production Deployment**
   - Update `.env` với production values
   - Change default passwords
   - Configure SSL certificates
   - Setup proper monitoring

---

## 📞 Support

**Nếu gặp vấn đề:**
- 📋 Check `./logs/setup-report.json` để xem chi tiết
- 🔍 Run `npm run system:status` để diagnose
- 🔄 Try `npm run setup:reset` nếu cần clean setup
- 📧 Contact team qua GitHub Issues

---

*Last updated: November 2024*  
*System ready for production deployment! 🚀*