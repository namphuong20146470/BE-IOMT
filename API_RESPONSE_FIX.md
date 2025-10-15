# API Response Structure Update

## Fixed Manufacturers API Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "AUO Display Plus",
      "country": "Taiwan", 
      "website": "https://www.auodisplay.com",
      "contact_info": {
        "email": "service@auodisplay.com",
        "phone": "+886 3-500-8888"
      },
      "model_count": 15
    },
    {
      "id": "uuid",
      "name": "Karl Storz",
      "country": "Germany",
      "website": "https://www.karlstorz.com", 
      "contact_info": {
        "email": "info@karlstorz.com",
        "phone": "+49 7461 7080"
      },
      "model_count": 8
    }
  ],
  "message": "Manufacturers retrieved successfully"
}
```

## Fixed Suppliers API Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Công ty TNHH Dịch vụ Thương mại Hoàng Phúc Thành",
      "country": "Việt Nam",
      "website": null,
      "contact_info": {
        "email": "contact@hoangphucthanh.vn",
        "phone": "+84 28 1234 5678", 
        "address": "TP. Hồ Chí Minh"
      },
      "model_count": 12
    }
  ],
  "message": "Suppliers retrieved successfully"
}
```

## Note:
- `contact_info` is a JSON field containing email, phone, and other contact details
- Both manufacturers and suppliers use the same JSON structure for contact information