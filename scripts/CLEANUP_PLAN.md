# Scripts Cleanup Plan

## 📋 Current Scripts Analysis

### ✅ Keep (Essential)
- `setup-simple.js` - Main system setup script (working)
- `check-system-status.js` - System health monitoring
- `reset-system.js` - System reset utility

### 🗑️ Remove (Redundant/Outdated)
- `setup-complete-system.js` - Replaced by setup-simple.js
- `bootstrap_pg.js` - Old bootstrap script
- `quick-db-test.js` - Temporary testing file
- `validate-swagger-security.js` - Moved to middleware

### 📁 database/ folder - Cleanup needed
#### Keep:
- `verify-schema.js` - Schema validation utility

#### Remove:
- `check-users.js` - Redundant (functionality in setup-simple.js)
- `create-super-admin.js` + `create-super-admin-simple.js` - Replaced by setup-simple.js
- `enhanced-user-filtering.js` - Test script
- `fix-device-permissions.js` - One-time fix script
- `generate-device-data.js` + `run-device-seed.js` + `seed-devices.js` - Use Prisma seed instead
- `seed-user-permissions-test.js` - Test script
- `test-superadmin-auth.js` - Test script

### 📁 deployment/ folder - Move to root
- Move docker files to project root where they belong

## 🎯 Final Structure
```
scripts/
├── README.md
├── setup-simple.js          # Main setup
├── check-system-status.js   # Health check  
├── reset-system.js          # System reset
└── database/
    └── verify-schema.js     # Schema validation
```