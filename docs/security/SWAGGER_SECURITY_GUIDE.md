# 🔐 Swagger UI Security Implementation Guide

## 📋 Tổng Quan

Đã triển khai **7 lớp bảo mật** cho Swagger UI nhằm bảo vệ tài liệu API khỏi truy cập trái phép và đảm bảo tuân thủ các tiêu chuẩn bảo mật y tế.

---

## 🛡️ Các Biện Pháp Bảo Mật Đã Triển Khai

### 1. **🚫 Environment Protection**
```javascript
// Chặn truy cập Swagger trên production
if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SWAGGER_PRODUCTION) {
    return res.status(404).json({
        message: 'API documentation not available'
    });
}
```

**Cách hoạt động:**
- Swagger UI tự động bị disable trên production
- Chỉ enable bằng cách set `ALLOW_SWAGGER_PRODUCTION=true` (không khuyến nghị)
- Bảo vệ khỏi accidental exposure

### 2. **🔐 Authentication Required**
```javascript  
// Yêu cầu đăng nhập trước khi truy cập Swagger
export const requireAuthentication = authMiddleware;
```

**Yêu cầu:**
- Phải đăng nhập qua `/auth/login` trước
- JWT token hợp lệ trong header Authorization
- Session còn hiệu lực (nếu dùng cookie)

### 3. **🔑 Permission-Based Access**
```javascript
// Chỉ những role được phép mới truy cập được
const allowedRoles = ['super_admin', 'admin', 'developer', 'api_user'];
const hasAccess = userRoles.some(role => allowedRoles.includes(role));
```

**Phân quyền:**
- **super_admin**: Full access, tất cả endpoints
- **admin**: Management operations  
- **developer**: Technical endpoints cho development
- **api_user**: Basic API access cho integration

### 4. **⏰ Rate Limiting**
```javascript
// Giới hạn 100 requests per 15 phút cho Swagger UI
export const swaggerRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});
```

**Bảo vệ chống:**
- API abuse và spam requests
- DoS attacks trên documentation  
- Excessive automated scanning

### 5. **🕐 Business Hours Restriction** (Tùy chọn)
```javascript
// Chỉ cho phép truy cập trong giờ hành chính
const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 8 && hour < 18);
```

**Kích hoạt:** Set `SWAGGER_BUSINESS_HOURS_ONLY=true`

### 6. **📊 Audit Logging**
```javascript
// Ghi log mọi lần truy cập Swagger UI
console.log('📚 Swagger UI Access:', {
    user: user?.username,
    ip: req.ip,
    timestamp: new Date().toISOString()
});
```

**Theo dõi:**
- Ai đã truy cập tài liệu
- Từ IP nào và khi nào
- User agent và session info

### 7. **🔒 IP Whitelist** (Tùy chọn)
```javascript
// Chỉ cho phép IP được đăng ký trước
const allowedIPs = process.env.SWAGGER_ALLOWED_IPS?.split(',') || [];
```

**Cấu hình:** `SWAGGER_ALLOWED_IPS=192.168.1.100,192.168.1.101`

---

## 🚀 Cách Sử Dụng

### **1. Setup Environment**
```bash
# Copy example configuration
cp .env.security.example .env.local

# Edit với values phù hợp
nano .env.local
```

### **2. Start Server**
```bash
npm run dev
```

### **3. Access Secured Swagger**
```
🔒 Secured URL: https://localhost:3005/secure-api-docs
🚫 Old URL: https://localhost:3005/api-docs (blocked)
```

### **4. Authentication Flow**
1. **Login first:**
   ```bash
   POST /auth/login
   {
     "username": "admin",
     "password": "your-password"
   }
   ```

2. **Get JWT token** từ response

3. **Authorize in Swagger UI:**
   - Click 🔓 "Authorize" button
   - Enter: `Bearer <your-jwt-token>`
   - Click "Authorize"

4. **Test endpoints** normally

---

## ⚙️ Configuration Options

### **Environment Variables**
```bash
# Security Controls
NODE_ENV=development                    # production sẽ disable Swagger
ALLOW_SWAGGER_PRODUCTION=false          # NEVER true in production  
SWAGGER_BUSINESS_HOURS_ONLY=false       # true = chỉ giờ hành chính
SWAGGER_ALLOWED_IPS=                    # Comma-separated IP list

# Rate Limiting  
SWAGGER_RATE_LIMIT_WINDOW=900000        # 15 minutes
SWAGGER_RATE_LIMIT_MAX=100              # Max requests per window

# Authentication
JWT_SECRET=your-secret-key              # Strong secret required
JWT_EXPIRES_IN=24h                      # Token expiration
```

### **Role Requirements**
```yaml
# Add required roles to user account:
roles:
  - name: "api_user"        # Basic API access
  - name: "developer"       # Technical endpoints  
  - name: "admin"           # Management operations
  - name: "super_admin"     # Full system access
```

---

## 🔍 Security Validation

### **Run Security Audit**
```bash
node scripts/validate-swagger-security.js
```

**Kiểm tra:**
- ✅ Environment configuration
- ✅ Security files present  
- ✅ Dependencies installed
- ✅ Route configuration
- ✅ SSL certificates
- ✅ CORS settings

### **Expected Output:**
```
🎉 EXCELLENT! All security checks passed.

✅ Swagger UI is properly secured with:
   - Authentication middleware
   - Rate limiting  
   - Environment checks
   - Secure route path
   - No token persistence
   - Custom security styling

🔒 Your API documentation is production-ready!
```

---

## 🚨 Security Alerts & Monitoring

### **What Gets Logged:**
- ✅ Every Swagger UI access (user, IP, timestamp)
- ✅ Failed authentication attempts  
- ✅ Rate limit violations
- ✅ IP blocking events
- ✅ Permission denials

### **Alert Channels:**
```yaml
Email: security@iomt.com
Slack: #security-alerts  
Phone: +84-xxx-xxx-xxx (24/7 hotline)
```

### **Log Format:**
```json
{
  "event": "swagger_access",
  "timestamp": "2024-11-12T10:30:00Z",
  "user": "john.doe",
  "user_id": "uuid-123",
  "ip": "192.168.1.100", 
  "user_agent": "Chrome/119.0",
  "status": "success"
}
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: "Authentication Required"**
```
❌ Error: Authentication required to access API documentation
```

**Solution:**
1. Login via `/auth/login` first
2. Copy JWT token from response  
3. Use "Authorize" button in Swagger UI
4. Enter `Bearer <token>`

### **Issue 2: "Insufficient Permissions"**
```
❌ Error: Insufficient permissions to access API documentation  
```

**Solution:**
1. Contact admin để add role `api_user` hoặc `developer`
2. Re-login để refresh permissions
3. Check user roles trong `/auth/permissions`

### **Issue 3: "API Documentation Not Available"**
```
❌ Error: API documentation not available
```

**Solution:**
1. Check `NODE_ENV` - không nên là `production`
2. Nếu cần access trên production: set `ALLOW_SWAGGER_PRODUCTION=true`
3. Restart server sau khi thay đổi env

### **Issue 4: "Too Many Requests"**
```
❌ Error: Too many requests to API documentation
```

**Solution:**
1. Đợi 15 phút để reset rate limit
2. Hoặc contact admin để tăng limit  
3. Check nếu có automated tools đang scan

### **Issue 5: "Access Denied from IP"**
```
❌ Error: Access denied from this IP address
```

**Solution:**
1. Contact admin để add IP vào whitelist
2. Connect từ approved network
3. Use VPN nếu được phép

---

## 📋 Production Deployment Checklist

### **Before Deployment:**
- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOW_SWAGGER_PRODUCTION=false`  
- [ ] Configure `SWAGGER_ALLOWED_IPS` với office IPs
- [ ] Set `SWAGGER_BUSINESS_HOURS_ONLY=true`
- [ ] Use strong `JWT_SECRET` (32+ chars)
- [ ] Enable HTTPS (`USE_HTTPS=true`)
- [ ] Configure email alerts
- [ ] Test authentication flow
- [ ] Run security audit script
- [ ] Review audit logs setup

### **After Deployment:**
- [ ] Verify Swagger UI is NOT accessible publicly
- [ ] Test authentication requirements
- [ ] Confirm rate limiting works
- [ ] Check audit logs are being written
- [ ] Verify email alerts work
- [ ] Test IP restrictions (if enabled)
- [ ] Document access procedures for team

---

## 🔗 Related Documentation

- [Authentication System](./AUTH_SYSTEM.md)
- [Rate Limiting Guide](./RATE_LIMITING.md) 
- [Audit Logging](./AUDIT_LOGS_API.md)
- [Permission System](./PERMISSION_API_DOCS.md)
- [SSL Configuration](./config/ssl.js)

---

## 📞 Security Contact

**For security issues:**
- 🚨 **Emergency:** security@iomt.com
- 📞 **Hotline:** +84-xxx-xxx-xxx (24/7)
- 💬 **Slack:** #security-alerts
- 📧 **General:** support@iomt.com

**Response Times:**
- Critical security issues: **15 minutes**
- Access requests: **2 hours** (business hours)
- Configuration changes: **4 hours** (business hours)

---

*Last updated: November 2024*  
*Security Level: **RESTRICTED ACCESS***