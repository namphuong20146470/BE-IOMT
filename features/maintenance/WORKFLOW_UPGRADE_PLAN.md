# Maintenance Jobs Workflow Upgrade Plan

**Date:** 2025-12-15  
**Status:** Planning Phase  
**Impact:** Backend API Extensions + Database Schema

---

## 🎯 Goal

Cải thiện workflow quản lý công việc bảo trì (maintenance jobs) từ mô hình 1-bước (tạo job với đầy đủ before/after metrics) sang mô hình 3-giai đoạn (pending → in_progress → completed) phản ánh đúng quy trình thực tế.

---

## 📊 Current Implementation Analysis

### ✅ Existing API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/maintenance-logs` | POST | Create maintenance log | ✅ Exists |
| `/api/v1/maintenance-logs/:id` | GET | Get log details | ✅ Exists |
| `/api/v1/maintenance-logs/:id` | PATCH | Update log | ✅ Exists |
| `/api/v1/maintenance-logs/:id/jobs` | POST | Create job | ✅ Exists |
| `/api/v1/maintenance-logs/device/:deviceId/current-metrics` | GET | Capture real-time metrics | ✅ Exists |

### ❌ Missing API Endpoints (Needed for New Workflow)

| Endpoint | Method | Purpose | Required |
|----------|--------|---------|----------|
| `/api/v1/maintenance-logs/:id/jobs/:jobId` | PATCH | Update job (generic) | 🟡 Optional |
| `/api/v1/maintenance-logs/:id/jobs/:jobId/start` | PATCH | Start job (pending → in_progress) | ✅ **Required** |
| `/api/v1/maintenance-logs/:id/jobs/:jobId/complete` | PATCH | Complete job (in_progress → completed) | ✅ **Required** |

### 📁 Current Database Schema

```sql
-- maintenance_jobs table (already has status field!)
CREATE TABLE maintenance_jobs (
    id UUID PRIMARY KEY,
    maintenance_id UUID REFERENCES maintenance_history(id),
    job_number INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    
    -- Metrics stored as JSONB (after migration)
    before_metrics JSONB DEFAULT '{}',
    after_metrics JSONB DEFAULT '{}',
    
    -- Timing
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INT,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- ✅ Already exists!
    result VARCHAR(50), -- success, failed, continue, partial
    
    -- Notes
    notes TEXT,
    issues_found TEXT,
    actions_taken TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Findings:**
- ✅ `status` field already exists with default `'pending'`
- ✅ `before_metrics` and `after_metrics` are JSONB (flexible)
- ✅ `start_time` and `end_time` fields exist
- ✅ Database structure supports the new workflow **without migration needed**

---

## 🔄 Proposed Workflow Changes

### Current Flow (1-Step)
```
1. User creates job → fills all fields (name, before_metrics, after_metrics, status)
   └─ Status: "completed" or "in_progress" (manually chosen)
```

### New Flow (3-Steps)
```
1. CREATE Job
   ├─ Input: name, description, category
   ├─ Auto-set: status = 'pending'
   └─ before_metrics & after_metrics = {} (empty)

2. START Job (when technician begins work)
   ├─ Action: PATCH /jobs/:jobId/start
   ├─ Input: before_metrics (auto-capture or manual)
   ├─ Auto-update: status = 'in_progress', start_time = NOW()
   └─ Validation: Can only start if status = 'pending'

3. COMPLETE Job (when work is done)
   ├─ Action: PATCH /jobs/:jobId/complete
   ├─ Input: after_metrics, result (success/failed/partial)
   ├─ Auto-update: status = 'completed', end_time = NOW()
   └─ Validation: Can only complete if status = 'in_progress'
```

---

## 🛠️ Implementation Plan

### **Step 1: Backend API Extensions**

#### 1.1 Add New Route Handlers
**File:** `features/maintenance/maintenance-logs.routes.js`

```javascript
// Add after existing job creation route

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}/jobs/{jobId}/start:
 *   patch:
 *     summary: Start a maintenance job (pending → in_progress)
 *     tags: [Maintenance Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               before_metrics:
 *                 type: object
 *                 properties:
 *                   voltage: { type: number }
 *                   current: { type: number }
 *                   power: { type: number }
 *                   frequency: { type: number }
 *                   power_factor: { type: number }
 *     responses:
 *       200:
 *         description: Job started successfully
 */
router.patch('/:id/jobs/:jobId/start', 
  requirePermission('maintenance.update'), 
  startMaintenanceJob
);

/**
 * @swagger
 * /api/v1/maintenance-logs/{id}/jobs/{jobId}/complete:
 *   patch:
 *     summary: Complete a maintenance job (in_progress → completed)
 *     tags: [Maintenance Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: jobId
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - after_metrics
 *               - result
 *             properties:
 *               after_metrics:
 *                 type: object
 *               result:
 *                 type: string
 *                 enum: [success, failed, partial, continue]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job completed successfully
 */
router.patch('/:id/jobs/:jobId/complete', 
  requirePermission('maintenance.update'), 
  completeMaintenanceJob
);
```

#### 1.2 Add Controller Functions
**File:** `features/maintenance/maintenance-logs.controller.js`

```javascript
/**
 * PATCH /api/v1/maintenance-logs/:id/jobs/:jobId/start
 * Start a maintenance job
 */
export const startMaintenanceJob = async (req, res) => {
    try {
        const { id: maintenanceId, jobId } = req.params;
        const result = await maintenanceService.startMaintenanceJob(
            maintenanceId,
            jobId,
            req.body,
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in startMaintenanceJob:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to start maintenance job'
        });
    }
};

/**
 * PATCH /api/v1/maintenance-logs/:id/jobs/:jobId/complete
 * Complete a maintenance job
 */
export const completeMaintenanceJob = async (req, res) => {
    try {
        const { id: maintenanceId, jobId } = req.params;
        const result = await maintenanceService.completeMaintenanceJob(
            maintenanceId,
            jobId,
            req.body,
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in completeMaintenanceJob:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to complete maintenance job'
        });
    }
};
```

#### 1.3 Add Service Methods
**File:** `features/maintenance/maintenance.service.js`

```javascript
/**
 * Start maintenance job (pending → in_progress)
 */
async startMaintenanceJob(maintenanceId, jobId, data, user) {
    try {
        // Validate IDs
        const validatedMaintenanceId = maintenanceModel.validateMaintenanceId(maintenanceId);
        const validatedJobId = maintenanceModel.validateMaintenanceId(jobId);

        // Get existing job
        const job = await maintenanceRepository.getJobById(validatedJobId);
        if (!job) {
            throw new AppError('Maintenance job not found', 404);
        }

        // Validate status transition
        if (job.status !== 'pending') {
            throw new AppError(
                `Cannot start job with status '${job.status}'. Job must be in 'pending' status.`,
                400
            );
        }

        // Prepare update data
        const updateData = {
            before_metrics: data.before_metrics || {},
            status: 'in_progress',
            start_time: new Date().toISOString()
        };

        // Update job
        await maintenanceRepository.updateJob(validatedJobId, updateData);

        // Get updated job with related data
        const updatedJob = await maintenanceRepository.getJobById(validatedJobId);

        return {
            success: true,
            message: 'Maintenance job started successfully',
            data: updatedJob
        };
    } catch (error) {
        console.error('Error starting maintenance job:', error);
        throw new AppError(
            error.message || 'Failed to start maintenance job',
            error.statusCode || 500
        );
    }
}

/**
 * Complete maintenance job (in_progress → completed)
 */
async completeMaintenanceJob(maintenanceId, jobId, data, user) {
    try {
        // Validate IDs
        const validatedMaintenanceId = maintenanceModel.validateMaintenanceId(maintenanceId);
        const validatedJobId = maintenanceModel.validateMaintenanceId(jobId);

        // Get existing job
        const job = await maintenanceRepository.getJobById(validatedJobId);
        if (!job) {
            throw new AppError('Maintenance job not found', 404);
        }

        // Validate status transition
        if (job.status !== 'in_progress') {
            throw new AppError(
                `Cannot complete job with status '${job.status}'. Job must be in 'in_progress' status.`,
                400
            );
        }

        // Validate required fields
        if (!data.after_metrics) {
            throw new AppError('after_metrics is required to complete job', 400);
        }
        if (!data.result) {
            throw new AppError('result is required to complete job', 400);
        }

        // Validate result enum
        const validResults = ['success', 'failed', 'partial', 'continue'];
        if (!validResults.includes(data.result)) {
            throw new AppError(
                `Invalid result. Must be one of: ${validResults.join(', ')}`,
                400
            );
        }

        // Calculate duration
        const startTime = new Date(job.start_time);
        const endTime = new Date();
        const durationMinutes = Math.round((endTime - startTime) / 60000);

        // Prepare update data
        const updateData = {
            after_metrics: data.after_metrics,
            status: 'completed',
            result: data.result,
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            notes: data.notes || job.notes
        };

        // Update job
        await maintenanceRepository.updateJob(validatedJobId, updateData);

        // Get updated job with related data
        const updatedJob = await maintenanceRepository.getJobById(validatedJobId);

        return {
            success: true,
            message: 'Maintenance job completed successfully',
            data: updatedJob
        };
    } catch (error) {
        console.error('Error completing maintenance job:', error);
        throw new AppError(
            error.message || 'Failed to complete maintenance job',
            error.statusCode || 500
        );
    }
}
```

#### 1.4 Add Repository Methods
**File:** `features/maintenance/maintenance.repository.js`

```javascript
/**
 * Get maintenance job by ID
 */
async getJobById(jobId) {
    const result = await prisma.$queryRaw`
        SELECT * FROM maintenance_jobs
        WHERE id = ${jobId}::uuid
        LIMIT 1
    `;
    return result[0] || null;
}

/**
 * Update maintenance job
 */
async updateJob(jobId, data) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    if (data.before_metrics !== undefined) {
        updates.push(`before_metrics = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(data.before_metrics));
    }
    if (data.after_metrics !== undefined) {
        updates.push(`after_metrics = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(data.after_metrics));
    }
    if (data.status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
    }
    if (data.result) {
        updates.push(`result = $${paramIndex++}`);
        values.push(data.result);
    }
    if (data.start_time) {
        updates.push(`start_time = $${paramIndex++}::timestamptz`);
        values.push(data.start_time);
    }
    if (data.end_time) {
        updates.push(`end_time = $${paramIndex++}::timestamptz`);
        values.push(data.end_time);
    }
    if (data.duration_minutes !== undefined) {
        updates.push(`duration_minutes = $${paramIndex++}`);
        values.push(data.duration_minutes);
    }
    if (data.notes) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    // Add jobId as last parameter
    values.push(jobId);

    const query = `
        UPDATE maintenance_jobs
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}::uuid
        RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result[0];
}
```

#### 1.5 Update Model Validation
**File:** `features/maintenance/maintenance.model.js`

```javascript
/**
 * Validate job start data
 */
validateStartJob(data) {
    const errors = [];

    // before_metrics is optional (can auto-capture)
    if (data.before_metrics) {
        const metricsErrors = this.validateMetrics(data.before_metrics, 'before_metrics');
        errors.push(...metricsErrors);
    }

    if (errors.length > 0) {
        throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
    }

    return data;
}

/**
 * Validate job completion data
 */
validateCompleteJob(data) {
    const errors = [];

    // after_metrics is required
    if (!data.after_metrics || Object.keys(data.after_metrics).length === 0) {
        errors.push('after_metrics is required');
    } else {
        const metricsErrors = this.validateMetrics(data.after_metrics, 'after_metrics');
        errors.push(...metricsErrors);
    }

    // result is required
    if (!data.result) {
        errors.push('result is required');
    } else {
        const validResults = ['success', 'failed', 'partial', 'continue'];
        if (!validResults.includes(data.result)) {
            errors.push(`result must be one of: ${validResults.join(', ')}`);
        }
    }

    if (errors.length > 0) {
        throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
    }

    return data;
}
```

---

### **Step 2: Update Existing CREATE Job Endpoint**

Modify validation to make `before_metrics` and `after_metrics` optional:

**File:** `features/maintenance/maintenance.model.js`

```javascript
validateCreateJob(data) {
    const errors = [];

    // Required fields
    if (!data.maintenance_id) errors.push('maintenance_id is required');
    if (!data.job_number) errors.push('job_number is required');
    if (!data.name) errors.push('name is required');

    // before_metrics and after_metrics are now OPTIONAL
    // Will be filled in START and COMPLETE stages

    // If metrics are provided, validate them
    if (data.before_metrics) {
        const metricsErrors = this.validateMetrics(data.before_metrics, 'before_metrics');
        errors.push(...metricsErrors);
    }
    if (data.after_metrics) {
        const metricsErrors = this.validateMetrics(data.after_metrics, 'after_metrics');
        errors.push(...metricsErrors);
    }

    // Set default status if not provided
    if (!data.status) {
        data.status = 'pending';
    }

    if (errors.length > 0) {
        throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
    }

    return data;
}
```

---

### **Step 3: Database Changes**

**Good News:** ✅ **No migration needed!** The current schema already supports the new workflow.

**Verification Checklist:**
- ✅ `status` field exists with default `'pending'`
- ✅ `before_metrics` and `after_metrics` are JSONB (nullable)
- ✅ `start_time` and `end_time` exist (nullable)
- ✅ Indexes already created

**Optional Enhancement (if needed):**

```sql
-- Add constraint to enforce valid status transitions
ALTER TABLE maintenance_jobs
ADD CONSTRAINT check_status_values 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled'));

-- Add comment for documentation
COMMENT ON COLUMN maintenance_jobs.status IS 
'Job status: pending (created), in_progress (started), completed (finished), failed (unsuccessful), cancelled';
```

---

### **Step 4: Frontend Integration Changes**

See separate frontend implementation plan in:
- `frontend/src/features/maintenance/WORKFLOW_IMPLEMENTATION.md`

**Key Changes:**
1. Simplify `AddJobDialog` - remove metrics sub-stepper
2. Add `UpdateBeforeMetricsDialog` component
3. Add `UpdateAfterMetricsDialog` component
4. Update `MaintenanceDetailPage` to show status-based action buttons
5. Update `maintenanceService` with new API methods

---

## 🔒 Business Rules & Validation

### Status Transition Rules

```
pending → in_progress ✅ (via START endpoint)
pending → completed ❌ (must go through in_progress)
pending → failed ✅ (can fail before starting)

in_progress → completed ✅ (via COMPLETE endpoint)
in_progress → failed ✅ (can fail during work)
in_progress → pending ❌ (cannot revert)

completed → * ❌ (immutable)
failed → * ❌ (immutable)
```

### Permission Requirements

All job operations require `maintenance.update` permission:
- Create job
- Start job (update before_metrics)
- Complete job (update after_metrics)

**Optional:** Add granular permissions:
- `maintenance.job.create`
- `maintenance.job.start`
- `maintenance.job.complete`

### Data Validation

**Start Job:**
- ✅ Job must exist
- ✅ Status must be `pending`
- ⚠️ `before_metrics` optional (can auto-capture or manual input)

**Complete Job:**
- ✅ Job must exist
- ✅ Status must be `in_progress`
- ✅ `after_metrics` required
- ✅ `result` required (success/failed/partial/continue)
- ✅ Auto-calculate `duration_minutes` from start_time to now

---

## 📋 Testing Checklist

### Unit Tests
- [ ] `startMaintenanceJob` - valid transition
- [ ] `startMaintenanceJob` - invalid status (not pending)
- [ ] `startMaintenanceJob` - job not found
- [ ] `completeMaintenanceJob` - valid transition
- [ ] `completeMaintenanceJob` - invalid status (not in_progress)
- [ ] `completeMaintenanceJob` - missing after_metrics
- [ ] `completeMaintenanceJob` - missing result

### Integration Tests
- [ ] Full workflow: CREATE → START → COMPLETE
- [ ] Auto-capture metrics integration
- [ ] Duration calculation accuracy
- [ ] JSONB metrics storage/retrieval

### API Tests (Postman/Thunder Client)
- [ ] POST /maintenance-logs/:id/jobs (create with minimal fields)
- [ ] PATCH /maintenance-logs/:id/jobs/:jobId/start
- [ ] PATCH /maintenance-logs/:id/jobs/:jobId/complete
- [ ] Error handling for invalid transitions

---

## 🚀 Implementation Timeline

### Phase 1: Backend Core (2-3 days)
- [ ] Add repository methods (`getJobById`, `updateJob`)
- [ ] Add service methods (`startMaintenanceJob`, `completeMaintenanceJob`)
- [ ] Add controller handlers
- [ ] Add routes
- [ ] Update model validation

### Phase 2: Testing (1 day)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual API testing

### Phase 3: Documentation (0.5 day)
- [ ] Update API documentation
- [ ] Update Swagger/OpenAPI specs
- [ ] Update README with new endpoints

### Phase 4: Frontend Integration (3-4 days)
- [ ] Update service layer
- [ ] Create new dialogs
- [ ] Update MaintenanceDetailPage
- [ ] Update types and constants
- [ ] Frontend testing

**Total Estimated Time:** 6.5 - 8.5 days

---

## 🤔 Open Questions & Decisions Needed

### 1. Edit Permissions for Completed Jobs
**Options:**
- A) ✅ Lock completely after completion (read-only)
- B) Allow admin to edit any field anytime
- C) Allow editing before final maintenance log closure

**Recommendation:** Option A (simplest, clearest audit trail)

### 2. Failed Job Handling
**Options:**
- A) Add separate `PATCH /:id/jobs/:jobId/fail` endpoint
- B) Allow setting `result: 'failed'` in COMPLETE endpoint
- C) Allow direct status change to 'failed' from any state

**Recommendation:** Option B (job can fail at completion stage) + Allow status='failed' in CREATE for jobs that failed immediately

### 3. Backend Status Transition Validation
**Question:** Should backend strictly enforce transition rules?

**Recommendation:** ✅ YES - Add validation in service layer:
```javascript
const VALID_TRANSITIONS = {
    'pending': ['in_progress', 'failed', 'cancelled'],
    'in_progress': ['completed', 'failed'],
    'completed': [], // immutable
    'failed': [] // immutable
};
```

### 4. Auto-capture Metrics Integration
**Question:** Should START endpoint auto-capture metrics if not provided?

**Recommendation:** Yes:
```javascript
// In startMaintenanceJob service
if (!data.before_metrics || Object.keys(data.before_metrics).length === 0) {
    // Auto-capture from device
    const maintenanceLog = await this.getMaintenanceLog(maintenanceId);
    const metrics = await this.captureCurrentMetrics(maintenanceLog.device_id);
    data.before_metrics = metrics.data;
}
```

### 5. Partial Job Completion
**Question:** If job result is 'partial', should it stay `in_progress` or move to `completed`?

**Recommendation:** Move to `completed` with `result: 'partial'`. Technician can create new job for remaining work.

---

## 📚 Related Documentation

- [Maintenance Module README](./README.md)
- [Database Schema Migration](../../database-migrations/enhance_maintenance_history.sql)
- [Frontend Workflow Plan](../../../../frontend/src/features/maintenance/WORKFLOW_IMPLEMENTATION.md)
- [API Documentation](../../docs/MAINTENANCE_API.md)

---

## ✅ Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-15 | Use 3-stage workflow | Better reflects real-world maintenance process |
| 2025-12-15 | No database migration needed | Current schema already supports it |
| 2025-12-15 | Add dedicated START/COMPLETE endpoints | Clearer API contract, easier validation |
| 2025-12-15 | Make metrics optional in CREATE | Jobs created before work starts |

---

**Next Action:** Review plan → Get stakeholder approval → Implement Phase 1
