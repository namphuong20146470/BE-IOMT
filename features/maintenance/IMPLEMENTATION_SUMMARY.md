# 🎉 Maintenance Module Backend - Implementation Complete

## 📦 Deliverables

### **1. Database Layer**
- ✅ `database-migrations/enhance_maintenance_history.sql`
  - Extended `maintenance_history` table with electrical metrics
  - Created `maintenance_jobs` table for sub-tasks
  - Auto-generate ticket numbers trigger
  - Created `maintenance_summary` view
  - Added indexes for performance

### **2. Model Layer**
- ✅ `features/maintenance/maintenance.model.js`
  - Zod validation schemas
  - Input/output type definitions
  - Query parameter validation

### **3. Repository Layer**
- ✅ `features/maintenance/maintenance.repository.js`
  - CRUD operations
  - Advanced filtering and pagination
  - Statistics aggregation
  - Device history tracking
  - Raw SQL for maintenance_jobs (temporary)

### **4. Service Layer**
- ✅ `features/maintenance/maintenance.service.js`
  - Business logic
  - Auto-fill device info
  - Auto-capture real-time metrics
  - Duration calculation
  - Permission checks
  - Organization filtering

### **5. Controller Layer**
- ✅ `features/maintenance/maintenance-logs.controller.js`
  - HTTP request handlers
  - Error handling
  - Response formatting

### **6. Routes Layer**
- ✅ `features/maintenance/maintenance-logs.routes.js`
  - RESTful endpoints
  - Permission middleware
  - Swagger documentation

### **7. Documentation**
- ✅ `features/maintenance/README.md`
  - API documentation
  - Usage examples
  - Setup guide
  - Frontend integration examples

---

## 🚀 Quick Start

### **Step 1: Run Migration**
```bash
cd d:/Workspace/PROJECT/IoMT/backend/BE-IoMT
psql -U postgres -d iomt_db -f database-migrations/enhance_maintenance_history.sql
```

### **Step 2: Add Routes**

Edit `index.js`, add:
```javascript
import maintenanceLogsRoutes from './features/maintenance/maintenance-logs.routes.js';

// Around line 80 (after other routes)
app.use('/api/v1/maintenance-logs', maintenanceLogsRoutes);
```

### **Step 3: Add Permissions**
```sql
-- Add to permissions table
INSERT INTO permissions (name, description, resource, action, group_id) VALUES
('maintenance.create', 'Create maintenance logs', 'maintenance', 'create', 
 (SELECT id FROM permission_groups WHERE name = 'Maintenance')),
('maintenance.read', 'View maintenance logs', 'maintenance', 'read',
 (SELECT id FROM permission_groups WHERE name = 'Maintenance')),
('maintenance.update', 'Update maintenance logs', 'maintenance', 'update',
 (SELECT id FROM permission_groups WHERE name = 'Maintenance')),
('maintenance.delete', 'Delete maintenance logs', 'maintenance', 'delete',
 (SELECT id FROM permission_groups WHERE name = 'Maintenance'));

-- Grant to technician role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Technician'
AND p.resource = 'maintenance';
```

### **Step 4: Test**
```bash
npm run dev

# Test endpoint
curl -X POST http://localhost:3000/api/v1/maintenance-logs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-uuid",
    "title": "Test Maintenance",
    "maintenance_type": "preventive",
    "organization_id": "org-uuid"
  }'
```

---

## 📊 API Endpoints Summary

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST   | `/maintenance-logs` | Create log | `maintenance.create` |
| GET    | `/maintenance-logs` | List all logs | `maintenance.read` |
| GET    | `/maintenance-logs/:id` | Get details | `maintenance.read` |
| PATCH  | `/maintenance-logs/:id` | Update log | `maintenance.update` |
| DELETE | `/maintenance-logs/:id` | Delete log | `maintenance.delete` |
| POST   | `/maintenance-logs/:id/jobs` | Create job | `maintenance.update` |
| GET    | `/maintenance-logs/statistics` | Get stats | `maintenance.read` |
| GET    | `/maintenance-logs/device/:id/history` | Device history | `maintenance.read` |
| GET    | `/maintenance-logs/device/:id/current-metrics` | Real-time data | `device.read` |

---

## 🎯 Key Features

### **1. Auto-fill Device Info**
Khi tạo log, tự động lấy:
- Device serial number, model
- Current socket assignment
- Real-time electrical metrics
- Organization info

### **2. Real-time Metrics Integration**
```javascript
// Frontend calls:
GET /maintenance-logs/device/{id}/current-metrics

// Returns from device_data_latest:
{
  voltage: 232.7,
  current: 2.5,
  power: 581.75,
  frequency: 50.0,
  power_factor: 0.98
}
```

### **3. Workflow Support**
- **Step 1:** Create log với initial metrics
- **Step 2:** Add jobs với before/after metrics
- **Step 3:** Complete với final metrics + conclusion

### **4. Ticket Number Generation**
Auto-generate: `MT-YYYYMMDD-0001`, `MT-YYYYMMDD-0002`, etc.

### **5. Statistics & Analytics**
- Total maintenance by type, status, severity
- Average duration
- Total cost
- Power improvement tracking

---

## 🔧 Database Schema Changes

### **Extended Fields in `maintenance_history`:**
```sql
-- Electrical metrics BEFORE
initial_voltage REAL
initial_current REAL
initial_power REAL
initial_frequency REAL
initial_power_factor REAL

-- Electrical metrics AFTER
final_voltage REAL
final_current REAL
final_power REAL
final_frequency REAL
final_power_factor REAL

-- Tracking & Analysis
socket_id UUID
ticket_number VARCHAR(50) UNIQUE
customer_issue TEXT
technician_issue TEXT
conclusion TEXT
root_cause TEXT
start_time TIMESTAMPTZ
end_time TIMESTAMPTZ
```

### **New Table: `maintenance_jobs`:**
```sql
-- Core
maintenance_id UUID FK
job_number INT
name VARCHAR(255)
category VARCHAR(100)

-- Metrics
before_voltage, before_current, before_power, before_frequency, before_power_factor
after_voltage, after_current, after_power, after_frequency, after_power_factor

-- Timing & Status
start_time, end_time, duration_minutes
status (pending/in_progress/completed/failed)
result (success/failed/continue/partial)

-- Notes
notes, issues_found, actions_taken
```

---

## 📝 Example Usage

### **Create Maintenance Session:**
```javascript
// Step 1: Start maintenance
const log = await api.post('/maintenance-logs', {
  device_id: "9b2131c1-6c36-44ac-9b48-2e88f123d218",
  title: "Bảo trì định kỳ Q4/2025",
  maintenance_type: "preventive",
  customer_issue: "Máy báo lỗi nguồn",
  organization_id: "c37235a4-2bf3-4a76-a3f2-28248d2f0390"
});
// Auto-filled: socket_id, initial metrics from device_data_latest

// Step 2: Add job 1
await api.post(`/maintenance-logs/${log.id}/jobs`, {
  job_number: 1,
  name: "Kiểm tra nguồn chính",
  category: "nguồn",
  before_voltage: 220.5,
  before_current: 2.3,
  status: "in_progress"
});

// Step 3: Complete job 1
const metrics = await api.get(`/maintenance-logs/device/${device_id}/current-metrics`);
await api.patch(`/maintenance-logs/${log.id}/jobs/1`, {
  after_voltage: metrics.voltage,
  after_current: metrics.current,
  end_time: new Date(),
  status: "completed",
  result: "success"
});

// Step 4: Add more jobs...

// Step 5: Complete maintenance
await api.patch(`/maintenance-logs/${log.id}`, {
  final_voltage: 230.4,
  final_current: 2.5,
  final_power: 576.0,
  end_time: new Date(),
  status: "completed",
  conclusion: "Đã thay tụ điện, máy hoạt động ổn định",
  root_cause: "Tụ điện nguồn bị lão hóa",
  device_condition: "good",
  performance_rating: 4
});
```

---

## ✅ Testing Checklist

- [ ] Run migration successfully
- [ ] Add routes to index.js
- [ ] Insert permissions to database
- [ ] Assign permissions to roles
- [ ] Test CREATE endpoint
- [ ] Test GET all logs
- [ ] Test GET single log
- [ ] Test UPDATE endpoint
- [ ] Test CREATE job endpoint
- [ ] Test capture metrics endpoint
- [ ] Test device history endpoint
- [ ] Test statistics endpoint
- [ ] Test filters (device_id, maintenance_type, status)
- [ ] Test pagination
- [ ] Test permissions (deny access without permission)
- [ ] Test organization filtering

---

## 🎨 Frontend Integration Points

### **1. Create Page (Wizard):**
- Step 1: Device selection → Auto-fill info from `/devices/:id`
- Step 2: Jobs form → Button "Lấy từ sensor" calls `/device/:id/current-metrics`
- Step 3: Finalize → Update with final metrics

### **2. List Page:**
```typescript
const { data } = await api.get('/maintenance-logs', {
  params: {
    page: 1,
    limit: 20,
    maintenance_type: 'preventive',
    status: 'completed',
    start_date: '2025-01-01',
    end_date: '2025-12-31'
  }
});
```

### **3. Detail/Print Page:**
```typescript
const { data } = await api.get(`/maintenance-logs/${id}`, {
  params: {
    include_jobs: true,
    include_parts: true
  }
});
```

### **4. Dashboard Stats:**
```typescript
const { data } = await api.get('/maintenance-logs/statistics', {
  params: {
    organization_id: userOrgId,
    start_date: startOfMonth,
    end_date: endOfMonth
  }
});
```

---

## 🚦 Status

**Backend:** ✅ **100% Complete**

**Files Created:**
1. ✅ Database migration SQL
2. ✅ Model validation
3. ✅ Repository layer
4. ✅ Service layer
5. ✅ Controller layer
6. ✅ Routes layer
7. ✅ Documentation

**Next Steps:**
1. Run migration
2. Add routes to index.js
3. Test with Postman
4. Frontend implementation (Phase 2-6 from plan)

**Timeline:**
- Backend: ✅ Complete (2 days)
- Frontend: ⏳ Pending (7 days estimated)

---

## 📞 Support

Nếu gặp vấn đề:
1. Check migration ran successfully: `psql -d iomt_db -c "\d maintenance_history"`
2. Check routes added: `grep maintenance-logs index.js`
3. Check permissions: `SELECT * FROM permissions WHERE resource = 'maintenance'`
4. Check logs: `tail -f logs/error.log`

---

**🎉 Backend Ready for Frontend Integration!**
