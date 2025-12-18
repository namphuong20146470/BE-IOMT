# Hướng Dẫn Soft Delete Device System

## 📋 Tổng quan

Hệ thống **Soft Delete** cho phép xóa thiết bị một cách an toàn, bảo toàn toàn bộ dữ liệu nghiên cứu và có thể khôi phục trong vòng 90 ngày.

## 🎯 Tính năng chính

### ✅ Soft Delete (Xóa mềm)
- Thiết bị được đánh dấu là `archived`
- Dữ liệu nghiên cứu được BẢO TOÀN 100%
- Có thể khôi phục trong 90 ngày
- Tự động tạo audit log

### ✅ Data Preservation (Bảo toàn dữ liệu)
- `device_data` - Lịch sử dữ liệu cảm biến
- `alerts` - Cảnh báo
- `maintenance_history` - Lịch sử bảo trì
- `alert_rules` - Quy tắc cảnh báo
- `warranty_info` - Thông tin bảo hành

### ✅ Restore (Khôi phục)
- Khôi phục thiết bị trong 90 ngày
- Tự động set status = `inactive`
- Ghi log chi tiết quá trình restore

### ✅ Auto Cleanup (Tự động dọn dẹp)
- Xóa vĩnh viễn thiết bị đã xóa > 90 ngày
- Chạy tự động hàng ngày
- Backup trước khi xóa

---

## 🚀 Migration

### Bước 1: Chạy Migration SQL

```bash
# Connect to PostgreSQL
psql -U postgres -d iomt_db

# Run migration
\i database-migrations/add_soft_delete_to_device.sql
```

**Migration sẽ thực hiện:**
1. ✅ Thêm `archived` vào enum `device_status`
2. ✅ Thêm 3 trường mới: `deleted_at`, `deleted_by`, `deletion_reason`
3. ✅ Tạo foreign key đến `users` table
4. ✅ Tạo indexes cho performance
5. ✅ Thay đổi CASCADE DELETE → RESTRICT (bảo vệ dữ liệu)
6. ✅ Tạo audit triggers tự động
7. ✅ Tạo 2 views: `active_devices`, `deleted_devices`

### Bước 2: Update Prisma Schema

```bash
# Generate Prisma client với schema mới
npx prisma generate

# Verify schema
npx prisma validate
```

### Bước 3: Restart Application

```bash
# PM2
pm2 restart iomt-backend

# hoặc
npm run dev
```

---

## 📡 API Endpoints

### 1. Delete Device (Soft Delete)

**Endpoint:**
```http
DELETE /api/v1/devices/:id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Body (Optional):**
```json
{
  "reason": "Thiết bị hỏng không thể sửa chữa"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device archived successfully. All historical data preserved. Can be restored within 90 days.",
  "data": {
    "id": "uuid",
    "serial_number": "DEVICE-001",
    "status": "archived",
    "deleted_at": "2025-12-18T10:30:00Z",
    "data_preserved": {
      "device_data": 15420,
      "alerts": 34,
      "maintenance_history": 12
    }
  }
}
```

---

### 2. Get Deleted Devices

**Endpoint:**
```http
GET /api/v1/devices/deleted
```

**Query Parameters:**
```
?page=1&limit=20&organization_id=<uuid>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "serial_number": "DEVICE-001",
      "status": "archived",
      "deleted_at": "2025-11-18T10:30:00Z",
      "deleted_by": "user-uuid",
      "deletion_reason": "Thiết bị hỏng",
      "deleted_by_user": {
        "full_name": "Nguyễn Văn A",
        "email": "user@example.com"
      },
      "_count": {
        "device_data": 15420,
        "alerts": 34,
        "maintenance_history": 12
      },
      "meta": {
        "days_since_deleted": 30,
        "can_restore": true,
        "days_until_permanent_delete": 60,
        "restoration_deadline": "2026-02-16T10:30:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "meta": {
    "total_deleted": 5,
    "message": "Devices can be restored within 90 days...",
    "restorable_count": 4,
    "permanent_delete_pending": 1
  }
}
```

---

### 3. Restore Device

**Endpoint:**
```http
POST /api/v1/devices/:id/restore
```

**Response:**
```json
{
  "success": true,
  "message": "Device restored successfully. Please activate the device to use it.",
  "data": {
    "id": "uuid",
    "serial_number": "DEVICE-001",
    "status": "inactive",
    "restored_at": "2025-12-18T11:00:00Z",
    "note": "Device is currently inactive. Change status to active to use."
  }
}
```

**Error (Quá 90 ngày):**
```json
{
  "success": false,
  "message": "Device was deleted 95 days ago. Restoration period (90 days) has expired.",
  "data": {
    "deleted_at": "2025-09-14T10:30:00Z",
    "days_since_deleted": 95
  }
}
```

---

## ⚙️ Auto Cleanup Setup

### Cấu hình PM2 (Khuyến nghị)

**Thêm vào `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [
    // ... existing app config ...
    
    // Device Cleanup Job
    {
      name: 'device-cleanup',
      script: './scripts/cleanup-old-devices.js',
      instances: 1,
      autorestart: false,
      cron_restart: '0 2 * * *', // Chạy lúc 2:00 AM hàng ngày
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**Chạy cleanup job:**

```bash
# Start cleanup job
pm2 start ecosystem.config.js --only device-cleanup

# View logs
pm2 logs device-cleanup

# Manual run
node scripts/cleanup-old-devices.js
```

### Cấu hình Windows Task Scheduler

```powershell
# Tạo scheduled task
schtasks /create /tn "IoMT Device Cleanup" /tr "node D:\path\to\scripts\cleanup-old-devices.js" /sc daily /st 02:00
```

---

## 🔒 Permissions

**Yêu cầu quyền:**
- `device.delete` - Để xóa và restore thiết bị
- `device.read` - Để xem danh sách thiết bị đã xóa

---

## 📊 Database Views

### Active Devices View

```sql
-- Xem thiết bị đang hoạt động
SELECT * FROM active_devices
WHERE organization_id = 'uuid';
```

### Deleted Devices View

```sql
-- Xem thiết bị đã xóa với thông tin chi tiết
SELECT * FROM deleted_devices
WHERE organization_id = 'uuid'
ORDER BY deleted_at DESC;
```

---

## ⚠️ Lưu ý quan trọng

### 1. Backup Database

**LUÔN backup database trước khi:**
- Chạy migration
- Chạy cleanup script
- Xóa vĩnh viễn thiết bị

```bash
# PostgreSQL backup
pg_dump -U postgres iomt_db > backup_$(date +%Y%m%d).sql
```

### 2. Foreign Key Constraints

Migration đã thay đổi CASCADE DELETE → RESTRICT:
- **TRước:** Xóa device → Xóa tất cả data liên quan
- **SAU:** Không thể xóa device nếu còn data (RESTRICT)
- **Giải pháp:** Dùng soft delete (recommended)

### 3. Data Preservation

Soft delete BẢO TOÀN:
- ✅ device_data (lịch sử sensor)
- ✅ alerts (cảnh báo)
- ✅ maintenance_history (bảo trì)
- ✅ alert_rules (quy tắc)
- ✅ warranty_info (bảo hành)

### 4. Restoration Period

- ⏰ Thiết bị có thể restore trong **90 ngày**
- 📅 Sau 90 ngày → Xóa vĩnh viễn (cleanup job)
- 💾 Khuyến nghị: Archive data trước khi xóa vĩnh viễn

---

## 🧪 Testing

### Test Soft Delete

```bash
curl -X DELETE http://localhost:3000/api/v1/devices/{device_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test deletion"}'
```

### Test Get Deleted Devices

```bash
curl -X GET http://localhost:3000/api/v1/devices/deleted \
  -H "Authorization: Bearer <token>"
```

### Test Restore

```bash
curl -X POST http://localhost:3000/api/v1/devices/{device_id}/restore \
  -H "Authorization: Bearer <token>"
```

---

## 🐛 Troubleshooting

### Migration Failed

```bash
# Rollback migration
psql -U postgres -d iomt_db

# Drop added columns
ALTER TABLE device DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE device DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE device DROP COLUMN IF EXISTS deletion_reason;
```

### Prisma Generate Error

```bash
# Clear Prisma cache
rm -rf node_modules/.prisma
npx prisma generate
```

### Cleanup Job Not Running

```bash
# Check PM2 logs
pm2 logs device-cleanup

# Check cron schedule
pm2 describe device-cleanup

# Manual test
node scripts/cleanup-old-devices.js
```

---

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. Migration đã chạy thành công chưa
2. Prisma schema đã generate chưa
3. Application đã restart chưa
4. Permissions đã set đúng chưa
5. Database backup đã có chưa

---

**✅ Soft Delete System đã sẵn sàng sử dụng!**
