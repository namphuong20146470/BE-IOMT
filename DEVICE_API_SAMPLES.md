# Device Management API Sample Data

## 1. Create Device Categories

### Root Categories
```bash
# Medical Equipment Category
POST /actlog/devices/device-categories
{
  "name": "Thiết bị y tế",
  "description": "Tất cả thiết bị y tế trong bệnh viện"
}

# IT Equipment Category
POST /actlog/devices/device-categories
{
  "name": "Thiết bị IT",
  "description": "Máy tính, mạng, server và thiết bị công nghệ thông tin"
}

# Infrastructure Category
POST /actlog/devices/device-categories
{
  "name": "Cơ sở hạ tầng",
  "description": "Điều hòa, điện, nước, gas y tế"
}
```

### Child Categories (Medical Equipment)
```bash
POST /actlog/devices/device-categories
{
  "name": "Máy xét nghiệm",
  "description": "Các loại máy xét nghiệm tự động",
  "parent_id": "ROOT_MEDICAL_CATEGORY_ID"
}

POST /actlog/devices/device-categories
{
  "name": "Máy chẩn đoán hình ảnh",
  "description": "X-quang, CT, MRI, siêu âm",
  "parent_id": "ROOT_MEDICAL_CATEGORY_ID"
}

POST /actlog/devices/device-categories
{
  "name": "Thiết bị hồi sức",
  "description": "Máy thở, monitor, máy sốc tim",
  "parent_id": "ROOT_MEDICAL_CATEGORY_ID"
}
```

## 2. Create Device Models

### Laboratory Equipment Models
```bash
POST /actlog/devices/device-models
{
  "category_id": "LAB_CATEGORY_ID",
  "name": "Cobas 6000",
  "manufacturer": "Roche Diagnostics",
  "specifications": "Hệ thống xét nghiệm tự động hoàn toàn, 800 test/giờ, hóa sinh và miễn dịch"
}

POST /actlog/devices/device-models
{
  "category_id": "LAB_CATEGORY_ID",
  "name": "XN-3000",
  "manufacturer": "Sysmex",
  "specifications": "Máy đếm tế bào máu tự động, 120 mẫu/giờ, 26 thông số"
}
```

### Imaging Equipment Models
```bash
POST /actlog/devices/device-models
{
  "category_id": "IMAGING_CATEGORY_ID",
  "name": "Multix Select DR",
  "manufacturer": "Siemens Healthineers",
  "specifications": "Máy X-quang kỹ thuật số, detector phẳng, 43x43cm"
}

POST /actlog/devices/device-models
{
  "category_id": "IMAGING_CATEGORY_ID",
  "name": "LOGIQ P9",
  "manufacturer": "GE Healthcare",
  "specifications": "Máy siêu âm cao cấp, 4D, doppler màu"
}
```

## 3. Create Devices

### Laboratory Devices
```bash
POST /actlog/devices/devices
{
  "model_id": "COBAS_6000_MODEL_ID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_XN_ID",
  "serial_number": "RC6000-2024-001",
  "asset_tag": "XN-001",
  "status": "active",
  "purchase_date": "2024-01-15",
  "installation_date": "2024-02-01"
}

POST /actlog/devices/devices
{
  "model_id": "XN3000_MODEL_ID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_XN_ID",
  "serial_number": "SX3000-2024-002",
  "asset_tag": "XN-002",
  "status": "active",
  "purchase_date": "2024-03-10",
  "installation_date": "2024-03-20"
}
```

### Imaging Devices
```bash
POST /actlog/devices/devices
{
  "model_id": "MULTIX_SELECT_MODEL_ID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_CDHA_ID",
  "serial_number": "SI-DR-2024-003",
  "asset_tag": "CDHA-001",
  "status": "active",
  "purchase_date": "2024-02-20",
  "installation_date": "2024-03-15"
}
```

## 4. Create Device Connectivity

```bash
POST /actlog/devices/device-connectivity
{
  "device_id": "COBAS_DEVICE_ID",
  "mqtt_user": "cobas_6000_001",
  "mqtt_pass": "secure_password_123",
  "mqtt_topic": "hospital/lab/cobas6000/001",
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 300,
  "is_active": true
}

POST /actlog/devices/device-connectivity
{
  "device_id": "XN3000_DEVICE_ID",
  "mqtt_user": "sysmex_xn3000_002",
  "mqtt_pass": "secure_password_456",
  "mqtt_topic": "hospital/lab/sysmex_xn3000/002",
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 180,
  "is_active": true
}
```

## 5. Create Warranty Information

```bash
POST /actlog/devices/warranties
{
  "device_id": "COBAS_DEVICE_ID",
  "warranty_start": "2024-02-01",
  "warranty_end": "2027-02-01",
  "provider": "Roche Diagnostics Vietnam"
}

POST /actlog/devices/warranties
{
  "device_id": "XN3000_DEVICE_ID", 
  "warranty_start": "2024-03-20",
  "warranty_end": "2026-03-20",
  "provider": "Sysmex Vietnam"
}

POST /actlog/devices/warranties
{
  "device_id": "MULTIX_DEVICE_ID",
  "warranty_start": "2024-03-15", 
  "warranty_end": "2029-03-15",
  "provider": "Siemens Healthineers Vietnam"
}
```

## 6. Test API Endpoints

### Get All Devices with Filtering
```bash
# Get all devices
GET /actlog/devices/devices

# Filter by organization
GET /actlog/devices/devices?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581

# Filter by status
GET /actlog/devices/devices?status=active

# Filter by manufacturer
GET /actlog/devices/devices?manufacturer=Roche

# Pagination
GET /actlog/devices/devices?page=1&limit=10
```

### Get Device Statistics
```bash
GET /actlog/devices/devices/statistics?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

### Get Connectivity Statistics
```bash
GET /actlog/devices/device-connectivity/statistics?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

### Get Warranty Statistics
```bash
GET /actlog/devices/warranties/statistics?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

### Get Expiring Warranties
```bash
GET /actlog/devices/warranties/expiring?days=90&organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

## 7. Update Device Connectivity Heartbeat (from MQTT)

```bash
# Update last connected timestamp
PUT /actlog/devices/device-connectivity/device/{deviceId}/heartbeat
```

## Sample Response Formats

### Device List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "device-uuid-1",
      "serial_number": "RC6000-2024-001",
      "asset_tag": "XN-001",
      "status": "active",
      "model_name": "Cobas 6000",
      "manufacturer": "Roche Diagnostics",
      "category_name": "Máy xét nghiệm",
      "organization_name": "Bệnh viện Đa khoa Thành phố",
      "department_name": "Phòng Xét nghiệm",
      "warranty_status": "valid",
      "connection_status": "online"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "pages": 1
  }
}
```

### Statistics Response
```json
{
  "success": true,
  "data": {
    "total_devices": 25,
    "active_devices": 22,
    "inactive_devices": 2,
    "maintenance_devices": 1,
    "online_devices": 18,
    "expired_warranties": 2,
    "expiring_warranties": 3
  }
}
```
