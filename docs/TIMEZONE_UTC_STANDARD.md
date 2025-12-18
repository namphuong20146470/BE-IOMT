# Hướng Dẫn Xử Lý Timezone - UTC Standard

## ✅ **THAY ĐỔI ĐÃ THỰC HIỆN**

### **1. Backend - UTC Only**

**❌ TRƯỚC (Vietnam +7):**
```javascript
function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Lưu vào database
created_at: getVietnamDate()
```

**✅ SAU (UTC):**
```javascript
// Sử dụng UTC time
created_at: new Date()  // ISO 8601 UTC

// Hoặc trong SQL
created_at: NOW()       // PostgreSQL UTC
```

---

### **2. Files Đã Cập Nhật**

✅ **Đã xóa `getVietnamDate()` function khỏi:**
- `features/devices/device.controller.js`
- `features/devices/deviceCategory.controller.js`
- `features/devices/deviceModel.controller.js`
- `features/devices/warranty.controller.js`

✅ **Đã thay thế:**
- `getVietnamDate()` → `new Date()` (JavaScript)
- `getVietnamDate()::timestamptz` → `NOW()` (PostgreSQL)

---

## 📋 **CHUẨN MỚI**

### **Backend (Node.js + PostgreSQL)**

```javascript
// ✅ ĐÚNG: Lưu UTC time
const device = await prisma.device.create({
  data: {
    serial_number: "SN-001",
    created_at: new Date(),  // UTC ISO 8601
    updated_at: new Date()
  }
});

// Response trả về:
{
  "created_at": "2025-12-18T10:30:00.000Z",  // ISO 8601 UTC
  "updated_at": "2025-12-18T10:30:00.000Z"
}
```

```sql
-- ✅ ĐÚNG: PostgreSQL lưu TIMESTAMPTZ (UTC)
CREATE TABLE device (
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- UTC
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query
INSERT INTO device (created_at) VALUES (NOW());  -- UTC
```

---

### **Frontend (React/Vue/Angular)**

```typescript
// ✅ Frontend tự convert sang local timezone

// 1. Hiển thị local time
const displayTime = (utcString: string) => {
  const date = new Date(utcString);
  return date.toLocaleString('vi-VN', { 
    timeZone: 'Asia/Ho_Chi_Minh' 
  });
};

// 2. Hoặc dùng library
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const utcDate = new Date('2025-12-18T10:30:00.000Z');
const vnTime = utcToZonedTime(utcDate, 'Asia/Ho_Chi_Minh');
const formatted = format(vnTime, 'dd/MM/yyyy HH:mm:ss');
// Output: "18/12/2025 17:30:00" (UTC+7)

// 3. Relative time (khuyến nghị)
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const relativeTime = formatDistanceToNow(
  new Date('2025-12-18T10:30:00.000Z'),
  { addSuffix: true, locale: vi }
);
// Output: "2 giờ trước"
```

---

## 🔄 **WORKFLOW CHUẨN**

```
┌─────────────┐
│   Browser   │  User sees: "18/12/2025 17:30" (GMT+7)
└──────┬──────┘
       │ Convert to UTC
       ▼
┌─────────────┐
│  Frontend   │  Send: "2025-12-18T10:30:00.000Z" (UTC)
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────┐
│   Backend   │  Store: "2025-12-18T10:30:00.000Z" (UTC)
│   Node.js   │  new Date() / NOW()
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PostgreSQL │  TIMESTAMPTZ: "2025-12-18 10:30:00+00"
│   Database  │  (Stored as UTC)
└─────────────┘
       │
       ▼ Query
┌─────────────┐
│   Backend   │  Return: "2025-12-18T10:30:00.000Z" (UTC)
└──────┬──────┘
       │ HTTP Response
       ▼
┌─────────────┐
│  Frontend   │  Display: "18/12/2025 17:30" (GMT+7)
│             │  utcToZonedTime(data, 'Asia/Ho_Chi_Minh')
└─────────────┘
```

---

## 📦 **PACKAGES KHUYẾN NGHỊ**

### **Frontend:**
```bash
npm install date-fns date-fns-tz
```

```typescript
// utils/dateFormat.ts
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { vi } from 'date-fns/locale';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

export const formatDateTime = (utcString: string) => {
  const zonedTime = utcToZonedTime(new Date(utcString), TIMEZONE);
  return format(zonedTime, 'dd/MM/yyyy HH:mm:ss', { locale: vi });
};

export const formatDate = (utcString: string) => {
  const zonedTime = utcToZonedTime(new Date(utcString), TIMEZONE);
  return format(zonedTime, 'dd/MM/yyyy', { locale: vi });
};

export const formatTime = (utcString: string) => {
  const zonedTime = utcToZonedTime(new Date(utcString), TIMEZONE);
  return format(zonedTime, 'HH:mm:ss', { locale: vi });
};
```

---

## 🧪 **TESTING**

### **Backend Test:**
```javascript
// Test UTC storage
const device = await prisma.device.create({
  data: {
    serial_number: 'TEST-001',
    created_at: new Date()
  }
});

// Verify ISO 8601 UTC
const createdAt = device.created_at.toISOString();
console.log(createdAt); // "2025-12-18T10:30:00.000Z"
expect(createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
```

### **Frontend Test:**
```typescript
// Test timezone conversion
const utc = '2025-12-18T10:30:00.000Z';
const vnTime = formatDateTime(utc);
expect(vnTime).toBe('18/12/2025 17:30:00'); // UTC+7
```

---

## ⚠️ **LƯU Ý QUAN TRỌNG**

### **1. Database Schema**
```sql
-- ✅ ĐÚNG: TIMESTAMPTZ (with timezone)
created_at TIMESTAMPTZ

-- ❌ SAI: TIMESTAMP (without timezone)
created_at TIMESTAMP
```

### **2. Backend Response**
```javascript
// ✅ ĐÚNG: Luôn trả ISO 8601 UTC
res.json({
  created_at: "2025-12-18T10:30:00.000Z"
});

// ❌ SAI: Đừng format sang local time
res.json({
  created_at: "18/12/2025 17:30:00"  // ❌
});
```

### **3. API Documentation**
```yaml
# swagger.yaml
DateTime:
  type: string
  format: date-time
  example: "2025-12-18T10:30:00.000Z"
  description: ISO 8601 UTC timestamp
```

---

## 🔍 **KIỂM TRA DATABASE**

```sql
-- Xem timezone của PostgreSQL
SHOW timezone;  -- Should be "UTC"

-- Xem data với timezone
SELECT 
  created_at,
  created_at AT TIME ZONE 'UTC' as utc_time,
  created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' as vn_time
FROM device
LIMIT 5;
```

---

## 📊 **SO SÁNH**

| Aspect | ❌ TRƯỚC (+7) | ✅ SAU (UTC) |
|--------|---------------|--------------|
| Backend Storage | GMT+7 | UTC |
| Database Type | TIMESTAMPTZ | TIMESTAMPTZ |
| API Response | GMT+7 | UTC ISO 8601 |
| Frontend Display | GMT+7 | Convert from UTC |
| Timezone Issues | Nhiều bugs | Không có |
| Multi-region | Không hỗ trợ | Hỗ trợ tốt |
| Daylight Saving | Lỗi | Tự động |

---

**✅ Hệ thống đã chuẩn hóa theo UTC standard!**
