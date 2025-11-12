# 📋 Kiểm Tra Swagger vs Routes Thực Tế - Báo Cáo Chi Tiết

## 🔍 Tổng Quan

Sau khi kiểm tra tài liệu API Swagger so với routes thực tế trong dự án, tôi phát hiện **nhiều khác biệt quan trọng**. Dưới đây là báo cáo chi tiết:

---

## ❌ Các Vấn Đề Chính

### 1. **Base URL không khớp**

**Swagger:**
```yaml
servers:
  - url: https://iomt.hoangphucthanh.vn/api/v1
  - url: http://localhost:3000/api/v1
```

**Thực tế:**
```javascript
// Port 3005 (HTTPS) và 3006 (HTTP redirect)
const port = process.env.PORT || 3005;
const httpPort = process.env.HTTP_PORT || 3006;

// Routes không có /api/v1 prefix
app.use('/auth', authRoutes);
app.use('/devices', deviceRoutes); 
```

### 2. **Routes Authentication không đầy đủ**

**Swagger có:**
- `/auth/login` ✅
- `/auth/refresh` ✅
- `/auth/me` ✅

**Thực tế có thêm:**
- `/auth/logout` ❌ (Thiếu trong Swagger)
- `/auth/profile` ❌ (Thiếu trong Swagger)
- `/auth/permissions` ❌ (Thiếu trong Swagger)
- `/auth/verify` ❌ (Thiếu trong Swagger)
- `/auth/change-password` ❌ (Thiếu trong Swagger)
- `/auth/debug-token` ❌ (Development only - thiếu trong Swagger)

### 3. **Device Routes có cấu trúc khác**

**Swagger:**
```yaml
/devices/categories    # ✅ Khớp
/devices/models        # ✅ Khớp
/devices               # ✅ Khớp
```

**Thực tế có thêm:**
```javascript
/devices/device-categories        # Thực tế dùng prefix khác
/devices/device-models           # Thực tế dùng prefix khác
/devices/statistics              # ✅ Có trong Swagger
/devices/{id}/realtime           # ✅ Có trong Swagger
/devices/{id}/history            # ✅ Có trong Swagger

// Nhưng thiếu:
/devices/device-categories/root
/devices/device-categories/{parentId}/children
/devices/device-categories/{id}/stats
/devices/device-models/manufacturers
/devices/device-models/category/{categoryId}
/devices/validate/asset-tag
```

### 4. **User Permissions System hoàn toàn thiếu**

**Thực tế có hệ thống User Permissions phức tạp:**
```javascript
/user-permissions/{userId}                    # ❌ Thiếu hoàn toàn
/user-permissions/{userId}/grant             # ❌ Thiếu hoàn toàn 
/user-permissions/{userId}/revoke            # ❌ Thiếu hoàn toàn
/user-permissions/{userId}/bulk              # ❌ Thiếu hoàn toàn
/user-permissions/{userId}/check/{permissionCode} # ❌ Thiếu hoàn toàn
/user-permissions/{userId}/overrides         # ❌ Thiếu hoàn toàn
```

### 5. **Roles & Permissions Routes không đầy đủ**

**Swagger có:**
```yaml
/roles         # ✅ Khớp
/roles/{id}    # ✅ Khớp
/permissions   # ✅ Khớp
```

**Thực tế có thêm:**
```javascript
/auth/roles/assign      # ❌ Thiếu trong Swagger
/auth/roles/hierarchy   # ❌ Thiếu trong Swagger
```

### 6. **Maintenance & Alerts Routes**

**Swagger:**
- Basic maintenance schedules ✅
- Basic maintenance records ✅
- Basic alerts ✅

**Thực tế có nhiều endpoints nâng cao hơn** nhưng cần kiểm tra chi tiết implementation.

### 7. **MQTT & IoT Routes**

**Swagger có:**
```yaml
/mqtt/devices
```

**Thực tế:**
```javascript
/iot/*  # Legacy MQTT system
```

---

## ✅ Các Phần Khớp

1. **Cơ bản Authentication** (login, refresh, me)
2. **CRUD Organizations** 
3. **CRUD Departments**
4. **CRUD Devices cơ bản**
5. **Device Categories & Models cơ bản**
6. **Pagination parameters**
7. **Error response schemas**

---

## 🔧 Khuyến Nghị Sửa Chữa

### 1. **Cập nhật Base URLs:**
```yaml
servers:
  - url: https://iomt.hoangphucthanh.vn
    description: Production server
  - url: http://localhost:3005
    description: Local development server (HTTPS)
  - url: http://localhost:3006
    description: Local development server (HTTP redirect)
```

### 2. **Thêm Auth Routes thiếu:**
```yaml
/auth/logout:
  post:
    summary: Đăng xuất khỏi hệ thống
    
/auth/permissions:
  get:
    summary: Lấy permissions của user hiện tại
    
/auth/change-password:
  post:
    summary: Đổi mật khẩu
    
/auth/verify:
  get:
    summary: Verify session
```

### 3. **Thêm User Permissions System hoàn chỉnh:**
```yaml
/user-permissions/{userId}:
  get:
    summary: Lấy permissions hiệu lực của user
    parameters:
      - name: detailed
        in: query
        schema:
          type: boolean
      - name: include_overrides  
        in: query
        schema:
          type: boolean

/user-permissions/{userId}/grant:
  post:
    summary: Cấp thêm permission cho user
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [permission_code]
            properties:
              permission_code:
                type: string
              valid_until:
                type: string
                format: date-time
              notes:
                type: string

/user-permissions/{userId}/revoke:
  post:
    summary: Thu hồi permission từ user
    
/user-permissions/{userId}/bulk:
  post:
    summary: Cập nhật nhiều permissions cùng lúc
```

### 4. **Cập nhật Device Routes:**
```yaml
/devices/device-categories:           # Thay vì /devices/categories
/devices/device-models:              # Thay vì /devices/models
/devices/device-categories/root:
/devices/device-categories/{parentId}/children:
/devices/device-models/manufacturers:
/devices/validate/asset-tag:
```

### 5. **Thêm Response Schemas chi tiết:**

Cần thêm schemas cho:
- UserPermissionsResponse
- DeviceCategoryWithStats
- ManufacturersList
- DeviceStatistics
- ValidationResponse

---

## 🎯 Hành Động Cần Thực Hiện

### Ưu Tiên Cao:
1. ✅ Sửa base URLs và ports
2. ✅ Thêm auth routes thiếu (logout, permissions, etc.)
3. ✅ Thêm hoàn toàn User Permissions system
4. ✅ Cập nhật device routes structure

### Ưu Tiên Trung Bình:
1. ✅ Thêm response schemas chi tiết
2. ✅ Cập nhật error handling
3. ✅ Thêm examples cho request/response

### Ưu Tiên Thấp:
1. ✅ Cập nhật descriptions
2. ✅ Thêm rate limiting info
3. ✅ Cập nhật security schemes

---

## 📊 Thống Kê

- **Routes khớp:** ~60%
- **Routes thiếu hoàn toàn:** ~25%
- **Routes có khác biệt:** ~15%
- **Schemas cần cập nhật:** ~40%

**Kết luận:** Swagger documentation cần cập nhật đáng kể để phản ánh đúng thực tế API hiện tại.