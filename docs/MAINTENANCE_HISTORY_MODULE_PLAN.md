# 🔧 Module Lịch sử Bảo trì Thiết bị - Kịch bản Chi tiết

## 📊 **1. Database Schema Enhancement**

### **Bảng mới cần tạo: `maintenance_history`**

```sql
CREATE TABLE maintenance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    maintenance_type maintenance_type NOT NULL,
    
    -- Thông tin bảo trì
    title VARCHAR(255) NOT NULL,
    description TEXT,
    performed_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER, -- Thời gian bảo trì (phút)
    
    -- Người thực hiện
    performed_by UUID REFERENCES users(id),
    technician_name VARCHAR(255), -- Tên kỹ thuật viên (nếu không có user)
    department_id UUID REFERENCES departments(id),
    
    -- Chi phí và linh kiện
    cost DECIMAL(12,2), -- Chi phí bảo trì
    currency VARCHAR(3) DEFAULT 'VND',
    parts_replaced JSON, -- Danh sách linh kiện thay thế
    consumables_used JSON, -- Vật tư tiêu hao
    
    -- Trạng thái và kết quả
    status VARCHAR(20) DEFAULT 'completed', -- completed, failed, partial
    severity VARCHAR(20) DEFAULT 'routine', -- routine, urgent, emergency
    
    -- Kết quả bảo trì
    issues_found TEXT, -- Các vấn đề phát hiện
    actions_taken TEXT, -- Hành động đã thực hiện
    recommendations TEXT, -- Khuyến nghị
    
    -- Đánh giá sau bảo trì
    device_condition VARCHAR(20), -- excellent, good, fair, poor
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
    
    -- Lịch bảo trì tiếp theo
    next_maintenance_date DATE,
    next_maintenance_type maintenance_type,
    
    -- File đính kèm
    attachments JSON, -- Ảnh, file PDF, báo cáo
    photos JSON, -- Ảnh trước/sau bảo trì
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id)
);

-- Indexes for performance
CREATE INDEX idx_maintenance_history_device ON maintenance_history(device_id);
CREATE INDEX idx_maintenance_history_date ON maintenance_history(performed_date DESC);
CREATE INDEX idx_maintenance_history_org ON maintenance_history(organization_id);
CREATE INDEX idx_maintenance_history_type ON maintenance_history(maintenance_type);
CREATE INDEX idx_maintenance_history_status ON maintenance_history(status);
CREATE INDEX idx_maintenance_history_performer ON maintenance_history(performed_by);
```

### **Bảng phụ: `maintenance_parts` (Chi tiết linh kiện)**

```sql
CREATE TABLE maintenance_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_id UUID NOT NULL REFERENCES maintenance_history(id) ON DELETE CASCADE,
    
    part_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    supplier VARCHAR(255),
    warranty_months INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🏗️ **2. Cấu trúc Backend**

### **2.1 Models (Prisma Schema Update)**

```prisma
model maintenance_history {
  id                     String               @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  device_id              String               @db.Uuid
  schedule_id            String?              @db.Uuid
  maintenance_type       maintenance_type
  
  // Thông tin bảo trì
  title                  String               @db.VarChar(255)
  description            String?
  performed_date         DateTime             @db.Timestamptz(6)
  duration_minutes       Int?
  
  // Người thực hiện
  performed_by           String?              @db.Uuid
  technician_name        String?              @db.VarChar(255)
  department_id          String?              @db.Uuid
  
  // Chi phí
  cost                   Decimal?             @db.Decimal(12,2)
  currency               String?              @default("VND") @db.VarChar(3)
  parts_replaced         Json?
  consumables_used       Json?
  
  // Trạng thái
  status                 maintenance_status   @default(completed)
  severity               maintenance_severity @default(routine)
  
  // Kết quả
  issues_found           String?
  actions_taken          String?
  recommendations        String?
  
  // Đánh giá
  device_condition       device_condition?
  performance_rating     Int?                 @db.SmallInt
  
  // Lịch tiếp theo
  next_maintenance_date  DateTime?            @db.Date
  next_maintenance_type  maintenance_type?
  
  // Files
  attachments            Json?
  photos                 Json?
  
  // Metadata
  created_at             DateTime?            @default(now()) @db.Timestamptz(6)
  updated_at             DateTime?            @default(now()) @updatedAt @db.Timestamptz(6)
  created_by             String?              @db.Uuid
  organization_id        String               @db.Uuid
  
  // Relations
  device                 device               @relation(fields: [device_id], references: [id], onDelete: Cascade)
  schedule               maintenance_schedules? @relation(fields: [schedule_id], references: [id])
  performer              users?               @relation("MaintenancePerformer", fields: [performed_by], references: [id])
  department             departments?         @relation(fields: [department_id], references: [id])
  creator                users?               @relation("MaintenanceCreator", fields: [created_by], references: [id])
  organization           organizations        @relation(fields: [organization_id], references: [id])
  parts                  maintenance_parts[]
  
  @@index([device_id], map: "idx_maintenance_history_device")
  @@index([performed_date(sort: Desc)], map: "idx_maintenance_history_date")
  @@index([organization_id], map: "idx_maintenance_history_org")
  @@index([maintenance_type], map: "idx_maintenance_history_type")
  @@index([status], map: "idx_maintenance_history_status")
}

model maintenance_parts {
  id              String             @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  maintenance_id  String             @db.Uuid
  part_name       String             @db.VarChar(255)
  part_number     String?            @db.VarChar(100)
  quantity        Int                @default(1)
  unit_price      Decimal?           @db.Decimal(12,2)
  total_cost      Decimal?           @db.Decimal(12,2)
  supplier        String?            @db.VarChar(255)
  warranty_months Int?
  created_at      DateTime?          @default(now()) @db.Timestamptz(6)
  
  maintenance     maintenance_history @relation(fields: [maintenance_id], references: [id], onDelete: Cascade)
  
  @@index([maintenance_id], map: "idx_maintenance_parts_maintenance")
}

// Enums mới
enum maintenance_status {
  completed
  failed
  partial
  cancelled
}

enum maintenance_severity {
  routine
  urgent
  emergency
}

enum device_condition {
  excellent
  good
  fair
  poor
  critical
}
```

### **2.2 Controller Structure**

```
controllers/
├── maintenance/
│   ├── maintenance.controller.js      # CRUD operations
│   ├── maintenance.validation.js     # Input validation
│   ├── maintenance.service.js        # Business logic
│   └── maintenance.routes.js         # API routes
├── maintenanceParts/
│   ├── parts.controller.js           # Parts management
│   └── parts.service.js              
└── maintenanceReports/
    ├── reports.controller.js         # Analytics & reports
    └── reports.service.js
```

## 🛠️ **3. API Endpoints Design**

### **3.1 Core CRUD Operations**

```javascript
// GET /api/maintenance/history - Lấy danh sách lịch sử bảo trì
// Query params: device_id, type, status, date_from, date_to, page, limit

// GET /api/maintenance/history/:id - Chi tiết 1 lần bảo trì

// POST /api/maintenance/history - Tạo bản ghi bảo trì mới

// PUT /api/maintenance/history/:id - Cập nhật bản ghi bảo trì

// DELETE /api/maintenance/history/:id - Xóa bản ghi bảo trì

// GET /api/maintenance/device/:deviceId/history - Lịch sử bảo trì của 1 thiết bị
```

### **3.2 Advanced Features**

```javascript
// GET /api/maintenance/dashboard - Dashboard tổng quan
// GET /api/maintenance/statistics - Thống kê bảo trì
// GET /api/maintenance/costs - Phân tích chi phí
// GET /api/maintenance/schedule/upcoming - Lịch bảo trì sắp tới
// POST /api/maintenance/bulk - Tạo nhiều bản ghi cùng lúc
// GET /api/maintenance/export - Xuất báo cáo Excel/PDF
```

## 📱 **4. Frontend Components**

### **4.1 Main Pages**

```
src/pages/maintenance/
├── MaintenanceHistory.jsx         # Danh sách lịch sử
├── MaintenanceDetail.jsx          # Chi tiết bảo trì
├── CreateMaintenance.jsx          # Form tạo mới
├── EditMaintenance.jsx            # Form chỉnh sửa
├── MaintenanceDashboard.jsx       # Dashboard tổng quan
└── MaintenanceReports.jsx         # Báo cáo & thống kê
```

### **4.2 Reusable Components**

```
src/components/maintenance/
├── MaintenanceCard.jsx            # Card hiển thị 1 bản ghi
├── MaintenanceFilters.jsx         # Bộ lọc tìm kiếm
├── MaintenanceForm.jsx            # Form tạo/sửa
├── PartsTable.jsx                 # Bảng linh kiện
├── PhotoGallery.jsx               # Thư viện ảnh
├── CostSummary.jsx                # Tóm tắt chi phí
└── MaintenanceTimeline.jsx        # Timeline lịch sử
```

## 🔄 **5. Business Logic Features**

### **5.1 Automation Features**

```javascript
// Auto-create maintenance record from schedule
// Auto-calculate next maintenance date
// Auto-generate maintenance recommendations
// Cost calculation with parts and labor
// Performance tracking over time
```

### **5.2 Notifications & Alerts**

```javascript
// Upcoming maintenance alerts
// Overdue maintenance notifications
// Cost threshold alerts
// Performance degradation warnings
```

### **5.3 Analytics & Reporting**

```javascript
// Device reliability metrics
// Maintenance cost analysis
// Technician performance reports
// Parts usage statistics
// Downtime analysis
```

## 🚀 **6. Implementation Phases**

### **Phase 1: Core Foundation (Week 1-2)**
- [ ] Database migration scripts
- [ ] Basic CRUD operations
- [ ] Simple listing page

### **Phase 2: Advanced Features (Week 3-4)**
- [ ] File upload functionality
- [ ] Parts management
- [ ] Cost calculations
- [ ] Search & filters

### **Phase 3: Analytics & Reports (Week 5-6)**
- [ ] Dashboard with charts
- [ ] Export functionality
- [ ] Performance metrics
- [ ] Cost analysis

### **Phase 4: Integration & Polish (Week 7-8)**
- [ ] Integration with existing device management
- [ ] Notifications system
- [ ] Mobile responsiveness
- [ ] Testing & bug fixes

## 📋 **7. Sample API Payloads**

### **Create Maintenance Record**

```json
{
  "device_id": "uuid-here",
  "maintenance_type": "preventive",
  "title": "Quarterly Preventive Maintenance",
  "description": "Routine cleaning and calibration",
  "performed_date": "2024-11-15T10:00:00Z",
  "duration_minutes": 120,
  "technician_name": "Nguyễn Văn A",
  "cost": 500000,
  "currency": "VND",
  "parts_replaced": [
    {
      "name": "Air Filter",
      "quantity": 2,
      "cost": 50000
    }
  ],
  "status": "completed",
  "severity": "routine",
  "issues_found": "Minor dust buildup",
  "actions_taken": "Cleaned and replaced filters",
  "device_condition": "good",
  "performance_rating": 4,
  "next_maintenance_date": "2025-02-15",
  "photos": [
    {"url": "before.jpg", "type": "before"},
    {"url": "after.jpg", "type": "after"}
  ]
}
```

### **Dashboard Response**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_maintenances": 150,
      "this_month": 12,
      "completed": 140,
      "failed": 5,
      "total_cost": 15000000,
      "avg_cost_per_maintenance": 100000
    },
    "by_type": {
      "preventive": 80,
      "corrective": 45,
      "emergency": 15,
      "calibration": 10
    },
    "by_device": [
      {
        "device_name": "MRI Machine #1",
        "maintenance_count": 8,
        "last_maintenance": "2024-11-10",
        "next_due": "2024-12-10",
        "total_cost": 2000000
      }
    ],
    "upcoming_maintenances": [
      {
        "device_name": "CT Scanner #2",
        "due_date": "2024-11-20",
        "type": "preventive",
        "overdue_days": 0
      }
    ]
  }
}
```

## 🔐 **8. Security & Permissions**

```javascript
// Permissions needed:
- maintenance.view      // Xem lịch sử bảo trì
- maintenance.create    // Tạo bản ghi bảo trì
- maintenance.edit      // Sửa bản ghi bảo trì
- maintenance.delete    // Xóa bản ghi bảo trì
- maintenance.approve   // Phê duyệt bảo trì
- maintenance.reports   // Xem báo cáo
- maintenance.costs     // Xem thông tin chi phí

// Organization scoped data
// Department level access control
// Technician can only edit their own records
```

## 📊 **9. Database Indexes cho Performance**

```sql
-- Composite indexes for common queries
CREATE INDEX idx_maintenance_device_date ON maintenance_history(device_id, performed_date DESC);
CREATE INDEX idx_maintenance_org_type ON maintenance_history(organization_id, maintenance_type);
CREATE INDEX idx_maintenance_status_date ON maintenance_history(status, performed_date DESC);
CREATE INDEX idx_maintenance_performer_date ON maintenance_history(performed_by, performed_date DESC);

-- Full text search index
CREATE INDEX idx_maintenance_search ON maintenance_history 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

## 🎯 **10. Success Metrics**

- Giảm thời gian tạo báo cáo bảo trì từ 30 phút xuống 5 phút
- Tăng độ chính xác theo dõi chi phí bảo trì lên 95%
- Giảm thiết bị bị hỏng do bảo trì không đúng lịch 50%
- Tăng hiệu quả quản lý linh kiện 40%

---

**Kịch bản này sẽ tạo ra một module hoàn chỉnh để quản lý lịch sử bảo trì thiết bị, tích hợp chặt chẽ với hệ thống IoMT hiện tại.**