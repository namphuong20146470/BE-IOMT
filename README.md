# 🏥 IoMT Backend System

## 📋 Tổng Quan

Hệ thống backend cho **Internet of Medical Things (IoMT)** - quản lý thiết bị y tế, theo dõi bệnh nhân và tích hợp các hệ thống bệnh viện.

## 🚀 Tính Năng Chính

- **🔐 Authentication & Authorization**: JWT + Role-based access control
- **🏥 Device Management**: Quản lý thiết bị y tế với real-time monitoring
- **📊 Real-time Data**: Socket.IO + MQTT integration  
- **👥 User Management**: Phân quyền chi tiết theo cá nhân và vai trò
- **🏢 Organization Structure**: Quản lý tổ chức, phòng ban phân cấp
- **📋 Audit Logging**: Theo dõi tất cả hoạt động hệ thống
- **🔒 Healthcare Security**: Tuân thủ HIPAA, GDPR compliance

## 🏗️ Cấu Trúc Project

```
iomt-backend/
├── 📁 docs/                    # 📚 Documentation
│   ├── api/                   # API documentation  
│   ├── security/              # Security guidelines
│   └── guides/                # Development guides
├── 📁 features/               # 🎯 Feature modules
│   ├── auth/                  # Authentication system
│   ├── devices/               # Device management
│   ├── users/                 # User management  
│   └── organizations/         # Organization structure
├── 📁 tests/                  # 🧪 Testing suite
│   ├── unit/                  # Unit tests
│   └── integration/           # API integration tests
├── 📁 scripts/                # 🛠️ Automation scripts
│   ├── database/              # DB seeding, migration
│   ├── deployment/            # Docker, deployment
│   └── security/              # Security validation
├── 📁 middleware/             # Express middleware
├── 📁 services/               # Business logic services
├── 📁 utils/                  # Helper utilities
└── 📁 config/                 # Configuration files
```

## ⚡ Quick Start
# Run this command in PowerShell as Administrator
<!-- 	Mở PORT -->
### **1. Prerequisites**
```bash
# Required software
Node.js 18+
PostgreSQL 14+
Docker & Docker Compose (optional)
```

### **2. Installation**
```bash
# Clone repository
git clone https://github.com/your-org/iomt-backend.git
cd iomt-backend

# Install dependencies
npm install

# Setup environment
cp .env.security.example .env
# Edit .env với database URL và secrets

# Database setup
npx prisma migrate dev
npx prisma generate
npm run seed
```

### **3. Development Server**
```bash
# Start development server
npm run dev

# Server will run on http://localhost:3030
```

### **4. Production Deployment**
```bash
# Docker deployment
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

## 🔐 Security & Access

### **API Documentation**
- **🔒 Secured Swagger UI**: `https://localhost:3030/secure-api-docs`
- **Authentication required**: Login first via `/auth/login`
- **Required roles**: `super_admin`, `admin`, `developer`, `api_user`

### **Port Management**
```powershell
# Check port usage
netstat -ano | findstr :3030

# Free port if occupied  
Get-NetTCPConnection -LocalPort 3030 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Open firewall (Windows)
netsh advfirewall firewall add rule name="IoMT Backend 3030" dir=in action=allow protocol=TCP localport=3030
```

## 🐳 Docker Management

### **Container Operations**
```powershell
# Build và start containers
docker-compose build --no-cache
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Container management
docker ps                    # Running containers
docker ps -a                # All containers  
docker logs iot-server      # View container logs
docker stop iot-server      # Stop container
docker start iot-server     # Start container
docker restart iot-server   # Restart container
docker rm -f iot-server     # Remove container
```

### **Cleanup & Troubleshooting**
```powershell
# Complete cleanup
docker-compose down
docker rm -f be-dx-iot-server-1 2>$null
docker rmi be-dx-iot-server 2>$null

# Restart Docker service
Restart-Service docker
Start-Sleep -Seconds 10

# Export logs với timestamp
docker-compose logs -t > docker-logs-with-time.txt
docker-compose logs -f | Tee-Object -FilePath "live-logs.txt"
```

## 💾 Database Operations

### **Schema Management**
```bash
# Pull latest schema from database
npx prisma db pull

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database (careful!)
npx prisma migrate reset
```

### **Data Seeding**
```bash
# Seed all test data
npm run seed

# Seed specific entities
node scripts/database/seed-devices.js
node scripts/database/seed-user-permissions-test.js
```

## 🧪 Testing

### **Run Tests**
```bash
# All tests
npm test

# Specific test categories  
npm run test:unit           # Unit tests
npm run test:integration    # API integration tests
npm run test:coverage       # With coverage report

# Individual test files
npm test tests/unit/test-device-model-creation.js
```

### **Security Validation**
```bash
# Swagger security audit
node scripts/validate-swagger-security.js

# Dependency vulnerability scan
npm audit --audit-level moderate
```

## 📚 Documentation

### **Available Documentation**
- **[API Documentation](docs/api/README.md)**: Complete API reference
- **[Security Guide](docs/security/README.md)**: Security implementation và best practices
- **[Development Guides](docs/guides/README.md)**: Frontend integration và development workflow
- **[Testing Guide](tests/README.md)**: Testing strategies và examples

### **Quick Links**
- 🔒 **Swagger UI**: `https://localhost:3030/secure-api-docs` (authentication required)
- 📮 **Postman Collection**: Import `IoMT-Backend.postman_collection.json`
- 🐳 **Docker Config**: `docker-compose.yml`
- ⚙️ **Environment**: `.env.security.example`

## 🤝 Development Workflow

### **Branch Strategy**
```
main (production) 
├── develop (integration)
├── feature/new-feature
├── hotfix/critical-fix
└── release/v2.1.0
```

### **Pull Request Process**
1. Create branch từ `develop`
2. Implement feature với tests  
3. Update documentation
4. Run security checks: `npm run security:check`
5. Create PR với detailed description
6. Code review từ 2+ members
7. Merge sau khi pass all checks

## 📞 Support & Contact

### **Team Contacts**
- **🚨 Security Issues**: `security@iomt.com` (24/7)
- **🛠️ Technical Support**: `tech-support@iomt.com`
- **📋 API Questions**: Slack `#api-support`
- **🐛 Bug Reports**: GitHub Issues

### **Emergency Procedures**
- **Critical Security**: Email `security@iomt.com` + Slack `#security-alerts`  
- **System Down**: Phone `+84-xxx-xxx-xxx` (24/7 hotline)
- **Data Issues**: Contact database admin immediately

## 📊 System Requirements

### **Development Environment**
- **Node.js**: 18.0.0+
- **PostgreSQL**: 14.0+  
- **RAM**: 8GB minimum
- **Storage**: 10GB available space

### **Production Environment**  
- **Node.js**: 18 LTS
- **PostgreSQL**: 14+ với SSL
- **RAM**: 16GB recommended
- **CPU**: 4+ cores
- **Storage**: 100GB+ với backup strategy

## 🔐 Security Notice

**⚠️ QUAN TRỌNG**: Hệ thống này xử lý dữ liệu y tế nhạy cảm. 

- Tuân thủ nghiêm ngặt security guidelines
- Không share credentials hoặc API keys
- Report ngay lập tức nếu phát hiện security issues
- Tất cả truy cập được monitor và audit

---

## 📄 License

Proprietary License - © 2024 IoMT Healthcare Solutions  
All rights reserved.

---

*Last updated: November 2024*  
*Version: 2.0.0*