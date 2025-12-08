import { authMiddleware } from './authMiddleware.js';
import rateLimit from 'express-rate-limit';

/**
 * 🔐 Swagger UI Security Middleware
 * Bảo mật tài liệu API với nhiều lớp bảo vệ
 */

/**
 * 1. 🚫 Kiểm tra môi trường - Không cho phép truy cập Swagger trên production
 */
export const checkEnvironment = (req, res, next) => {
    // Chỉ cho phép truy cập Swagger trên development và staging
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SWAGGER_PRODUCTION) {
        return res.status(404).json({
            success: false,
            message: 'API documentation not available',
            code: 'DOCS_NOT_AVAILABLE'
        });
    }
    next();
};

/**
 * 2. 🛡️ Xác thực người dùng - Yêu cầu đăng nhập (với URL token support)
 */
export const requireAuthentication = authMiddleware;

/**
 * 2.1 🚪 Swagger-specific authentication với better error messages
 */
export const swaggerAuthentication = async (req, res, next) => {
    try {
        // Sử dụng authMiddleware để verify token
        await new Promise((resolve, reject) => {
            authMiddleware(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log(`✅ Swagger authentication success: ${req.user?.username}`);
        next();
        
    } catch (error) {
        console.log('🚫 Swagger authentication failed:', error.message);
        
        // Trả về response thân thiện hơn cho Swagger UI
        return res.status(401).json({
            success: false,
            message: 'Authentication required to access API documentation',
            code: 'AUTH_REQUIRED',
            hint: 'Please login first and use one of these methods:\n' +
                  '1. Add ?token=Bearer_<your-jwt-token> to URL\n' +
                  '2. Use Authorization header: Bearer <your-jwt-token>\n' +
                  '3. Login at /auth/login to get a token',
            login_url: '/auth/login',
            examples: {
                url_method: '/secure-api-docs?token=Bearer_<your-token>',
                header_method: 'Authorization: Bearer <your-token>'
            }
        });
    }
};

/**
 * 3. 🔑 Kiểm tra quyền truy cập tài liệu API
 */
export const requireDocPermission = (req, res, next) => {
    const user = req.user;
    
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required to access API documentation',
            code: 'AUTH_REQUIRED'
        });
    }

    // Kiểm tra quyền truy cập tài liệu
    const allowedRoles = ['super_admin', 'admin', 'developer', 'api_user'];
    const userRoles = user.roles?.map(r => r.name) || [];
    
    const hasAccess = userRoles.some(role => allowedRoles.includes(role)) ||
                     user.permissions?.includes('view_api_docs') ||
                     user.permissions?.includes('system_admin');

    if (!hasAccess) {
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to access API documentation',
            code: 'DOCS_ACCESS_DENIED',
            hint: 'Required roles: super_admin, admin, developer, or api_user'
        });
    }

    console.log(`✅ Swagger access granted to: ${user.username} (${userRoles.join(', ')})`);
    next();
};

/**
 * 4. ⏰ Rate limiting cho Swagger UI
 */
export const swaggerRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Giới hạn 100 requests per 15 phút
    message: {
        success: false,
        message: 'Too many requests to API documentation. Please try again later.',
        code: 'DOCS_RATE_LIMITED',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
    // Bỏ keyGenerator để tránh lỗi IPv6 validation
});

/**
 * 5. 🕐 Giới hạn thời gian truy cập (chỉ trong giờ làm việc)
 */
export const businessHoursOnly = (req, res, next) => {
    // Chỉ áp dụng nếu cấu hình SWAGGER_BUSINESS_HOURS_ONLY=true
    if (process.env.SWAGGER_BUSINESS_HOURS_ONLY !== 'true') {
        return next();
    }

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Thứ 2-6, 8h-18h
    const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 8 && hour < 18);

    if (!isBusinessHours) {
        return res.status(403).json({
            success: false,
            message: 'API documentation access is restricted to business hours (Mon-Fri, 8AM-6PM)',
            code: 'DOCS_RESTRICTED_HOURS',
            hint: 'Contact administrator for after-hours access'
        });
    }

    next();
};

/**
 * 6. 📊 Audit logging cho việc truy cập Swagger
 */
export const auditSwaggerAccess = (req, res, next) => {
    const user = req.user;
    
    console.log('📚 Swagger UI Access:', {
        timestamp: new Date().toISOString(),
        user: user?.username || 'anonymous',
        user_id: user?.id,
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        path: req.path
    });

    // Có thể lưu vào database audit log nếu cần
    // await auditService.log('swagger_access', { user_id: user.id, ... });

    next();
};

/**
 * 7. 🔒 IP Whitelist (tùy chọn)
 */
export const ipWhitelist = (req, res, next) => {
    const allowedIPs = process.env.SWAGGER_ALLOWED_IPS?.split(',') || [];
    
    if (allowedIPs.length === 0) {
        return next(); // Không có IP whitelist
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
        console.warn(`🚫 Swagger access blocked for IP: ${clientIP}`);
        return res.status(403).json({
            success: false,
            message: 'Access denied from this IP address',
            code: 'IP_NOT_ALLOWED'
        });
    }

    next();
};

/**
 * 🛡️ Tổng hợp middleware bảo mật cho Swagger UI
 */
export const swaggerSecurityMiddleware = [
    checkEnvironment,          // 1. Kiểm tra môi trường
    ipWhitelist,              // 2. IP whitelist (nếu có)
    swaggerRateLimit,         // 3. Rate limiting
    swaggerAuthentication,     // 4. Yêu cầu đăng nhập (Swagger-specific)
    requireDocPermission,     // 5. Kiểm tra quyền
    businessHoursOnly,        // 6. Giới hạn thời gian (tùy chọn)
    auditSwaggerAccess        // 7. Ghi log truy cập
];

export default swaggerSecurityMiddleware;