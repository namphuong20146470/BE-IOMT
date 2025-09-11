// Token Test Endpoints
// Add to actLog.js routes

// Test token endpoint - Add this to your actLog.js
router.get('/auth/test', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// Decode token without verification (for debugging)
router.get('/auth/decode', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(400).json({ 
            success: false, 
            message: 'No authorization header' 
        });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'No token provided' 
        });
    }

    try {
        // Decode without verification to see payload
        const decoded = jwt.decode(token);
        
        res.json({
            success: true,
            decoded: decoded,
            token_type: decoded.username ? 'users_v2' : 'users_v1',
            expires_at: new Date(decoded.exp * 1000).toISOString(),
            issued_at: new Date(decoded.iat * 1000).toISOString()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Invalid token format',
            error: error.message
        });
    }
});
