# Postman Configuration for IoMT Backend

## Environment Variables

### Local Development Environment
```
BASE_URL: http://localhost:3030
AUTH_TOKEN: {{jwt_token}}
```

### Production Environment  
```
BASE_URL: https://iomt.hoangphucthanh.vn:3030
AUTH_TOKEN: {{jwt_token}}
```

## Common API Endpoints

### Authentication
```
POST {{BASE_URL}}/auth/login
POST {{BASE_URL}}/auth/register
POST {{BASE_URL}}/auth/refresh
```

### Devices
```
GET {{BASE_URL}}/devices
POST {{BASE_URL}}/devices
PUT {{BASE_URL}}/devices/:id
DELETE {{BASE_URL}}/devices/:id
```

### IoT Data
```
GET {{BASE_URL}}/iot/data
POST {{BASE_URL}}/iot/device-data
GET {{BASE_URL}}/iot/mqtt/status
```

### Master Data
```
GET {{BASE_URL}}/departments
GET {{BASE_URL}}/organizations
GET {{BASE_URL}}/suppliers
```

## Sample Request Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{AUTH_TOKEN}}",
  "Accept": "application/json"
}
```

## Authentication Flow
1. Login với credentials
2. Lấy JWT token từ response
3. Sử dụng token trong header Authorization cho các API khác