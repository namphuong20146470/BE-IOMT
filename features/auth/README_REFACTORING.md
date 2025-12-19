# Auth Module Refactoring - Clean Architecture

## 📋 Overview

Auth module đã được refactor theo **Clean Architecture** principles với separation of concerns rõ ràng.

## 🏗️ New Structure

```
features/auth/
├── auth.controller.js              # ❌ OLD - 1380 lines (deprecated)
├── auth.controller.refactored.js   # ✅ NEW - 400 lines (thin layer)
├── auth.service.js                 # ✅ Business logic - 350 lines
├── auth.validator.js               # ✅ Input validation - 220 lines
├── auth.transformer.js             # ✅ Response formatting - 220 lines
├── auth.constants.js               # ✅ Configuration - 150 lines
├── helpers/
│   └── auth.helpers.js             # ✅ Utility functions - 150 lines
└── repositories/
    └── auth.repository.js          # ✅ Database queries - 200 lines
```

## 📊 Before vs After

### ❌ Before Refactoring:
- **1 file**: `auth.controller.js` (1380 lines)
- Mixed concerns: validation, business logic, database, formatting
- Duplicate code everywhere
- Hard to test, maintain, and extend

### ✅ After Refactoring:
- **7 files**: Clean separation of concerns
- **Total lines**: ~1690 lines (but organized!)
- Each file has single responsibility
- Easy to test, maintain, and extend
- No duplicate code

## 🎯 Layer Responsibilities

### 1. **Controller Layer** (`auth.controller.refactored.js`)
- ✅ Handle HTTP request/response
- ✅ Extract data from request
- ✅ Call service layer
- ✅ Return formatted response
- ❌ NO business logic
- ❌ NO database queries
- ❌ NO validation logic

```javascript
// Example: Login endpoint (only ~20 lines)
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientInfo = extractClientInfo(req);
        
        const result = await AuthService.login(username, password, clientInfo);
        
        setAuthCookies(res, result.tokens.access_token, result.tokens.refresh_token);
        
        return res.json({
            success: true,
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};
```

### 2. **Service Layer** (`auth.service.js`)
- ✅ Business logic
- ✅ Orchestrate between layers
- ✅ Call validators
- ✅ Call repositories
- ✅ Call transformers
- ✅ Error handling
- ❌ NO HTTP concerns
- ❌ NO database queries directly

```javascript
// Example: Login service
static async login(username, password, clientInfo) {
    // 1. Validate
    AuthValidator.validateLoginInput(username, password);
    
    // 2. Find user
    const users = await AuthRepository.findUserWithFullInfo(username);
    
    // 3. Verify password
    const isValid = await this.verifyPassword(password, user.password_hash, user.id);
    
    // 4. Create session
    const sessionData = await sessionService.createSession(...);
    
    // 5. Log audit
    await auditService.logActivity(...);
    
    // 6. Transform and return
    return {
        user: AuthTransformer.transformUser(user, role),
        tokens: AuthTransformer.transformTokens(sessionData.data),
        // ...
    };
}
```

### 3. **Repository Layer** (`repositories/auth.repository.js`)
- ✅ Database queries ONLY
- ✅ Single source of truth for SQL
- ✅ Reusable query methods
- ❌ NO business logic
- ❌ NO validation
- ❌ NO transformations

```javascript
// Example: Find user with full info
static async findUserWithFullInfo(identifier) {
    return await prisma.$queryRaw`
        SELECT u.id, u.username, u.full_name, ...
        FROM users u
        LEFT JOIN organizations o ON ...
        WHERE (u.username = ${identifier} OR u.email = ${identifier})
        AND u.is_active = true
    `;
}
```

### 4. **Validator Layer** (`auth.validator.js`)
- ✅ Input validation
- ✅ Data sanitization
- ✅ Throw ValidationError
- ❌ NO business logic
- ❌ NO database queries

```javascript
// Example: Validate login input
static validateLoginInput(username, password) {
    if (!username || !password) {
        throw new ValidationError(
            'Username and password are required',
            'AUTH_MISSING_CREDENTIALS',
            400
        );
    }
    // ...
}
```

### 5. **Transformer Layer** (`auth.transformer.js`)
- ✅ Format responses
- ✅ Transform database entities to API format
- ❌ NO business logic
- ❌ NO database queries

```javascript
// Example: Transform user
static transformUser(user, role = null) {
    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        // ...
        role: role || DEFAULT_VALUES.ROLE
    };
}
```

### 6. **Constants Layer** (`auth.constants.js`)
- ✅ Configuration values
- ✅ Error codes
- ✅ Default values
- ✅ Patterns

```javascript
export const PASSWORD_CONFIG = {
    MIN_LENGTH: 8,
    BCRYPT_ROUNDS: 10
};

export const AUTH_ERROR_CODES = {
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    // ...
};
```

### 7. **Helpers Layer** (`helpers/auth.helpers.js`)
- ✅ Utility functions
- ✅ Extract data from request
- ✅ Set cookies, headers
- ✅ Error handling

```javascript
export const extractClientInfo = (req) => ({
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'Unknown',
    deviceInfo: { ... }
});
```

## 🔄 Migration Guide

### Step 1: Test New Controllers

```javascript
// In routes/auth.routes.js

// OPTION 1: Use new controller directly
import * as authController from '../features/auth/auth.controller.refactored.js';

// OPTION 2: Keep both for gradual migration
import * as authControllerOld from '../features/auth/auth.controller.js';
import * as authControllerNew from '../features/auth/auth.controller.refactored.js';

// Use new controller for specific routes
router.post('/login', authControllerNew.login);
router.post('/refresh', authControllerNew.refreshToken);

// Keep old controller for others temporarily
router.get('/me', authControllerOld.getMe);
```

### Step 2: Replace Old Controller

```bash
# When ready, replace old controller
cd features/auth
mv auth.controller.js auth.controller.old.js
mv auth.controller.refactored.js auth.controller.js
```

### Step 3: Update Routes

```javascript
// All routes now use clean architecture
import * as authController from '../features/auth/auth.controller.js';

router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);
router.get('/permissions', authMiddleware, authController.getPermissions);
router.post('/change-password', authMiddleware, authController.changePassword);
router.patch('/profile', authMiddleware, authController.updateProfile);
```

## ✅ Benefits

### 1. **Testability**
```javascript
// Easy to test each layer independently

// Test validator
test('should throw error for missing credentials', () => {
    expect(() => {
        AuthValidator.validateLoginInput('', '');
    }).toThrow(ValidationError);
});

// Test service
test('should login user successfully', async () => {
    const result = await AuthService.login('user', 'pass', clientInfo);
    expect(result.user.username).toBe('user');
});

// Test transformer
test('should transform user correctly', () => {
    const transformed = AuthTransformer.transformUser(user, role);
    expect(transformed).toHaveProperty('id');
});
```

### 2. **Maintainability**
- Each file has clear purpose
- Easy to find and fix bugs
- No duplicate code

### 3. **Extensibility**
- Easy to add new features
- Easy to modify existing features
- No risk of breaking other parts

### 4. **Reusability**
- Validators can be used anywhere
- Transformers can be used for other modules
- Repositories can be shared

## 📝 Code Examples

### Example 1: Add New Validation

```javascript
// auth.validator.js
static validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);
    
    if (password.length < minLength) {
        throw new ValidationError('Password too short');
    }
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        throw new ValidationError('Password must contain uppercase, lowercase, and numbers');
    }
}
```

### Example 2: Add New Repository Method

```javascript
// repositories/auth.repository.js
static async findUsersByOrganization(organizationId) {
    return await prisma.users.findMany({
        where: {
            organization_id: organizationId,
            is_active: true
        },
        include: { /* ... */ }
    });
}
```

### Example 3: Add New Transformer

```javascript
// auth.transformer.js
static transformUserList(users) {
    return users.map(user => this.transformUser(user, user.role));
}
```

### Example 4: Add New Service Method

```javascript
// auth.service.js
static async resetPassword(email) {
    // 1. Validate email
    AuthValidator.validateEmail(email);
    
    // 2. Find user
    const users = await AuthRepository.findUserWithFullInfo(email);
    
    if (users.length === 0) {
        throw new AuthError('User not found');
    }
    
    // 3. Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 4. Save reset token
    await AuthRepository.saveResetToken(users[0].id, resetToken);
    
    // 5. Send email (external service)
    await emailService.sendPasswordReset(email, resetToken);
    
    return { success: true };
}
```

### Example 5: Add New Controller Endpoint

```javascript
// auth.controller.js
export const resetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        await AuthService.resetPassword(email);
        
        return res.json({
            success: true,
            message: 'Password reset email sent'
        });
    } catch (error) {
        return handleAuthError(res, error, req);
    }
};
```

## 🎓 Best Practices

1. **Controller**: Only handle HTTP, delegate everything to service
2. **Service**: Orchestrate, don't do everything yourself
3. **Repository**: Pure database queries, no logic
4. **Validator**: Validate and throw errors, nothing else
5. **Transformer**: Transform data, no business decisions
6. **Constants**: Single source of truth for config
7. **Helpers**: Reusable utilities

## 🚀 Next Steps

1. ✅ Test new controllers thoroughly
2. ✅ Update routes to use new controllers
3. ✅ Remove old controller after verification
4. ✅ Apply same pattern to other modules (users, devices, etc.)
5. ✅ Write unit tests for each layer
6. ✅ Write integration tests

## 📚 References

- **Clean Architecture**: Uncle Bob's Clean Architecture
- **SOLID Principles**: Single Responsibility, Open/Closed, etc.
- **DRY Principle**: Don't Repeat Yourself
- **Separation of Concerns**: Each layer has one job

---

**Refactored by**: AI Assistant  
**Date**: 2025-12-19  
**Pattern**: Clean Architecture with Clear Separation of Concerns
