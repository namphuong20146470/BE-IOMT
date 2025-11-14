# Anti-Spam Warning System Documentation

## 🚨 Overview

Hệ thống cảnh báo chống spam giải quyết vấn đề flooding logs khi thiết bị liên tục gửi dữ liệu vượt ngưỡng. Thay vì tạo hàng chục warning giống nhau, hệ thống sẽ:

- **Chỉ tạo 1 warning active** cho mỗi loại cảnh báo trên mỗi thiết bị
- **Update giá trị mới nhất** thay vì tạo record mới  
- **Tự động resolve** khi giá trị trở lại bình thường
- **Quản lý notification** theo schedule để tránh spam email

## 🏗️ Architecture

### Core Components

1. **WarningHandler** (`warningHandler.js`)
   - Main logic xử lý cảnh báo với anti-spam
   - State management cho active/resolved warnings
   - Integration với notification system

2. **NotificationProcessor** (`notificationProcessor.js`)
   - Scheduled job xử lý notifications
   - Progressive escalation (1min → 5min → 15min → 30min → 1h)
   - Auto cleanup old records

3. **Enhanced DeviceDataProcessor** 
   - Tích hợp warning checking vào data processing
   - Support complex condition evaluation
   - Dynamic configuration per device

## 📊 Database Schema

### Existing Tables Used:
```sql
-- Main warning logs table
device_warning_logs (
    id SERIAL PRIMARY KEY,
    device_id UUID,
    device_type VARCHAR,
    device_name VARCHAR,
    warning_type VARCHAR,
    warning_severity VARCHAR,
    measured_value REAL,
    threshold_value REAL,
    warning_message TEXT,
    status VARCHAR DEFAULT 'active', -- active, resolved
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    acknowledged_by INTEGER,
    resolution_notes TEXT
);

-- Notification scheduling table  
warning_notifications (
    id SERIAL PRIMARY KEY,
    warning_id INTEGER REFERENCES device_warning_logs(id) ON DELETE CASCADE,
    level INTEGER NOT NULL, -- 1,2,3,4,5 for escalation
    send_time TIMESTAMP NOT NULL,
    status VARCHAR DEFAULT 'scheduled', -- scheduled, sent, failed
    sent_at TIMESTAMP
);
```

## 🔄 Anti-Spam Logic Flow

### 1. Khi nhận dữ liệu vượt ngưỡng:

```javascript
// Check existing active warning
const existing = await prisma.$queryRaw`
    SELECT id 
    FROM device_warning_logs
    WHERE device_id = $1 
      AND warning_type = $2 
      AND status = 'active'
    LIMIT 1
`;

if (existing.length > 0) {
    // UPDATE existing record, không tạo mới
    await prisma.$executeRaw`
        UPDATE device_warning_logs
        SET measured_value = ${newValue},
            timestamp = CURRENT_TIMESTAMP,
            warning_message = ${updatedMessage}
        WHERE id = ${existing[0].id}
    `;
} else {
    // INSERT new active warning
    await createNewWarning(...);
    await scheduleNotifications(warningId);
}
```

### 2. Khi giá trị trở lại bình thường:

```javascript
// Resolve all active warnings of this type
await prisma.$executeRaw`
    UPDATE device_warning_logs
    SET status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP
    WHERE device_id = $1
      AND warning_type = $2
      AND status = 'active'
`;
```

## 📧 Progressive Notification System

### Notification Levels:
- **Level 1**: Immediate (0 minutes)
- **Level 2**: After 5 minutes  
- **Level 3**: After 15 minutes
- **Level 4**: After 30 minutes
- **Level 5**: After 1 hour

### Scheduled Processing:
```javascript
// Runs every minute
cron.schedule('* * * * *', async () => {
    await warningHandler.processScheduledNotifications();
});
```

## 🛠️ Configuration

### Device Warning Configuration:
```json
{
  "enabled": true,
  "rules": [
    {
      "field": "temperature",
      "condition": "> 25",
      "warning_type": "temperature_high", 
      "severity": "moderate",
      "message": "Temperature too high"
    },
    {
      "field": "humidity",
      "condition": "> 70 OR < 30",
      "warning_type": "humidity_extreme",
      "severity": "major",
      "message": "Humidity out of range"
    },
    {
      "field": "battery",
      "condition": "< 20",
      "warning_type": "battery_low",
      "severity": "minor", 
      "message": "Low battery warning"
    }
  ]
}
```

### Supported Conditions:
- Simple: `> 25`, `< 10`, `>= 100`, `!= 0`
- Complex: `> 70 OR < 30`, `>= 25 AND <= 35`
- String: `== 'error'`, `!= 'normal'`

## 🚀 API Endpoints

### Device Data Processing:
```bash
# Simulate device data (triggers warning check)
POST /actlog/device-processor/device-data/{deviceId}/simulate
{
  "data": {
    "temperature": 28.5,
    "humidity": 75,
    "battery": 15
  }
}
```

### Warning Management:
```bash
# Get warning status
GET /actlog/device-processor/warnings/status

# Test warning system
POST /actlog/device-processor/warnings/test
{
  "deviceId": "uuid",
  "warningType": "temperature_high",
  "measuredValue": 30,
  "thresholdValue": 25
}

# Force process notifications
POST /actlog/device-processor/warnings/process-notifications
```

### Legacy Warning APIs:
```bash
# Get all warnings
GET /actlog/device-warning-logs/warnings

# Get active warnings only
GET /actlog/device-warning-logs/warnings/active

# Update warning status
PATCH /actlog/device-warning-logs/warnings/{id}/status
{
  "status": "resolved",
  "resolution_notes": "Issue fixed"
}
```

## 🧪 Testing

### Run Anti-Spam Test:
```bash
node test-anti-spam-warnings.js
```

### Test Scenarios:
1. **Spam Prevention**: Multiple readings above threshold → Only 1 warning
2. **Value Update**: Continued threshold violation → Updates existing warning
3. **Auto Resolution**: Normal values → Resolves active warnings
4. **Notification Schedule**: Progressive escalation → Controlled email sending

## 📈 Monitoring

### Warning Statistics:
```javascript
const stats = await warningHandler.getWarningStats();
// Returns:
{
  warnings: {
    total_warnings: 15,
    active_warnings: 3, 
    resolved_warnings: 12,
    critical_warnings: 1,
    major_warnings: 2
  },
  notifications: {
    total_notifications: 8,
    sent_notifications: 6,
    failed_notifications: 0,
    avg_escalation_level: 2.5
  }
}
```

### Database Queries for Analysis:
```sql
-- Check spam prevention effectiveness
SELECT 
    device_id,
    warning_type,
    COUNT(*) as warning_count,
    MIN(timestamp) as first_warning,
    MAX(timestamp) as last_update
FROM device_warning_logs
WHERE status = 'active'
  AND timestamp >= CURRENT_DATE
GROUP BY device_id, warning_type
HAVING COUNT(*) > 1; -- Should return 0 rows if anti-spam working

-- Notification delivery analysis  
SELECT 
    level,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (sent_at - send_time))/60) as avg_delay_minutes
FROM warning_notifications
WHERE send_time >= CURRENT_DATE
GROUP BY level, status
ORDER BY level;
```

## ⚡ Performance Considerations

### Database Optimization:
```sql
-- Indexes for performance
CREATE INDEX idx_warning_logs_device_type_status ON device_warning_logs(device_id, warning_type, status);
CREATE INDEX idx_notifications_schedule ON warning_notifications(status, send_time);
CREATE INDEX idx_warning_logs_status_timestamp ON device_warning_logs(status, timestamp);
```

### Memory Management:
- Auto cleanup resolved warnings > 30 days
- Auto cleanup sent notifications > 7 days  
- Scheduled job processing with rate limiting

## 🔧 Environment Variables:
```env
# Warning system configuration
WARNING_SYSTEM_ENABLED=true
WARNING_COOLDOWN_SECONDS=300
MAX_NOTIFICATION_LEVEL=5
EMAIL_RATE_LIMIT=100
DEBUG_WARNINGS=false

# Cleanup settings
CLEANUP_RESOLVED_DAYS=30
CLEANUP_NOTIFICATIONS_DAYS=7
```

## 🎯 Benefits

✅ **Eliminates spam warnings**: 1 active warning per type per device
✅ **Real-time updates**: Latest values without new records  
✅ **Automatic resolution**: Self-healing when values normalize
✅ **Controlled notifications**: Progressive escalation prevents email spam
✅ **Performance optimized**: Efficient queries and auto cleanup
✅ **Highly configurable**: Per-device warning rules
✅ **Backward compatible**: Works with existing warning system

## 🔍 Troubleshooting

### Common Issues:

1. **Notifications not sending**:
   - Check `notificationProcessor` is running
   - Verify email service configuration
   - Check `warning_notifications` table for failed records

2. **Warnings not resolving**:
   - Verify condition logic in warning config
   - Check if threshold comparison is correct
   - Ensure data mapping is properly configured

3. **Too many warnings still created**:
   - Verify anti-spam logic in `warningHandler.js`
   - Check database constraints and indexes
   - Review warning type consistency

### Debug Commands:
```bash
# Check processor status
curl -X GET http://localhost:3005/actlog/device-processor/warnings/status

# Force process pending notifications
curl -X POST http://localhost:3005/actlog/device-processor/warnings/process-notifications

# Test warning creation
curl -X POST http://localhost:3005/actlog/device-processor/warnings/test \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"uuid","warningType":"test","measuredValue":100,"thresholdValue":50}'
```
