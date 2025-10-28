# 🏗️ Feature Template

Đây là template chuẩn cho việc tạo feature mới trong dự án IoMT Backend.

## 📁 Cấu trúc File

```
feature-name/
├── feature.controller.js    # API Controllers - xử lý HTTP requests
├── feature.service.js       # Business Logic - logic nghiệp vụ
├── feature.routes.js        # Route Definitions - định nghĩa endpoints
├── feature.validation.js    # Input Validation - validate dữ liệu
└── README.md               # Documentation - tài liệu
```

## 🚀 Cách Sử dụng Template

### 1. **Copy Template**
```bash
# Copy toàn bộ thư mục _template
cp -r features/_template features/new-feature-name
```

### 2. **Rename Files**
```bash
# Đổi tên các file từ "feature" thành tên feature thực tế
mv feature.controller.js newFeature.controller.js
mv feature.service.js newFeature.service.js
mv feature.routes.js newFeature.routes.js
mv feature.validation.js newFeature.validation.js
```

### 3. **Update Code**
- Thay thế `feature-name` bằng tên feature thực tế
- Thay thế `FeatureService` bằng tên service thực tế
- Thay thế `your_table` bằng tên table trong database
- Cập nhật validation schemas theo yêu cầu nghiệp vụ
- Cập nhật permissions theo format: `feature.action`

### 4. **Register Routes**
Thêm vào `index.js`:
```javascript
import newFeatureRoutes from './features/new-feature/newFeature.routes.js';
app.use('/api/new-feature', newFeatureRoutes);
```

## 🎯 Quy tắc Đặt tên

### **File Naming:**
- Controller: `{feature}.controller.js`
- Service: `{feature}.service.js`
- Routes: `{feature}.routes.js`
- Validation: `{feature}.validation.js`

### **Function Naming:**
- `getAllItems` → `getAllUsers`, `getAllDevices`
- `getItemById` → `getUserById`, `getDeviceById`
- `createItem` → `createUser`, `createDevice`
- `updateItem` → `updateUser`, `updateDevice`
- `deleteItem` → `deleteUser`, `deleteDevice`

### **Permission Naming:**
- Format: `{feature}.{action}`
- Examples: `user.read`, `device.create`, `permission.update`

## 📋 Checklist cho Feature mới

- [ ] Copy template
- [ ] Rename files
- [ ] Update table names
- [ ] Update validation schemas
- [ ] Update permission names
- [ ] Create database migrations (if needed)
- [ ] Add route to index.js
- [ ] Test endpoints
- [ ] Update API documentation
- [ ] Add unit tests

## 🔧 Customization

Mỗi feature có thể cần customize:
- **Additional endpoints** (bulk operations, special queries)
- **Custom middleware** (feature-specific validation)
- **Relationships** (foreign keys, joins)
- **File uploads** (if needed)
- **Real-time features** (Socket.IO events)

## 📚 Examples

Xem các feature đã implement:
- `features/users/` - User management
- `features/devices/` - Device management
- `features/auth/` - Authentication

---

💡 **Tip:** Luôn bắt đầu với template này để đảm bảo consistency và best practices!