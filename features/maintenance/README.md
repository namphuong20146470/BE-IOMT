# Maintenance Logs Module

Module quản lý nhật ký bảo trì thiết bị y tế IoMT với tích hợp theo dõi thông số điện.

## 🚀 Setup

### 1. Run Database Migration

```bash
psql -U postgres -d iomt_db -f database-migrations/enhance_maintenance_history.sql
```

### 2. Update index.js

Thêm route vào `index.js`:

```javascript
import maintenanceLogsRoutes from './features/maintenance/maintenance-logs.routes.js';

// ...
app.use('/api/v1/maintenance-logs', maintenanceLogsRoutes);
```

### 3. Add Permissions

Thêm permissions vào database:

```sql
INSERT INTO permissions (name, description, resource, action) VALUES
('maintenance.create', 'Create maintenance logs', 'maintenance', 'create'),
('maintenance.read', 'View maintenance logs', 'maintenance', 'read'),
('maintenance.update', 'Update maintenance logs', 'maintenance', 'update'),
('maintenance.delete', 'Delete maintenance logs', 'maintenance', 'delete');
```

---

## 📋 API Endpoints

### **1. Create Maintenance Log**
```http
POST /api/v1/maintenance-logs
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_id": "9b2131c1-6c36-44ac-9b48-2e88f123d218",
  "socket_id": "6cc6232f-b608-4af4-882d-86981f7be8ce",
  "organization_id": "c37235a4-2bf3-4a76-a3f2-28248d2f0390",
  "title": "Bảo trì định kỳ quý 4/2025",
  "description": "Kiểm tra và bảo dưỡng thiết bị theo lịch",
  "maintenance_type": "preventive",
  "severity": "routine",
  "customer_issue": "Máy báo lỗi nguồn",
  "technician_issue": "Phát hiện tụ điện bị phồng",
  "initial_voltage": 220.5,
  "initial_current": 2.3,
  "initial_power": 506.15,
  "initial_frequency": 50.0,
  "initial_power_factor": 0.95,
  "start_time": "2025-12-09T08:00:00Z",
  "performed_by": "user-uuid-here",
  "technician_name": "Nguyễn Văn A"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance log created successfully",
  "data": {
    "id": "new-uuid",
    "ticket_number": "MT-20251209-0001",
    "device": {
      "serial_number": "MD2024002",
      "model": {
        "name": "IoMT Sensor v2"
      }
    },
    "socket": {
      "socket_number": 3,
      "pdu": {
        "name": "PDU-Main-Floor1"
      }
    },
    ...
  }
}
```

---

### **2. Get All Maintenance Logs**
```http
GET /api/v1/maintenance-logs?page=1&limit=20&device_id=xxx&maintenance_type=preventive&include_jobs=true
```

---

### **3. Get Maintenance Log Details**
```http
GET /api/v1/maintenance-logs/{id}?include_jobs=true&include_parts=true
```

---

### **4. Update Maintenance Log** (Complete session)
```http
PATCH /api/v1/maintenance-logs/{id}
Content-Type: application/json

{
  "final_voltage": 230.4,
  "final_current": 2.5,
  "final_power": 576.0,
  "final_frequency": 50.0,
  "final_power_factor": 0.98,
  "end_time": "2025-12-09T12:30:00Z",
  "status": "completed",
  "conclusion": "Đã thay thế tụ điện và kiểm tra nguồn. Máy hoạt động ổn định.",
  "root_cause": "Tụ điện nguồn bị lão hóa",
  "recommendations": "Kiểm tra lại sau 3 tháng",
  "device_condition": "good",
  "performance_rating": 4,
  "cost": 500000,
  "parts_replaced": [
    {
      "name": "Tụ điện 450V 100uF",
      "quantity": 2,
      "cost": 50000
    }
  ]
}
```

---

### **5. Create Maintenance Job** (Sub-task)
```http
POST /api/v1/maintenance-logs/{id}/jobs
Content-Type: application/json

{
  "job_number": 1,
  "name": "Kiểm tra nguồn chính",
  "category": "nguồn",
  "description": "Đo điện áp, dòng điện đầu vào/ra"
}
```

**Note:** With the new 3-stage workflow, jobs are created with minimal info. Metrics are added later via START and COMPLETE endpoints.

---

### **5a. Start Maintenance Job** ✨ NEW
```http
PATCH /api/v1/maintenance-logs/{id}/jobs/{jobId}/start
Content-Type: application/json

{
  "before_metrics": {
    "voltage": 220.5,
    "current": 2.3,
    "power": 506.15,
    "frequency": 50.0,
    "power_factor": 0.95
  }
}
```

**Auto-Capture Option:** If `before_metrics` is omitted, system will automatically capture from device's real-time data.

**Response:**
```json
{
  "success": true,
  "message": "Maintenance job started successfully",
  "data": {
    "id": "job-uuid",
    "status": "in_progress",
    "before_metrics": { ... },
    "start_time": "2025-12-15T10:30:00Z"
  }
}
```

---

### **5b. Complete Maintenance Job** ✨ NEW
```http
PATCH /api/v1/maintenance-logs/{id}/jobs/{jobId}/complete
Content-Type: application/json

{
  "after_metrics": {
    "voltage": 230.4,
    "current": 2.5,
    "power": 576.0,
    "frequency": 50.0,
    "power_factor": 0.98
  },
  "result": "success",
  "notes": "Job completed successfully",
  "issues_found": "Minor voltage fluctuation",
  "actions_taken": "Adjusted voltage regulator"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance job completed successfully",
  "data": {
    "id": "job-uuid",
    "status": "completed",
    "result": "success",
    "before_metrics": { ... },
    "after_metrics": { ... },
    "start_time": "2025-12-15T10:30:00Z",
    "end_time": "2025-12-15T11:15:00Z",
    "duration_minutes": 45
  }
}
```

---

### **6. Capture Current Metrics** (Real-time)
```http
GET /api/v1/maintenance-logs/device/{deviceId}/current-metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "voltage": 232.7,
    "current": 2.5,
    "power": 581.75,
    "frequency": 50.0,
    "power_factor": 0.98,
    "timestamp": "2025-12-09T10:30:00Z"
  }
}
```

---

### **7. Get Device Maintenance History**
```http
GET /api/v1/maintenance-logs/device/{deviceId}/history?limit=10
```

---

### **8. Get Statistics**
```http
GET /api/v1/maintenance-logs/statistics?organization_id=xxx&start_date=2025-01-01&end_date=2025-12-31
```

**Response:**
```json
{Create Maintenance Log**
```typescript
const maintenanceLog = await api.post('/maintenance-logs', {
  device_id,
  title,
  maintenance_type,
  customer_issue
});
```

**Step 2: Create Jobs (Minimal Info)**
```typescript
for (let job of jobs) {
  await api.post(`/maintenance-logs/${maintenanceLog.id}/jobs`, {
    job_number: job.number,
    name: job.name,
    category: job.category,
    description: job.description
    // Status automatically set to 'pending'
  });
}
```

**Step 3: Start Job & Capture Before Metrics**
```typescript
// Option A: Auto-capture from device
await api.patch(`/maintenance-logs/${maintenanceLog.id}/jobs/${job.id}/start`, {});

// Option B: Manual metrics
await api.patch(`/maintenance-logs/${maintenanceLog.id}/jobs/${job.id}/start`, {
  before_metrics: {
    voltage: 220.5,
    current: 2.3,
    power: 506.15,
    frequency: 50.0,
    power_factor: 0.95
  }
});
```

**Step 4: Complete Job & Capture After Metrics**
```typescript
await api.patch(`/maintenance-logs/${maintenanceLog.id}/jobs/${job.id}/complete`, {
  after_metrics: {
    voltage: 230.4,
    current: 2.5,
    power: 576.0,
    frequency: 50.0,
    power_factor: 0.98
  },
  result: 'success', // or 'failed', 'partial', 'continue'
  notes: 'Job completed successfully',
  issues_found: 'Minor issue description',
  actions_taken: 'Actions taken to resolve'
});
```

**Step 5: Complete Maintenance Logacking socket assignment
- `initial_*` - Electrical metrics before maintenance
- `final_*` - Electrical metrics after maintenance
- `customer_issue` - Issue reported by customer
- `technician_issue` - Issue found by technician
- `conclusion` - Final conclusion
- `root_cause` - Root cause analysis

### **maintenance_jobs** (New)
- Sub-tasks within a maintenance session
- Individual before/after metrics per job
- Job status tracking
- Duration and result tracking

---

## 🎯 Features

✅ Auto-generate ticket numbers  
✅ Auto-fill device info from database  
✅ Auto-capture real-time electrical metrics  
✅ Track before/after metrics for each job  
✅ Calculate power improvement  
✅ Statistics and analytics  
✅ Permission-based access control  
✅ Organization/department filtering  
✅ Full audit trail

---

## 🔐 Required Permissions

- `maintenance.create` - Create logs
- `maintenance.read` - View logs
- `maintenance.update` - Update logs
- `maintenance.delete` - Delete logs

---

## 📊 Frontend Integration

### Workflow Steps:

**Step 1: Basic Info**
```typescript
const maintenanceLog = await api.post('/maintenance-logs', {
  device_id,
  title,
  maintenance_type,
  customer_issue
});
```

**Step 2: Add Jobs**
```typescript
for (let job of jobs) {
  // Auto-capture metrics
  const metrics = await api.get(`/maintenance-logs/device/${device_id}/current-metrics`);
  
  // Create job with metrics
  await api.post(`/maintenance-logs/${maintenanceLog.id}/jobs`, {
    ...job,
    before_voltage: metrics.voltage,
    before_current: metrics.current,
    before_power: metrics.power
  });
}
```

**Step 3: Complete**
```typescript
const finalMetrics = await api.get(`/maintenance-logs/device/${device_id}/current-metrics`);

await api.patch(`/maintenance-logs/${maintenanceLog.id}`, {
  final_voltage: finalMetrics.voltage,
  final_current: finalMetrics.current,
  final_power: finalMetrics.power,
  end_time: new Date(),
  status: 'completed',
  conclusion,
  root_cause
});
```

---

## 🐛 Troubleshooting

### Migration fails
```bash
# Check PostgreSQL version
psql --version

# Check uuid-ossp extension
psql -U postgres -d iomt_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Permission denied
```bash
# Grant permissions to technician role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'technician' 
AND p.name LIKE 'maintenance.%';
```

---

## 📚 Next Steps

1. ✅ Run migration
2. ✅ Add routes to index.js
3. ✅ Test endpoints with Postman
4. ⏳ Frontend implementation
5. ⏳ PDF export functionality
6. ⏳ Email notifications

---

**Status:** Backend Complete ✅  
**Timeline:** Ready for frontend integration
