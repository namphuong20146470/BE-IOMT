# Specifications API Documentation

## Overview
API endpoints để quản lý thông số kỹ thuật (specifications) cho các device models với hỗ trợ autocomplete bằng tiếng Việt.

## Base URL
```
http://localhost:3030/specifications
```

## Authentication
Tất cả endpoints yêu cầu JWT token trong header:
```
Authorization: Bearer {jwt_token}
```

---

## 📋 **API Endpoints**

### 1. **Get Specification Fields (Autocomplete)**
```http
GET /specifications/fields
```

**Query Parameters:**
- `search` (optional): Tìm kiếm theo tên trường (tiếng Việt hoặc English)
- `category_id` (optional): Lọc theo category của device model

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "field_name": "voltage",
      "field_name_vi": "Điện áp",
      "unit": "V",
      "usage_count": 15,
      "sample_values": ["220V", "110V", "12V"]
    },
    {
      "field_name": "maximum_pressure",
      "field_name_vi": "Áp suất tối đa",
      "unit": "mmHg",
      "usage_count": 8,
      "sample_values": ["300", "150", "200"]
    }
  ],
  "message": "Specification fields retrieved successfully"
}
```

---

### 2. **Get Model Specifications**
```http
GET /specifications/models/{device_model_id}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_model_id": "uuid",
      "field_name": "voltage",
      "field_name_vi": "Điện áp",
      "value": "220V",
      "unit": "V",
      "description": "Điện áp hoạt động tiêu chuẩn",
      "display_order": 1,
      "created_at": "2025-10-14T10:00:00Z",
      "updated_at": "2025-10-14T10:00:00Z"
    }
  ],
  "message": "Model specifications retrieved successfully"
}
```

---

### 3. **Create/Update Model Specifications**
```http
PUT /specifications/models/{device_model_id}
```

**Request Body:**
```json
{
  "specifications": [
    {
      "field_name": "voltage",
      "field_name_vi": "Điện áp",
      "value": "220V",
      "unit": "V",
      "description": "Điện áp hoạt động tiêu chuẩn",
      "display_order": 1
    },
    {
      "field_name": "maximum_pressure", 
      "field_name_vi": "Áp suất tối đa",
      "value": "300",
      "unit": "mmHg",
      "description": "Áp suất tối đa mà thiết bị có thể chịu được",
      "display_order": 2
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated_count": 2,
    "specifications": [
      {
        "id": 1,
        "field_name": "voltage",
        "field_name_vi": "Điện áp",
        "value": "220V",
        "unit": "V"
      }
    ],
    "errors": []
  },
  "message": "2 specifications processed successfully"
}
```

---

### 4. **Delete Specification**
```http
DELETE /specifications/{specification_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "field_name": "voltage",
    "field_name_vi": "Điện áp"
  },
  "message": "Specification deleted successfully"
}
```

---

### 5. **Get Specification Statistics**
```http
GET /specifications/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "field_usage": [
      {
        "type": "field_usage",
        "name": "Điện áp",
        "count": 15,
        "units": ["V", "VAC", "VDC"]
      }
    ],
    "unit_usage": [
      {
        "type": "unit_usage", 
        "name": "V",
        "count": 15,
        "fields": ["Điện áp", "Điện áp đầu vào"]
      }
    ]
  },
  "message": "Specification statistics retrieved successfully"
}
```

---

## 🎯 **Usage Examples**

### **Frontend Autocomplete Integration:**

```javascript
// Get specification fields for autocomplete
const getSpecFields = async (search = '', categoryId = null) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (categoryId) params.append('category_id', categoryId);
  
  const response = await fetch(`/specifications/fields?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Usage in autocomplete component
const handleFieldSearch = async (inputValue) => {
  const result = await getSpecFields(inputValue);
  return result.data.map(field => ({
    label: field.field_name_vi,
    value: field.field_name,
    unit: field.unit,
    samples: field.sample_values
  }));
};
```

### **Save Specifications:**

```javascript
const saveSpecifications = async (modelId, specs) => {
  const response = await fetch(`/specifications/models/${modelId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ specifications: specs })
  });
  return response.json();
};
```

---

## 📝 **Notes**

1. **Autocomplete Logic**: API trả về các trường thông số phổ biến nhất để gợi ý cho user
2. **Upsert**: PUT endpoint sử dụng upsert - tạo mới hoặc cập nhật nếu đã tồn tại
3. **Vietnamese Support**: Tất cả trường đều có tên tiếng Việt để user friendly
4. **Units**: Đơn vị đo lường được suggest dựa trên usage history
5. **Ordering**: `display_order` để sắp xếp thứ tự hiển thị specifications