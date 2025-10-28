# Device Model Creation - Complete Guide

## 🎯 Mục đích
Tạo device model đơn giản, sau đó sẽ thêm specifications sau.

## 🚀 Quick Start

### 1. Tạo Device Model cơ bản
```javascript
// POST /actlog/device-models
{
  "name": "Máy đo huyết áp Omron", 
  "category_id": "uuid-của-category"
}
```

### 2. Tạo Device Model đầy đủ
```javascript
{
  "name": "Máy đo huyết áp Omron HEM-7156",
  "category_id": "uuid-của-category", 
  "manufacturer": "Omron Healthcare",
  "model_number": "HEM-7156",
  "description": "Máy đo huyết áp tự động với công nghệ IntelliSense"
}
```

## 📝 API Details

### Endpoint
```
POST /actlog/device-models
Authorization: Bearer {token}
Content-Type: application/json
```

### Required Fields
- `name` (string): Tên device model
- `category_id` (uuid): ID của device category

### Optional Fields 
- `manufacturer` (string): Nhà sản xuất
- `model_number` (string): Số model
- `description` (string): Mô tả

### Success Response
```javascript
{
  "success": true,
  "message": "Device model created successfully",
  "data": {
    "id": "uuid",
    "name": "Máy đo huyết áp Omron HEM-7156", 
    "category": {
      "id": "uuid",
      "name": "Blood Pressure Monitor"
    },
    "manufacturer": "Omron Healthcare",
    "model_number": "HEM-7156", 
    "description": "Máy đo huyết áp tự động...",
    "created_at": "2025-01-01T10:00:00.000Z"
  },
  "next_step": {
    "action": "add_specifications",
    "endpoint": "PUT /actlog/specifications/models/{model_id}",
    "description": "Bây giờ có thể thêm specifications cho device model này"
  }
}
```

### Error Response
```javascript
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## 🔧 Validation Rules

1. **Name**: Required, không được empty hoặc chỉ có spaces
2. **Category ID**: Required, phải tồn tại trong database
3. **Manufacturer**: Optional, nếu có sẽ tự động tạo record nếu chưa tồn tại
4. **Model Number**: Optional, có thể trùng (vì nhiều model cùng số)

## 🎯 Workflow Suggested

### Phase 1: Tạo Device Model
```javascript
const modelData = {
  name: "Máy đo SpO2 Contec CMS50D",
  category_id: "uuid-pulse-oximeter-category",
  manufacturer: "Contec Medical Systems", 
  model_number: "CMS50D"
};

const response = await fetch('/actlog/device-models', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(modelData)
});
```

### Phase 2: Thêm Specifications
```javascript
const modelId = response.data.id;
const specifications = [
  {
    field_name: "measurement_range",
    field_name_vi: "Phạm vi đo", 
    value: "0-100",
    unit: "%SpO2"
  },
  {
    field_name: "accuracy", 
    field_name_vi: "Độ chính xác",
    value: "±2", 
    unit: "%"
  }
];

await fetch(`/actlog/specifications/models/${modelId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({ specifications })
});
```

## 🧪 Testing

Chạy test script:
```bash
node test-device-model-creation.js
```

Test sẽ:
- ✅ Login và get token
- ✅ Get danh sách categories
- ✅ Tạo device model mới
- ✅ Verify model đã tạo
- ✅ Test validation errors
- ✅ Show next steps

## 📋 Frontend Integration

### React Hook Example
```javascript
const useCreateDeviceModel = () => {
  const [loading, setLoading] = useState(false);
  
  const createModel = async (modelData) => {
    setLoading(true);
    try {
      const response = await api.post('/actlog/device-models', modelData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    } finally {
      setLoading(false);
    }
  };
  
  return { createModel, loading };
};
```

### Form Component
```javascript
const CreateDeviceModelForm = () => {
  const { createModel, loading } = useCreateDeviceModel();
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    manufacturer: '',
    model_number: '',
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await createModel(formData);
      console.log('Model created:', result.data);
      // Navigate to specifications page
      navigate(`/specifications/${result.data.id}`);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        placeholder="Tên device model"
        required
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      {/* Other form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Đang tạo...' : 'Tạo Device Model'}
      </button>
    </form>
  );
};
```

## 🔄 Error Handling

### Common Errors
1. **401 Unauthorized**: Token không hợp lệ hoặc expired
2. **400 Bad Request**: Data validation failed  
3. **404 Not Found**: Category ID không tồn tại
4. **500 Internal Error**: Server error

### Error Handling Pattern
```javascript
try {
  const result = await createDeviceModel(data);
  // Success
} catch (error) {
  switch (error.status) {
    case 401:
      // Redirect to login
      break;
    case 400:
      // Show validation errors
      setFieldErrors(error.data.errors);
      break;
    case 404:
      // Category not found
      showError('Category không tồn tại');
      break;
    default:
      showError('Có lỗi xảy ra, vui lòng thử lại');
  }
}
```

## 📞 Support

Nếu có lỗi hoặc cần hỗ trợ:
1. Check server logs: `docker logs iomt-backend`
2. Verify database connection
3. Check authentication token
4. Review API documentation

**API sẵn sàng sử dụng! 🚀**