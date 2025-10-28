# 🔐 Auth Feature

Authentication and authorization module for IoMT Backend.

## 📁 Structure

```
features/auth/
├── auth.controller.js    # Authentication controllers
├── auth.service.js       # Session management service
├── auth.routes.js        # Authentication routes
├── auth.validation.js    # Input validation
└── README.md            # This file
```

## 🚀 Endpoints

### **Public Routes**
- `POST /auth/login` - User login with credentials
- `POST /auth/refresh` - Refresh access token

### **Protected Routes** 
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile
- `GET /auth/me` - Get full user info for app init
- `GET /auth/permissions` - Get user permissions with caching
- `GET /auth/verify` - Verify session
- `POST /auth/change-password` - Change user password
- `PATCH /auth/profile` - Update user profile

## 🔧 Dependencies

### **Shared Services**
- `../../shared/services/AuditService.js` - Audit logging
- `../../shared/middleware/authMiddleware.js` - JWT middleware
- `../../shared/constants/index.js` - Application constants

### **External Packages**
- `@prisma/client` - Database ORM
- `bcryptjs` - Password hashing
- `crypto` - Cryptographic operations
- `joi` - Input validation

## 📝 Usage Examples

### **Login**
```javascript
POST /auth/login
{
  "username": "john_doe",
  "password": "securepassword"
}
```

### **Update Profile**
```javascript
PATCH /auth/profile
Authorization: Bearer <token>
{
  "full_name": "John Doe Updated",
  "email": "newemail@example.com",
  "phone": "0987654321"
}
```

### **Change Password**
```javascript
POST /auth/change-password
Authorization: Bearer <token>
{
  "current_password": "oldpassword",
  "new_password": "newpassword",
  "confirm_password": "newpassword"
}
```

## 🛡️ Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt + legacy SHA256 support
- **Session Management** - Active session tracking
- **Input Validation** - Joi schemas for all inputs
- **Audit Logging** - Track all authentication activities
- **Rate Limiting** - Protection against brute force
- **Secure Cookies** - HttpOnly, SameSite protection

## ⚙️ Configuration

### **JWT Config**
- Access Token Expiry: 15 minutes
- Refresh Token Expiry: 7 days
- Algorithm: HS256

### **Cookie Options**
- HttpOnly: true
- Secure: false (dev), true (production)
- SameSite: 'none'
- Domain: configurable

## 🔄 Migration Notes

This feature was migrated from:
- `controllers/auth/` → `features/auth/auth.controller.js`
- `routes/auth.routes.js` → `features/auth/auth.routes.js` 
- `services/SessionService.js` → `features/auth/auth.service.js`

All imports have been updated to use relative paths and shared services.