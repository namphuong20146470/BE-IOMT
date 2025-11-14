# Device Models Specifications - New JSONB Structure

## 📋 **Overview**

Từ phiên bản này, specifications của device models được lưu trữ trong **JSONB column** thay vì bảng riêng biệt. Điều này mang lại:

- ✅ **Performance tốt hơn** - Ít JOIN queries
- ✅ **Flexibility cao** - Dễ thêm/sửa specifications 
- ✅ **Querying mạnh mẽ** - PostgreSQL JSONB operators
- ✅ **Storage hiệu quả** - Compression tự động

## 🗂️ **Database Changes**

### **Removed Tables:**
- `specifications` - Bảng specifications cũ
- `specification_fields` - Bảng định nghĩa fields

### **Updated Table:**
```sql
ALTER TABLE device_models 
ADD COLUMN specifications JSONB DEFAULT '{}',
ADD COLUMN created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;

-- GIN Index for fast JSONB queries
CREATE INDEX idx_device_models_specifications ON device_models USING GIN (specifications);
```

## 📊 **JSONB Structure**

### **Recommended Schema:**
```json
{
  "general": {
    "model_year": "2024",
    "warranty_years": 2,
    "country_of_origin": "Germany"
  },
  "dimensions": {
    "width": "200mm",
    "height": "150mm", 
    "depth": "100mm",
    "weight": "2.5kg"
  },
  "electrical": {
    "input_voltage": "220V ± 10%",
    "frequency": "50/60Hz",
    "power_consumption": "50W",
    "current": "0.5A"
  },
  "performance": {
    "accuracy": "±0.1%",
    "resolution": "0.01",
    "response_time": "< 2s",
    "measurement_range": "0-1000"
  },
  "environmental": {
    "operating_temperature": "0°C to 40°C",
    "storage_temperature": "-20°C to 70°C", 
    "humidity": "10-90% RH non-condensing",
    "protection_rating": "IP65"
  },
  "connectivity": {
    "interfaces": ["RS232", "Ethernet", "USB 2.0"],
    "protocols": ["TCP/IP", "Modbus RTU", "SNMP"],
    "wireless": ["WiFi 802.11n", "Bluetooth 4.0"]
  },
  "display": {
    "type": "LCD TFT",
    "size": "7 inch",
    "resolution": "800x480",
    "touchscreen": true
  },
  "certifications": {
    "safety": ["CE", "FDA", "UL"],
    "quality": ["ISO 9001", "ISO 13485"],
    "medical": ["IEC 60601-1", "IEC 60601-1-2"]
  },
  "accessories": {
    "included": ["Power cable", "User manual", "Calibration certificate"],
    "optional": ["Mobile cart", "Printer", "External sensors"]
  },
  "maintenance": {
    "calibration_interval": "12 months",
    "preventive_maintenance": "6 months",
    "filter_replacement": "3 months",
    "software_updates": "automatic"
  }
}
```

## 💻 **API Usage Examples**

### **1. Create Device Model with Specifications:**
```javascript
const deviceModel = await prisma.device_models.create({
  data: {
    category_id: "uuid-here",
    name: "IntelliVue MX800",
    model_number: "MX800-2024",
    manufacturer_id: "philips-uuid",
    specifications: {
      general: {
        model_year: "2024",
        warranty_years: 3
      },
      dimensions: {
        width: "300mm",
        height: "200mm",
        weight: "5.2kg"
      },
      electrical: {
        input_voltage: "100-240V AC",
        power_consumption: "150W"
      }
    }
  }
});
```

### **2. Update Specifications:**
```javascript
// Update specific specification category
await prisma.device_models.update({
  where: { id: deviceModelId },
  data: {
    specifications: {
      ...existingSpecs,
      electrical: {
        input_voltage: "220V ± 5%",
        frequency: "50Hz",
        power_consumption: "75W"
      }
    }
  }
});

// Using Prisma JSONB operations
await prisma.device_models.update({
  where: { id: deviceModelId },
  data: {
    specifications: {
      path: ['electrical', 'power_consumption'],
      set: "100W"
    }
  }
});
```

### **3. Query Specifications:**
```javascript
// Find models with specific power consumption
const models = await prisma.device_models.findMany({
  where: {
    specifications: {
      path: ['electrical', 'power_consumption'],
      equals: "150W"
    }
  }
});

// Find models with certifications
const certifiedModels = await prisma.device_models.findMany({
  where: {
    specifications: {
      path: ['certifications', 'safety'],
      array_contains: ["CE", "FDA"]
    }
  }
});

// Raw SQL for complex queries
const results = await prisma.$queryRaw`
  SELECT id, name, specifications
  FROM device_models 
  WHERE specifications -> 'electrical' ->> 'input_voltage' LIKE '%220V%'
    AND (specifications -> 'certifications' -> 'medical') ? 'IEC 60601-1'
`;
```

## 🔍 **Advanced Querying**

### **PostgreSQL JSONB Operators:**
```sql
-- Check if key exists
SELECT * FROM device_models 
WHERE specifications ? 'electrical';

-- Get specific value
SELECT name, specifications -> 'electrical' ->> 'power_consumption' as power
FROM device_models;

-- Array contains
SELECT * FROM device_models 
WHERE specifications -> 'connectivity' -> 'interfaces' ? 'Ethernet';

-- Path operations
SELECT * FROM device_models 
WHERE specifications #> '{electrical,input_voltage}' = '"220V"';

-- Contains operations
SELECT * FROM device_models 
WHERE specifications @> '{"electrical": {"frequency": "50Hz"}}';
```

### **Indexed Queries (Fast Performance):**
```sql
-- These queries use the GIN index for optimal performance
WHERE specifications ? 'electrical'
WHERE specifications @> '{"electrical": {"power_consumption": "150W"}}'
WHERE specifications -> 'certifications' -> 'safety' ? 'CE'
```

## 🛠️ **Migration from Old Structure**

### **Data Migration Script:**
```javascript
// Migrate existing specifications to JSONB
const migrateSpecifications = async () => {
  const models = await prisma.$queryRaw`
    SELECT dm.id, dm.name, 
           json_object_agg(s.field_name_vi, s.value) as specs
    FROM device_models dm
    LEFT JOIN specifications s ON dm.id = s.device_model_id
    GROUP BY dm.id, dm.name
  `;

  for (const model of models) {
    if (model.specs) {
      await prisma.device_models.update({
        where: { id: model.id },
        data: {
          specifications: model.specs
        }
      });
    }
  }
};
```

## 🎯 **Best Practices**

### **1. Consistent Structure:**
- Sử dụng categories cố định: `general`, `dimensions`, `electrical`, etc.
- Giữ naming convention nhất quán
- Include units trong values: `"200mm"`, `"50Hz"`

### **2. Validation:**
```javascript
const specificationSchema = z.object({
  general: z.object({
    model_year: z.string().optional(),
    warranty_years: z.number().optional()
  }).optional(),
  dimensions: z.object({
    width: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional()
  }).optional(),
  electrical: z.object({
    input_voltage: z.string().optional(),
    power_consumption: z.string().optional()
  }).optional()
  // ... more categories
});
```

### **3. Performance Tips:**
- Sử dụng GIN index cho queries
- Avoid deep nesting (max 3-4 levels)
- Use specific paths trong queries
- Cache frequently accessed specs

## 📊 **Frontend Integration**

### **React Component Example:**
```tsx
const SpecificationDisplay = ({ specifications }) => {
  const categories = Object.keys(specifications);
  
  return (
    <div className="specifications">
      {categories.map(category => (
        <div key={category} className="spec-category">
          <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
          <div className="spec-items">
            {Object.entries(specifications[category]).map(([key, value]) => (
              <div key={key} className="spec-item">
                <label>{key.replace(/_/g, ' ').toUpperCase()}:</label>
                <span>{Array.isArray(value) ? value.join(', ') : value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 🔄 **API Routes Update**

Existing routes continue to work, but now use JSONB:

- `GET /devices/models` - Returns models with specifications
- `PUT /devices/models/:id` - Updates model + specifications  
- `POST /devices/models` - Creates model with specifications

**Response format remains the same**, just specifications is now a JSON object instead of array.

---

## 📞 **Support**

Nếu có vấn đề với migration hoặc cần hỗ trợ, vui lòng tạo issue hoặc liên hệ team development.