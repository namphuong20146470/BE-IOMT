# 🔐 Security Documentation

## 📋 Tổng Quan

Thư mục này chứa toàn bộ tài liệu bảo mật cho hệ thống IoMT Backend.

## 📁 Nội Dung

### 📚 Swagger UI Security
- [`SWAGGER_SECURITY_GUIDE.md`](SWAGGER_SECURITY_GUIDE.md) - Hướng dẫn bảo mật Swagger UI
- [`SWAGGER_AUDIT_REPORT.md`](SWAGGER_AUDIT_REPORT.md) - Báo cáo audit Swagger
- [`SWAGGER_UPDATE_SUMMARY.md`](SWAGGER_UPDATE_SUMMARY.md) - Tóm tắt cập nhật bảo mật

### 🏥 Healthcare Security  
- [`HIERARCHY_ROOMS_SECURITY.md`](HIERARCHY_ROOMS_SECURITY.md) - Bảo mật phân cấp phòng ban

## 🛡️ Biện Pháp Bảo Mật Chính

### 1. **Authentication & Authorization**
- JWT-based authentication với refresh tokens
- Role-based access control (RBAC)
- Individual permission overrides
- Session management với HttpOnly cookies

### 2. **API Security**  
- Rate limiting (300 req/min per user)
- Input validation với Joi schemas
- SQL injection prevention với Prisma ORM
- CORS protection với whitelist domains

### 3. **Data Protection**
- HTTPS enforcement trên production
- Password hashing với bcrypt + salt
- Sensitive data encryption at rest
- Audit logging cho tất cả operations

### 4. **Infrastructure Security**
- SSL/TLS certificates management
- Environment-based configuration  
- IP whitelisting cho sensitive endpoints
- Database connection encryption

## 🚨 Security Protocols

### **Incident Response**
1. **Detection**: Automated monitoring & alerting
2. **Assessment**: Security team review within 15 minutes  
3. **Containment**: Immediate isolation of affected systems
4. **Recovery**: Rollback và system restoration
5. **Lessons Learned**: Post-incident analysis và improvements

### **Access Control Matrix**

| Role | Swagger UI | Admin Panel | Database | Production |
|------|------------|-------------|----------|------------|
| **Developer** | ✅ (Dev only) | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ❌ | ❌ |
| **Super Admin** | ✅ | ✅ | ✅ | ✅ |
| **API User** | ✅ (Limited) | ❌ | ❌ | ❌ |

### **Security Checklist**

#### Development
- [ ] Environment variables không chứa secrets
- [ ] Debug mode disabled trên staging/production
- [ ] All inputs được validate
- [ ] Error messages không expose sensitive info
- [ ] Code review cho tất cả security-related changes

#### Deployment  
- [ ] HTTPS enabled và configured correctly
- [ ] Database connections encrypted
- [ ] Secrets management qua environment variables
- [ ] Rate limiting enabled
- [ ] Audit logging activated
- [ ] Backup procedures tested

#### Monitoring
- [ ] Failed login attempt monitoring
- [ ] Unusual API usage pattern detection  
- [ ] Database query performance monitoring
- [ ] SSL certificate expiration alerts
- [ ] System resource monitoring

## 🔍 Security Tools & Scripts

### **Validation Scripts**
```bash
# Swagger security audit
node scripts/validate-swagger-security.js

# Database security check
node scripts/validate-database-security.js

# SSL certificate validation
node scripts/validate-ssl-config.js
```

### **Monitoring Commands**
```bash
# Check failed login attempts  
grep "AUTH_FAILED" logs/app.log | tail -100

# Monitor API abuse
grep "RATE_LIMITED" logs/app.log | tail -50

# Check database connections
grep "DATABASE" logs/app.log | grep "ERROR"
```

## 📊 Security Metrics

### **Key Performance Indicators**
- Authentication success rate: **>99.5%**
- API response time: **<200ms average**  
- Failed login detection: **<1 second**
- Security incident response: **<15 minutes**

### **Compliance Standards**
- **HIPAA**: Healthcare data protection compliance
- **GDPR**: EU data privacy compliance  
- **ISO 27001**: Information security management
- **NIST**: Cybersecurity framework adherence

## 🚑 Emergency Contacts

### **Security Team**
- **Primary**: `security@iomt.com` (24/7 monitoring)
- **Backup**: `admin@iomt.com`  
- **Phone**: `+84-xxx-xxx-xxx` (Critical incidents only)

### **Response Times**
- **Critical**: 15 minutes (system breach, data leak)
- **High**: 1 hour (authentication bypass, privilege escalation)  
- **Medium**: 4 hours (configuration issues, minor vulnerabilities)
- **Low**: 24 hours (documentation updates, non-critical patches)

## 📋 Security Training

### **Required Training**
- HIPAA compliance for healthcare data
- Secure coding practices
- Incident response procedures  
- Password và access management

### **Resources**
- Internal security wiki: `/wiki/security`
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Guidelines: https://www.nist.gov/cybersecurity

---

## 🔗 Related Documentation

- [Authentication System](../guides/FRONTEND_AUTHENTICATION_GUIDE.md)
- [API Documentation](../api/README.md)
- [Database Security](../../config/db.js)
- [SSL Configuration](../../config/ssl.js)

---

*Classification: **CONFIDENTIAL***  
*Last updated: November 2024*  
*Review cycle: Monthly*