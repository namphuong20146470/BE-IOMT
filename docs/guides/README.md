# 📖 Development Guides

## 📋 Tổng Quan

Thư mục này chứa các hướng dẫn phát triển và tích hợp cho hệ thống IoMT.

## 📁 Nội Dung

### 🔐 Frontend Authentication
- [`FRONTEND_AUTHENTICATION_GUIDE.md`](FRONTEND_AUTHENTICATION_GUIDE.md) - Hướng dẫn tích hợp xác thực frontend

### ⚡ Real-time Integration  
- [`FRONTEND_REALTIME_INTEGRATION.md`](FRONTEND_REALTIME_INTEGRATION.md) - Tích hợp Socket.IO và real-time features

### 🏥 Device & Room Management
- [`DEVICE_ROOMS_FRONTEND_GUIDE.md`](DEVICE_ROOMS_FRONTEND_GUIDE.md) - Hướng dẫn quản lý thiết bị và phòng

### 🔧 Technical Specifications
- [`SPECIFICATIONS_JSONB_GUIDE.md`](SPECIFICATIONS_JSONB_GUIDE.md) - Sử dụng JSONB specifications

## 🚀 Quick Start Guides

### **1. Frontend Setup**
```bash
# Clone frontend repository
git clone https://github.com/your-org/iomt-frontend.git

# Install dependencies  
npm install

# Configure environment
cp .env.example .env
# Edit .env với backend URL và settings

# Start development server
npm run dev
```

### **2. Authentication Integration**
```javascript
// 1. Setup auth context
import { AuthProvider } from './contexts/AuthContext';

// 2. Configure API client
const apiClient = axios.create({
  baseURL: 'http://localhost:3030',
  withCredentials: true // For HttpOnly cookies
});

// 3. Add token interceptor
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### **3. Real-time Connection**
```javascript
// Setup Socket.IO connection
import io from 'socket.io-client';

const socket = io('http://localhost:3030', {
  withCredentials: true,
  autoConnect: false
});

// Authenticate before connecting
socket.auth = { token: getAuthToken() };
socket.connect();

// Listen for device updates
socket.on('device:updated', (data) => {
  updateDeviceInUI(data);
});
```

## 🛠️ Development Workflow

### **Branch Strategy**
```
main (production)
├── develop (integration)
├── feature/auth-improvements
├── feature/device-management
├── hotfix/security-patch
└── release/v2.1.0
```

### **Commit Convention**
```
feat: thêm device management API
fix: sửa lỗi authentication middleware  
docs: cập nhật API documentation
style: format code theo ESLint rules
refactor: tách auth logic thành service
test: thêm unit tests cho device controller
chore: cập nhật dependencies
```

### **Pull Request Process**
1. **Create branch** từ `develop`
2. **Implement feature** với tests
3. **Update documentation** nếu cần
4. **Run security checks** và quality gates
5. **Create PR** với detailed description
6. **Code review** từ 2+ team members
7. **Merge** sau khi pass all checks

## 📚 Architecture Overview

### **Backend Structure**
```
backend/
├── features/           # Feature-based modules
│   ├── auth/          # Authentication system
│   ├── devices/       # Device management  
│   ├── users/         # User management
│   └── organizations/ # Organization module
├── middleware/        # Express middleware
├── services/          # Business logic
├── utils/            # Helper functions
└── config/           # Configuration files
```

### **Frontend Structure**  
```
frontend/
├── src/
│   ├── components/    # Reusable UI components
│   ├── pages/        # Route components
│   ├── contexts/     # React contexts (auth, theme)
│   ├── hooks/        # Custom React hooks
│   ├── services/     # API services
│   ├── utils/        # Helper functions
│   └── types/        # TypeScript definitions
├── public/           # Static assets
└── docs/            # Component documentation
```

## 🧪 Testing Strategy

### **Backend Testing**
```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# API tests
npm run test:api

# Security tests
npm run test:security

# All tests
npm test
```

### **Frontend Testing**
```bash
# Component tests
npm run test:components

# E2E tests
npm run test:e2e

# Accessibility tests
npm run test:a11y

# Performance tests
npm run test:lighthouse
```

## 🔧 Configuration Management

### **Environment Variables**
```bash
# Development
NODE_ENV=development
API_URL=http://localhost:3030
SOCKET_URL=http://localhost:3030
DEBUG_MODE=true

# Production  
NODE_ENV=production
API_URL=https://api.iomt.com
SOCKET_URL=wss://api.iomt.com
DEBUG_MODE=false
```

### **Feature Flags**
```javascript
const features = {
  ADVANCED_ANALYTICS: process.env.NODE_ENV !== 'production',
  DEVICE_AUTOMATION: true,
  REAL_TIME_NOTIFICATIONS: true,
  EXPERIMENTAL_UI: false
};
```

## 🚀 Deployment Guide

### **Development Deployment**
```bash
# Build application
npm run build

# Run database migrations
npm run migrate

# Start application
npm run start
```

### **Production Deployment**
```bash
# Build optimized version
npm run build:prod

# Run security audit
npm audit --audit-level moderate

# Deploy with PM2
pm2 start ecosystem.config.js --env production

# Setup monitoring
pm2 monitor
```

## 📊 Performance Guidelines

### **Backend Performance**
- API response time: **<200ms average**
- Database queries: **<100ms average**
- Memory usage: **<512MB per instance**
- CPU usage: **<70% average**

### **Frontend Performance**  
- First Contentful Paint: **<1.5s**
- Largest Contentful Paint: **<2.5s**
- Cumulative Layout Shift: **<0.1**
- Time to Interactive: **<3.5s**

## 📱 Mobile Development

### **React Native Setup**
```bash
# Install React Native CLI
npm install -g react-native-cli

# Create new project
react-native init IoMTMobile

# Link native dependencies
cd IoMTMobile && npx react-native link
```

### **Mobile-Specific Considerations**
- **Offline support** với local storage
- **Push notifications** cho alerts
- **Biometric authentication** cho security
- **Camera integration** cho QR code scanning

## 🔗 Integration Patterns

### **Third-party Services**
- **Email Service**: Nodemailer với SMTP
- **SMS Service**: Twilio API
- **File Storage**: AWS S3 hoặc local storage
- **Monitoring**: PM2, New Relic, Sentry

### **API Integration Examples**
```javascript
// Hospital Information System (HIS)
const HISClient = {
  async getPatientData(patientId) {
    return await apiClient.get(`/his/patients/${patientId}`);
  },
  
  async updateDeviceStatus(deviceId, status) {
    return await apiClient.patch(`/his/devices/${deviceId}`, { status });
  }
};

// Laboratory Information System (LIS)  
const LISClient = {
  async getLabResults(orderId) {
    return await apiClient.get(`/lis/orders/${orderId}/results`);
  }
};
```

---

## 📞 Development Support

### **Team Contacts**
- **Technical Lead**: `tech-lead@iomt.com`
- **DevOps**: `devops@iomt.com`  
- **QA Team**: `qa@iomt.com`
- **UI/UX**: `design@iomt.com`

### **Resources**
- **Code Standards**: `/wiki/coding-standards`
- **API Documentation**: `/docs/api/`
- **Design System**: `/design-system/`
- **Deployment Guide**: `/docs/deployment/`

---

*Last updated: November 2024*  
*Target audience: Developers, Technical Leads, DevOps*