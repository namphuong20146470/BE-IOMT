# Maintenance Jobs API Testing Guide

**Created:** 2025-12-15  
**Purpose:** Test the new 3-stage workflow for maintenance jobs

---

## 🎯 New Endpoints

### 1. Start Job (Pending → In Progress)
```http
PATCH /api/v1/maintenance-logs/{maintenanceId}/jobs/{jobId}/start
Authorization: Bearer {token}
Content-Type: application/json

{
  "before_metrics": {
    "voltage": 220.5,
    "current": 2.3,
    "power": 506.15,
    "frequency": 50.0,
    "power_factor": 0.95
  },
  "issues_found": "Phát hiện điện áp thấp hơn mức bình thường",
  "actions_taken": "Bắt đầu kiểm tra nguồn điện chính"
}
```

**Optional fields:**
- `before_metrics` - Auto-captured from device if not provided
- `issues_found` - Document issues discovered when starting
- `actions_taken` - Document initial actions taken

### 2. Complete Job (In Progress → Completed)
```http
PATCH /api/v1/maintenance-logs/{maintenanceId}/jobs/{jobId}/complete
Authorization: Bearer {token}
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

**Required fields:**
- `after_metrics` (object)
- `result` (enum: `success`, `failed`, `partial`, `continue`)

**Optional fields:**
- `notes` (string)
- `issues_found` (string)
- `actions_taken` (string)

---

## 📋 Complete Workflow Test

### Step 1: Create Maintenance Log

```http
POST /api/v1/maintenance-logs
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_id": "9b2131c1-6c36-44ac-9b48-2e88f123d218",
  "organization_id": "c37235a4-2bf3-4a76-a3f2-28248d2f0390",
  "title": "Test 3-Stage Workflow",
  "description": "Testing new job workflow",
  "maintenance_type": "preventive",
  "severity": "routine"
}
```

**Save:** `maintenance_id` from response

---

### Step 2: Create Job (Minimal Fields)

```http
POST /api/v1/maintenance-logs/{maintenance_id}/jobs
Authorization: Bearer {token}
Content-Type: application/json

{
  "job_number": 1,
  "name": "Kiểm tra nguồn điện",
  "category": "điện",
  "description": "Đo và kiểm tra các thông số điện"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Maintenance job created successfully",
  "data": [
    {
      "id": "job-uuid-here",
      "maintenance_id": "...",
      "job_number": 1,
      "name": "Kiểm tra nguồn điện",
      "status": "pending",  // ✅ Auto-set to pending
      "before_metrics": {},  // ✅ Empty initially
      "after_metrics": {},   // ✅ Empty initially
      "start_time": null,
      "end_time": null,
      "duration_minutes": null,
      "result": null
    }
  ]
}
```

**Save:** `job_id` from response

---

### Step 3: Start Job

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/start
Authorization: Bearer {token}
Content-Type: application/json

{}
```

**Test Case A: Auto-Capture Metrics**
- Send empty body or omit `before_metrics`
- System will auto-capture from device's real-time data

**Test Case B: Manual Metrics + Issues**
```json
{
  "before_metrics": {
    "voltage": 220.5,
    "current": 2.3,
    "power": 506.15,
    "frequency": 50.0,
    "power_factor": 0.95
  },
  "issues_found": "Voltage lower than normal",
  "actions_taken": "Started power supply inspection"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Maintenance job started successfully",
  "data": {
    "id": "job-uuid",
    "status": "in_progress",  // ✅ Changed from pending
    "before_metrics": {
      "voltage": 220.5,
      "current": 2.3,
      "power": 506.15,
      "frequency": 50.0,
      "power_factor": 0.95
    },
    "start_time": "2025-12-15T10:30:00Z",  // ✅ Auto-set to now
    "after_metrics": {},
    "end_time": null,
    "result": null
  }
}
```

---

### Step 4: Complete Job

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/complete
Authorization: Bearer {token}
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
  "notes": "Đã hoàn thành kiểm tra. Hệ thống hoạt động ổn định.",
  "issues_found": "Điện áp hơi thấp ban đầu",
  "actions_taken": "Điều chỉnh regulator"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Maintenance job completed successfully",
  "data": {
    "id": "job-uuid",
    "status": "completed",  // ✅ Changed from in_progress
    "before_metrics": { ... },
    "after_metrics": {
      "voltage": 230.4,
      "current": 2.5,
      "power": 576.0,
      "frequency": 50.0,
      "power_factor": 0.98
    },
    "start_time": "2025-12-15T10:30:00Z",
    "end_time": "2025-12-15T11:15:00Z",  // ✅ Auto-set to now
    "duration_minutes": 45,  // ✅ Auto-calculated
    "result": "success",
    "notes": "Đã hoàn thành kiểm tra...",
    "issues_found": "Điện áp hơi thấp ban đầu",
    "actions_taken": "Điều chỉnh regulator"
  }
}
```

---

## ❌ Error Cases to Test

### 1. Invalid Status Transition - Start

**Test:** Try to start a job that's already `in_progress`

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/start
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Cannot start job with status 'in_progress'. Job must be in 'pending' status."
}
```

---

### 2. Invalid Status Transition - Complete

**Test:** Try to complete a job that's still `pending`

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/complete
Content-Type: application/json

{
  "after_metrics": { ... },
  "result": "success"
}
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Cannot complete job with status 'pending'. Job must be in 'in_progress' status."
}
```

---

### 3. Missing Required Fields - Complete

**Test:** Try to complete without `after_metrics`

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/complete
Content-Type: application/json

{
  "result": "success"
}
```

**Expected Error:**
```json
{
  "success": false,
  "message": "after_metrics is required to complete job"
}
```

---

### 4. Missing Result Field

**Test:** Try to complete without `result`

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/complete
Content-Type: application/json

{
  "after_metrics": {
    "voltage": 230.4,
    "current": 2.5
  }
}
```

**Expected Error:**
```json
{
  "success": false,
  "message": "result is required to complete job"
}
```

---

### 5. Invalid Result Value

**Test:** Use invalid result enum

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/{job_id}/complete
Content-Type: application/json

{
  "after_metrics": { ... },
  "result": "invalid_status"
}
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Invalid result. Must be one of: success, failed, partial, continue"
}
```

---

### 6. Job Not Found

**Test:** Use non-existent job ID

```http
PATCH /api/v1/maintenance-logs/{maintenance_id}/jobs/00000000-0000-0000-0000-000000000000/start
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Maintenance job not found"
}
```

---

### 7. Job Belongs to Different Maintenance Log

**Test:** Use valid job ID but wrong maintenance log ID

```http
PATCH /api/v1/maintenance-logs/different-maintenance-id/jobs/{valid_job_id}/start
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Job does not belong to this maintenance log"
}
```

---

## 🔄 Complete Flow Test Scenarios

### Scenario 1: Normal Success Flow
1. ✅ Create maintenance log
2. ✅ Create job → status: `pending`
3. ✅ Start job (auto-capture) → status: `in_progress`
4. ✅ Complete job → status: `completed`, result: `success`

### Scenario 2: Manual Metrics
1. ✅ Create maintenance log
2. ✅ Create job → status: `pending`
3. ✅ Start job (manual metrics) → status: `in_progress`
4. ✅ Complete job → status: `completed`

### Scenario 3: Partial Completion
1. ✅ Create maintenance log
2. ✅ Create job → status: `pending`
3. ✅ Start job → status: `in_progress`
4. ✅ Complete job with `result: "partial"` → status: `completed`, result: `partial`

### Scenario 4: Failed Job
1. ✅ Create maintenance log
2. ✅ Create job → status: `pending`
3. ✅ Start job → status: `in_progress`
4. ✅ Complete job with `result: "failed"` → status: `completed`, result: `failed`

### Scenario 5: Multiple Jobs in Sequence
1. ✅ Create maintenance log
2. ✅ Create job #1 → status: `pending`
3. ✅ Create job #2 → status: `pending`
4. ✅ Start job #1 → status: `in_progress`
5. ✅ Complete job #1 → status: `completed`
6. ✅ Start job #2 → status: `in_progress`
7. ✅ Complete job #2 → status: `completed`

---

## 🛠️ Postman/Thunder Client Collection

### Environment Variables
```json
{
  "base_url": "http://localhost:3000",
  "token": "your-jwt-token-here",
  "maintenance_id": "",
  "job_id": "",
  "device_id": "9b2131c1-6c36-44ac-9b48-2e88f123d218"
}
```

### Pre-request Scripts

**Get Token:**
```javascript
pm.environment.set("token", pm.response.json().data.token);
```

**Save Maintenance ID:**
```javascript
pm.environment.set("maintenance_id", pm.response.json().data.id);
```

**Save Job ID:**
```javascript
const jobs = pm.response.json().data;
pm.environment.set("job_id", jobs[0].id);
```

---

## ✅ Test Checklist

### Happy Path
- [ ] Create job with minimal fields (status auto-set to `pending`)
- [ ] Start job with empty body (auto-capture metrics)
- [ ] Start job with manual metrics
- [ ] Complete job with all fields
- [ ] Complete job with minimal required fields (after_metrics + result)
- [ ] Verify duration auto-calculation
- [ ] Verify timestamps (start_time, end_time)

### Validation
- [ ] Cannot start job twice (already `in_progress`)
- [ ] Cannot complete `pending` job (must start first)
- [ ] Cannot complete without `after_metrics`
- [ ] Cannot complete without `result`
- [ ] Invalid result value rejected
- [ ] Job not found error
- [ ] Job belongs to different maintenance log error

### Business Logic
- [ ] Auto-capture metrics works when device has real-time data
- [ ] Auto-capture fails gracefully when no device data
- [ ] Duration calculated correctly (minutes)
- [ ] Status transitions validated (pending → in_progress → completed)
- [ ] Immutable completed jobs (cannot restart/re-complete)

### Integration
- [ ] Get maintenance log includes jobs with correct status
- [ ] Multiple jobs can exist in different stages
- [ ] Job timeline displayed correctly
- [ ] Metrics stored/retrieved correctly (JSONB)

---

## 📊 Expected Database State After Full Flow

**maintenance_jobs table:**
```sql
SELECT 
    id, 
    job_number, 
    name, 
    status, 
    result,
    start_time,
    end_time,
    duration_minutes,
    before_metrics,
    after_metrics
FROM maintenance_jobs
WHERE maintenance_id = '{maintenance_id}'
ORDER BY job_number;
```

**Expected Output:**
```
| job_number | name                | status    | result  | duration_minutes |
|------------|---------------------|-----------|---------|------------------|
| 1          | Kiểm tra nguồn điện | completed | success | 45               |
```

---

## 🐛 Troubleshooting

### Error: "Device not found" during auto-capture
**Cause:** Invalid device_id in maintenance log  
**Solution:** Verify device exists and has device_data_latest record

### Error: "No real-time data available"
**Cause:** Device exists but has no device_data_latest  
**Solution:** Provide manual metrics in start request

### Error: "Invalid UUID"
**Cause:** Malformed maintenance_id or job_id  
**Solution:** Check UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

### Duration shows 0 minutes
**Cause:** Job started and completed in same minute  
**Solution:** This is expected for very quick jobs

---

## 📝 Notes

- All timestamps are in ISO 8601 format with timezone (e.g., `2025-12-15T10:30:00Z`)
- Metrics are stored as JSONB, allowing flexible custom fields
- Status transitions are strictly enforced at the service layer
- Completed jobs are immutable (cannot be modified after completion)
- Auto-capture only works if device has active device_data_latest record

---

**Ready to test!** 🚀
