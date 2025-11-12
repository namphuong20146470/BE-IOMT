# 📚 API Documentation

## 📋 Tổng Quan

Thư mục này chứa toàn bộ tài liệu API cho hệ thống IoMT Backend.

## 📁 Cấu Trúc

### 🔐 Authentication & Authorization
- [`USER_ACCESS_ANALYSIS.md`](USER_ACCESS_ANALYSIS.md) - Phân tích hệ thống phân quyền
- [`USER_PERMISSIONS_API.md`](USER_PERMISSIONS_API.md) - API quản lý quyền cá nhân

### 📊 Audit & Logging  
- [`AUDIT_LOGS_API.md`](AUDIT_LOGS_API.md) - API audit logs và theo dõi hoạt động

### 🏥 Device Management
- [`DEVICE_API_DOCS.md`](DEVICE_API_DOCS.md) - API quản lý thiết bị
- [`DEVICE_MODEL_CREATION_GUIDE.md`](DEVICE_MODEL_CREATION_GUIDE.md) - Hướng dẫn tạo device model
- [`DEVICE_MODEL_SIMPLE_API.md`](DEVICE_MODEL_SIMPLE_API.md) - API device model đơn giản

### 📡 IoT & MQTT
- [`MQTT_API_DOCS.md`](MQTT_API_DOCS.md) - API kết nối MQTT  
- [`DYNAMIC_MQTT_API_SAMPLES.md`](DYNAMIC_MQTT_API_SAMPLES.md) - Mẫu MQTT động

### 🔧 Technical Specifications
- [`SPECIFICATIONS_API_DOCS.md`](SPECIFICATIONS_API_DOCS.md) - API quản lý specifications
- [`PATCH_SPECIFICATION_API.md`](PATCH_SPECIFICATION_API.md) - API cập nhật specifications

### 🛠️ System Maintenance
- [`API_RESPONSE_FIX.md`](API_RESPONSE_FIX.md) - Sửa lỗi API response format

## 🚀 Cách Sử Dụng

1. **Swagger UI**: Truy cập `/secure-api-docs` (yêu cầu authentication)
2. **Postman Collection**: Import file `IoMT-Backend.postman_collection.json` 
3. **Manual Testing**: Sử dụng curl hoặc HTTP client

## 🔑 Authentication

Tất cả API endpoints đều yêu cầu JWT token:

```bash
# 1. Login để lấy token
curl -X POST http://localhost:3030/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Sử dụng token trong các requests
curl -X GET http://localhost:3030/devices \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 📱 API Endpoints Summary

| Category | Base Path | Description |
|----------|-----------|-------------|
| **Auth** | `/auth/*` | Authentication & sessions |
| **Users** | `/users/*` | User management |
| **Devices** | `/devices/*` | Device CRUD & monitoring |
| **Organizations** | `/organizations/*` | Organization management |
| **Departments** | `/departments/*` | Department management |
| **Permissions** | `/user-permissions/*` | Individual permissions |
| **MQTT** | `/iot/*` | IoT device connectivity |
| **Audit** | `/actlog/*` | System audit logs |

## 🛡️ Security

- **Rate Limiting**: 300 requests/minute per user
- **HTTPS Required**: Production environments only
- **Input Validation**: Joi schemas for all inputs
- **SQL Injection Prevention**: Prisma ORM protection
- **CORS Protection**: Whitelist-based origin control

## 📞 Support

- **Issues**: Create GitHub issue với label `api-docs`
- **Questions**: Contact team qua Slack `#api-support`
- **Emergency**: Email `security@iomt.com`

---

*Last updated: November 2024*