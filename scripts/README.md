# Scripts Directory 🛠️

Essential utility scripts for managing the IoMT backend system.

## 📋 Available Scripts

### 🚀 Setup & Installation
- **`setup-simple.js`** - Main system setup (users, roles, permissions, organizations)
- **`reset-system.js`** - Complete system reset utility

### 📊 System Monitoring
- **`check-system-status.js`** - Health check and system validation

### 🔍 Database Utilities
- **`database/verify-schema.js`** - Schema validation and integrity check

## 🎯 Quick Commands

```bash
# Complete system setup
npm run setup

# Check system health
npm run system:status

# Reset system (DANGER!)
npm run setup:reset
```

## 📖 Script Details

### setup-simple.js
Creates complete IoMT system:
- ✅ Uses existing permissions (100+ permissions found)
- ✅ Creates 5 roles: Super Admin, Organization Admin, Department Manager, Bác sĩ, Y tá
- ✅ Creates 5 default users with strong passwords
- ✅ Sets up organization and departments
- ✅ Generates detailed setup report

**Default Credentials:**
```
superadmin     / SuperAdmin@2024!    (Super Admin)
orgadmin       / OrgAdmin@2024!      (Organization Admin)  
deptmanager    / Manager@2024!       (Department Manager)
doctor1        / Doctor@2024!        (Bác sĩ)
nurse1         / Nurse@2024!         (Y tá)
```

### check-system-status.js
Monitors system health:
- Database connectivity
- Schema validation  
- User/role integrity
- Permission assignments
- Organization structure

## 🔒 Security Notes

⚠️ **IMPORTANT:**
- Change default passwords before production!
- Update `JWT_SECRET` in `.env`
- Configure SSL certificates
- Review and restrict permissions as needed

## 🏗️ Project Structure

```
scripts/
├── README.md                    # This file
├── setup-simple.js            # ⭐ Main setup script
├── check-system-status.js     # System health monitor
├── reset-system.js           # System reset utility
├── CLEANUP_PLAN.md          # Cleanup documentation
└── database/
    └── verify-schema.js     # Schema validation
```

## 📚 Package.json Scripts

All scripts are accessible via npm commands:

```json
{
  "setup": "node scripts/setup-simple.js",
  "setup:reset": "node scripts/reset-system.js && node scripts/setup-simple.js",
  "system:status": "node scripts/check-system-status.js",
  "system:health": "node scripts/check-system-status.js"
}
```

## 🌟 Next Steps

After running setup:

1. **Start Server:** `npm run dev`
2. **Access Swagger UI:** `http://localhost:3030/secure-api-docs`
3. **Login:** Use credentials above
4. **Change Passwords:** Update default passwords
5. **Configure Environment:** Review `.env` settings