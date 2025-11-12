# 🛠️ Scripts Directory

## 📋 Tổng Quan

Thư mục này chứa các automation scripts để quản lý, deploy và maintain hệ thống IoMT.

## 📁 Cấu Trúc

```
scripts/
├── database/           # Database-related scripts
│   ├── seed-*.js      # Database seeding scripts
│   ├── migrations/    # Custom migration scripts
│   └── backup/        # Database backup scripts
├── deployment/        # Deployment automation
│   ├── docker*        # Docker configuration files
│   ├── deploy.sh      # Production deployment script
│   └── rollback.sh    # Rollback script
├── security/          # Security validation scripts
│   └── validate-swagger-security.js
└── maintenance/       # System maintenance scripts
    ├── cleanup.js     # Log cleanup và optimization
    ├── health-check.js # System health monitoring
    └── backup.js      # Automated backup script
```

## 🗄️ Database Scripts

### **Seeding Scripts**
```bash
# Seed all data
node scripts/database/seed-iomt.js

# Seed specific entities
node scripts/database/seed-devices.js
node scripts/database/seed-user-permissions-test.js

# Run device seed with custom data
node scripts/database/run-device-seed.js
```

### **Migration Scripts**
```bash
# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Reset database (careful!)
npx prisma migrate reset
```

### **Backup Scripts**
```bash
# Create database backup
node scripts/database/backup.js

# Restore from backup  
node scripts/database/restore.js --file=backup-2024-11-12.sql
```

## 🚀 Deployment Scripts

### **Docker Deployment**
```bash
# Build và start containers
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop containers
docker-compose down
```

### **Production Deployment**
```bash
# Full deployment pipeline
./scripts/deployment/deploy.sh production

# Rollback to previous version
./scripts/deployment/rollback.sh

# Health check after deployment
./scripts/maintenance/health-check.js
```

## 🔐 Security Scripts

### **Security Validation**
```bash
# Comprehensive security audit
node scripts/validate-swagger-security.js

# SSL certificate check
node scripts/security/validate-ssl.js

# Dependency vulnerability scan
npm audit --audit-level moderate
```

### **Access Control Validation**
```bash
# Test authentication flow
node scripts/security/test-auth-flow.js

# Validate user permissions
node scripts/security/validate-permissions.js

# Check rate limiting
node scripts/security/test-rate-limits.js
```

## 🧹 Maintenance Scripts

### **System Cleanup**
```bash
# Clean old logs (older than 30 days)
node scripts/maintenance/cleanup.js --logs --days=30

# Clean temp files
node scripts/maintenance/cleanup.js --temp

# Database optimization
node scripts/maintenance/optimize-db.js
```

### **Health Monitoring**
```bash
# System health check
node scripts/maintenance/health-check.js

# Performance monitoring
node scripts/maintenance/performance-check.js

# Database connection test
node scripts/maintenance/test-db-connection.js
```

## 📊 Utility Scripts

### **Development Helpers**
```bash
# Generate test data
node scripts/utils/generate-test-data.js --count=100

# Validate API endpoints
node scripts/utils/validate-api-endpoints.js

# Check code quality
node scripts/utils/quality-check.js
```

### **Data Management**
```bash
# Export data to CSV/JSON
node scripts/utils/export-data.js --format=csv --table=devices

# Import data from file
node scripts/utils/import-data.js --file=devices.csv --table=devices

# Data validation
node scripts/utils/validate-data-integrity.js
```

## 🎯 Automation Examples

### **CI/CD Pipeline Script**
```bash
#!/bin/bash
# scripts/deployment/ci-cd-pipeline.sh

set -e  # Exit on error

echo "🚀 Starting CI/CD Pipeline..."

# 1. Code Quality Checks
echo "📋 Running code quality checks..."
npm run lint
npm run format:check

# 2. Security Scans
echo "🔐 Running security scans..."
npm audit --audit-level moderate
node scripts/validate-swagger-security.js

# 3. Tests
echo "🧪 Running tests..."
npm run test:coverage

# 4. Build
echo "🔨 Building application..."
npm run build

# 5. Database Migration (if needed)
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# 6. Deploy
echo "🚀 Deploying to production..."
docker-compose up -d --build

# 7. Health Check
echo "🔍 Running post-deployment health checks..."
sleep 30  # Wait for services to start
node scripts/maintenance/health-check.js

echo "✅ CI/CD Pipeline completed successfully!"
```

### **Automated Backup Script**
```javascript
// scripts/database/automated-backup.js
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = './backups';
const MAX_BACKUPS = 7; // Keep 7 days of backups

async function createBackup() {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);
    
    console.log(`📦 Creating backup: ${backupFile}`);
    
    // Create backup directory if not exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Create database backup
    execSync(`pg_dump ${process.env.DATABASE_URL} > ${backupFile}`);
    
    // Cleanup old backups
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();
        
    if (files.length > MAX_BACKUPS) {
        const filesToDelete = files.slice(MAX_BACKUPS);
        filesToDelete.forEach(file => {
            fs.unlinkSync(path.join(BACKUP_DIR, file));
            console.log(`🗑️ Deleted old backup: ${file}`);
        });
    }
    
    console.log(`✅ Backup completed: ${backupFile}`);
}

createBackup().catch(console.error);
```

## 🕒 Scheduled Jobs

### **Cron Jobs Setup**
```bash
# Add to crontab (crontab -e)

# Daily backup at 2 AM
0 2 * * * cd /path/to/iomt-backend && node scripts/database/automated-backup.js

# Weekly cleanup at Sunday 3 AM
0 3 * * 0 cd /path/to/iomt-backend && node scripts/maintenance/cleanup.js

# Hourly health check
0 * * * * cd /path/to/iomt-backend && node scripts/maintenance/health-check.js

# Daily security scan at 4 AM
0 4 * * * cd /path/to/iomt-backend && node scripts/validate-swagger-security.js
```

### **PM2 Ecosystem Jobs**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'iomt-backend',
      script: 'index.js',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'daily-backup',
      script: 'scripts/database/automated-backup.js',
      cron_restart: '0 2 * * *',
      autorestart: false
    },
    {
      name: 'health-monitor', 
      script: 'scripts/maintenance/health-check.js',
      cron_restart: '0 */6 * * *',
      autorestart: false
    }
  ]
};
```

## 📋 Script Usage Guidelines

### **Best Practices**
1. **Error Handling**: Always include proper error handling
2. **Logging**: Use structured logging với timestamps
3. **Validation**: Validate inputs và environment
4. **Backup**: Always backup before destructive operations
5. **Testing**: Test scripts trong staging environment first

### **Security Considerations**
1. **Credentials**: Never hardcode passwords hoặc secrets
2. **Permissions**: Run với minimum required permissions
3. **Validation**: Validate tất cả user inputs
4. **Audit**: Log tất cả script executions
5. **Access**: Restrict script access to authorized personnel

### **Performance Guidelines**
1. **Timeouts**: Set reasonable timeouts for operations
2. **Resources**: Monitor memory và CPU usage
3. **Parallelization**: Use parallel processing where appropriate
4. **Optimization**: Profile và optimize long-running scripts

---

## 📞 Script Support

### **Documentation**
- **Script API**: `/docs/scripts-api.md`
- **Troubleshooting**: `/docs/script-troubleshooting.md`
- **Best Practices**: `/wiki/script-guidelines`

### **Team Contacts**
- **DevOps**: `devops@iomt.com`
- **Database Admin**: `dba@iomt.com`
- **Security**: `security@iomt.com`

---

*Last updated: November 2024*  
*Maintained by: DevOps Team*