# 🔐 Frontend Authentication Integration Guide

## 📋 Overview

Hệ thống IoMT Backend cung cấp đầy đủ các endpoint để Frontend duy trì đăng nhập không logout, với support cho JWT-based authentication và automatic token refresh.

## 🎯 Core Endpoints

### **1. 🚪 Login - Khởi tạo session**
```http
POST /auth/login
Content-Type: application/json

{
    "username": "superadmin",
    "password": "your_password"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "user": {
            "id": "fff5be26-843b-4141-ad5e-25127287829a",
            "username": "superadmin",
            "full_name": "Super Administrator",
            "email": "superadmin@system.com",
            "organization_id": "5a5caf03-b524-44ac-871a-9a67c20b0838",
            "role_name": "Super Admin"
        },
        "tokens": {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "refresh_token": "80ccf614e7843b7ed1ef95d45a517174...",
            "access_token_expires_in": 1800,
            "refresh_token_expires_in": 604800,
            "token_type": "Bearer"
        },
        "session": {
            "session_id": "d1d92fae-ea95-4c4b-842d-926896c2dbd6",
            "device_id": "PostmanRuntime/7.49.0",
            "ip_address": "::1",
            "expires_at": "2025-11-05T02:16:41.284Z"
        },
        "permissions_summary": {
            "total": 100,
            "has_admin_access": true
        }
    }
}
```

### **2. 🔄 Refresh Token - Gia hạn access token**
```http
POST /auth/refresh
Content-Type: application/json

{
    "refresh_token": "80ccf614e7843b7ed1ef95d45a517174..."
}
```

**Response:**
```json
{
    "success": true,
    "message": "Token refreshed successfully",
    "data": {
        "user": {
            "id": "fff5be26-843b-4141-ad5e-25127287829a",
            "username": "superadmin",
            "full_name": "Super Administrator",
            "email": "superadmin@system.com",
            "role_name": "Super Admin"
        },
        "tokens": {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "access_token_expires_in": 1800,
            "token_type": "Bearer"
        },
        "session": {
            "session_id": "d1d92fae-ea95-4c4b-842d-926896c2dbd6",
            "expires_at": "2025-11-05T02:16:41.284Z"
        }
    }
}
```

### **3. ✅ Verify Session - Kiểm tra trạng thái đăng nhập**
```http
GET /auth/verify
Authorization: Bearer {access_token}
```

**Response:**
```json
{
    "success": true,
    "message": "Session is valid",
    "data": {
        "user": {
            "id": "fff5be26-843b-4141-ad5e-25127287829a",
            "username": "superadmin",
            "full_name": "Super Administrator"
        },
        "session": {
            "session_id": "d1d92fae-ea95-4c4b-842d-926896c2dbd6",
            "expires_at": "2025-11-05T02:16:41.284Z",
            "verified_at": "2025-10-29T02:30:00.000Z"
        },
        "token_info": {
            "token_type": "Bearer",
            "is_active": true
        }
    }
}
```

### **4. 👤 Get User Profile - Thông tin user đầy đủ**
```http
GET /auth/me
Authorization: Bearer {access_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "fff5be26-843b-4141-ad5e-25127287829a",
            "username": "superadmin",
            "full_name": "Super Administrator",
            "email": "superadmin@system.com",
            "avatar": null,
            "organization_id": "5a5caf03-b524-44ac-871a-9a67c20b0838",
            "department_id": null,
            "is_active": true,
            "organization_name": "System",
            "department_name": null,
            "roles": [{
                "id": "3fa76a67-9436-4301-8f5a-c73f6345f5f5",
                "name": "Super Admin",
                "permissions": ["system.admin", "user.manage", ...]
            }]
        },
        "session": {
            "session_id": "d1d92fae-ea95-4c4b-842d-926896c2dbd6",
            "created_at": "2025-10-29T02:16:41.288Z",
            "expires_at": "2025-11-05T02:16:41.284Z",
            "device_info": "PostmanRuntime/7.49.0"
        }
    }
}
```

### **5. 🔑 Get Permissions - Danh sách quyền user**
```http
GET /auth/permissions
Authorization: Bearer {access_token}
```

### **6. 🚪 Logout - Kết thúc session**
```http
POST /auth/logout
Authorization: Bearer {access_token}

{
    "logout_all_sessions": false
}
```

## 🔄 Frontend Authentication Flow

### **Initial Login Flow:**
```javascript
// 1. Login
const loginResponse = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
});

const loginData = await loginResponse.json();

// 2. Store tokens
localStorage.setItem('access_token', loginData.data.tokens.access_token);
localStorage.setItem('refresh_token', loginData.data.tokens.refresh_token);
localStorage.setItem('user_data', JSON.stringify(loginData.data.user));

// 3. Set default authorization header
axios.defaults.headers.common['Authorization'] = 
    `Bearer ${loginData.data.tokens.access_token}`;
```

### **Auto Token Refresh Flow:**
```javascript
// Axios interceptor để tự động refresh token
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            const refreshToken = localStorage.getItem('refresh_token');
            
            if (refreshToken) {
                try {
                    const refreshResponse = await axios.post('/auth/refresh', {
                        refresh_token: refreshToken
                    });
                    
                    const newAccessToken = refreshResponse.data.data.tokens.access_token;
                    
                    // Update stored token
                    localStorage.setItem('access_token', newAccessToken);
                    
                    // Update default header
                    axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    
                    // Retry original request
                    error.config.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return axios.request(error.config);
                    
                } catch (refreshError) {
                    // Refresh failed - redirect to login
                    localStorage.clear();
                    window.location.href = '/login';
                }
            } else {
                // No refresh token - redirect to login
                localStorage.clear();
                window.location.href = '/login';
            }
        }
        
        return Promise.reject(error);
    }
);
```

### **Session Verification on App Init:**
```javascript
// App initialization - check if user is still logged in
const initializeAuth = async () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!accessToken || !refreshToken) {
        // No tokens - redirect to login
        window.location.href = '/login';
        return;
    }
    
    try {
        // Verify current session
        const verifyResponse = await axios.get('/auth/verify', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (verifyResponse.data.success) {
            // Session valid - load user data
            const userResponse = await axios.get('/auth/me');
            setUser(userResponse.data.data.user);
            
        }
    } catch (error) {
        // Verification failed - try refresh
        try {
            const refreshResponse = await axios.post('/auth/refresh', {
                refresh_token: refreshToken
            });
            
            const newAccessToken = refreshResponse.data.data.tokens.access_token;
            localStorage.setItem('access_token', newAccessToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
            
            // Load user data with new token
            const userResponse = await axios.get('/auth/me');
            setUser(userResponse.data.data.user);
            
        } catch (refreshError) {
            // Both verification and refresh failed
            localStorage.clear();
            window.location.href = '/login';
        }
    }
};
```

### **Logout Flow:**
```javascript
const logout = async (logoutAllSessions = false) => {
    try {
        await axios.post('/auth/logout', {
            logout_all_sessions: logoutAllSessions
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear local storage regardless of API success
        localStorage.clear();
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
    }
};
```

## 🛡️ Security Best Practices

### **1. Token Storage:**
```javascript
// ✅ SECURE - Use localStorage for SPA
localStorage.setItem('access_token', token);
localStorage.setItem('refresh_token', refreshToken);

// ❌ AVOID - Don't store in global variables
window.accessToken = token; // Vulnerable to XSS
```

### **2. Request Headers:**
```javascript
// ✅ CORRECT - Always use Authorization header
headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
}

// ❌ AVOID - Don't put tokens in URL or body unless required
```

### **3. Error Handling:**
```javascript
// ✅ PROPER - Handle all auth error scenarios
const handleAuthError = (error) => {
    if (error.response?.status === 401) {
        // Unauthorized - token invalid/expired
        if (error.response.data?.code === 'AUTH_TOKEN_MISSING') {
            // No token provided
            redirectToLogin();
        } else if (error.response.data?.code === 'AUTH_REFRESH_TOKEN_MISSING') {
            // Refresh token missing
            redirectToLogin();
        } else {
            // Try refresh token
            attemptTokenRefresh();
        }
    } else if (error.response?.status === 403) {
        // Forbidden - insufficient permissions
        showPermissionDeniedMessage();
    }
};
```

## 📱 React/Vue Integration Examples

### **React Context Provider:**
```jsx
// AuthContext.js
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    const login = async (credentials) => {
        const response = await authAPI.login(credentials);
        const { tokens, user } = response.data;
        
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        
        setUser(user);
        setIsAuthenticated(true);
        
        return response;
    };
    
    const logout = async () => {
        try {
            await authAPI.logout();
        } finally {
            localStorage.clear();
            setUser(null);
            setIsAuthenticated(false);
        }
    };
    
    const checkAuth = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            setIsLoading(false);
            return;
        }
        
        try {
            const response = await authAPI.verify();
            setUser(response.data.user);
            setIsAuthenticated(true);
        } catch (error) {
            // Try refresh
            try {
                const refreshResponse = await authAPI.refresh();
                setUser(refreshResponse.data.user);
                setIsAuthenticated(true);
            } catch (refreshError) {
                localStorage.clear();
                setIsAuthenticated(false);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        checkAuth();
    }, []);
    
    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};
```

### **Vue Pinia Store:**
```javascript
// stores/auth.js
export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        isAuthenticated: false,
        isLoading: false
    }),
    
    actions: {
        async login(credentials) {
            const response = await authAPI.login(credentials);
            const { tokens, user } = response.data;
            
            localStorage.setItem('access_token', tokens.access_token);
            localStorage.setItem('refresh_token', tokens.refresh_token);
            
            this.user = user;
            this.isAuthenticated = true;
        },
        
        async logout() {
            try {
                await authAPI.logout();
            } finally {
                localStorage.clear();
                this.user = null;
                this.isAuthenticated = false;
            }
        },
        
        async initAuth() {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            
            try {
                const response = await authAPI.verify();
                this.user = response.data.user;
                this.isAuthenticated = true;
            } catch (error) {
                await this.attemptRefresh();
            }
        },
        
        async attemptRefresh() {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                this.logout();
                return;
            }
            
            try {
                const response = await authAPI.refresh();
                localStorage.setItem('access_token', response.data.tokens.access_token);
                this.user = response.data.user;
                this.isAuthenticated = true;
            } catch (error) {
                this.logout();
            }
        }
    }
});
```

## ⏱️ Token Expiry & Timing

- **Access Token**: 1800 giây (30 phút)
- **Refresh Token**: 604800 giây (7 ngày)
- **Recommended Refresh**: 5 phút trước khi access token hết hạn

```javascript
// Auto refresh 5 minutes before expiry
const scheduleTokenRefresh = (expiresIn) => {
    const refreshTime = (expiresIn - 300) * 1000; // 5 minutes before
    
    setTimeout(async () => {
        try {
            await refreshToken();
            console.log('Token auto-refreshed successfully');
        } catch (error) {
            console.error('Auto refresh failed:', error);
        }
    }, refreshTime);
};
```

## 🚨 Error Codes Reference

| Code | Description | Action |
|------|-------------|---------|
| `AUTH_TOKEN_MISSING` | No token provided | Redirect to login |
| `AUTH_TOKEN_INVALID` | Invalid JWT token | Try refresh → login |
| `AUTH_TOKEN_EXPIRED` | Access token expired | Try refresh |
| `AUTH_REFRESH_TOKEN_MISSING` | No refresh token | Redirect to login |
| `AUTH_REFRESH_TOKEN_INVALID` | Invalid refresh token | Redirect to login |
| `AUTH_USER_INACTIVE` | User account disabled | Show user blocked message |
| `AUTH_SESSION_EXPIRED` | Session expired | Try refresh → login |

## ✅ Complete Implementation Checklist

### **Backend Ready ✅**
- [x] Login endpoint với full response
- [x] Refresh token endpoint
- [x] Session verification endpoint
- [x] User profile endpoint (`/auth/me`)
- [x] Permissions endpoint
- [x] Logout endpoint
- [x] Proper error handling
- [x] JWT middleware với fallback
- [x] Token expiry management

### **Frontend Implementation**
- [ ] Token storage (localStorage)
- [ ] Axios/Fetch interceptors
- [ ] Auto-refresh logic
- [ ] Session verification on app init
- [ ] Logout functionality
- [ ] Error handling
- [ ] Route protection
- [ ] User state management

## 🎯 Conclusion

Hệ thống đã **SẴN SÀNG HOÀN TOÀN** cho Frontend integration với:

✅ **Complete Authentication Flow**  
✅ **Auto Token Refresh**  
✅ **Session Management**  
✅ **Security Best Practices**  
✅ **Comprehensive Error Handling**  

Frontend chỉ cần implement client-side logic theo guide này để có authentication system hoàn chỉnh!