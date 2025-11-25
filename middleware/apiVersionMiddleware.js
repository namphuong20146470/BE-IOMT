// middleware/apiVersionMiddleware.js
/**
 * API Version Middleware for IoMT Backend
 * Handles API versioning and backward compatibility
 */

/**
 * Add version headers to all API responses
 */
export const addVersionHeaders = (req, res, next) => {
    // Add API version to response headers
    res.set({
        'X-API-Version': '1.0.0',
        'X-API-Supported-Versions': 'v1',
        'X-API-Latest-Version': 'v1',
        'X-API-Documentation': '/api-docs'
    });

    // Add version info to response locals for controllers
    res.locals.apiVersion = {
        current: 'v1',
        major: 1,
        minor: 0,
        patch: 0
    };

    next();
};

/**
 * Version validation middleware
 */
export const validateVersion = (supportedVersions = ['v1']) => {
    return (req, res, next) => {
        const requestedVersion = req.params.version || req.headers['x-api-version'];
        
        // Extract version from URL path
        const pathVersion = req.originalUrl.match(/\/api\/(v\d+)/)?.[1];
        
        if (pathVersion && !supportedVersions.includes(pathVersion)) {
            return res.status(400).json({
                success: false,
                message: `API version ${pathVersion} is not supported`,
                supportedVersions,
                latestVersion: supportedVersions[supportedVersions.length - 1]
            });
        }

        // Add version info to request
        req.apiVersion = pathVersion || 'v1';
        
        next();
    };
};

/**
 * Deprecation warning middleware
 */
export const deprecationWarning = (version, deprecatedIn, removedIn) => {
    return (req, res, next) => {
        res.set({
            'X-API-Deprecated': 'true',
            'X-API-Deprecated-In': deprecatedIn,
            'X-API-Removed-In': removedIn,
            'Warning': `299 - "API version ${version} is deprecated. Please migrate to the latest version."`
        });
        
        next();
    };
};

/**
 * Feature flag middleware for version-specific features
 */
export const featureFlag = (featureName, enabledVersions = ['v1']) => {
    return (req, res, next) => {
        const currentVersion = req.apiVersion || 'v1';
        
        if (!enabledVersions.includes(currentVersion)) {
            return res.status(404).json({
                success: false,
                message: `Feature '${featureName}' is not available in API version ${currentVersion}`,
                availableInVersions: enabledVersions
            });
        }
        
        next();
    };
};

/**
 * API version info endpoint
 */
export const getVersionInfo = (req, res) => {
    const versionInfo = {
        current: 'v1',
        supported: ['v1'],
        latest: 'v1',
        changelog: {
            'v1': {
                releaseDate: '2024-11-25',
                changes: [
                    'Initial API version',
                    'PDU Management System',
                    'Outlet Control & Monitoring', 
                    'Device Assignment System',
                    'Feature-based MVC Architecture',
                    'RBAC Permission System'
                ],
                breaking: false
            }
        },
        documentation: '/api-docs',
        status: 'stable'
    };
    
    res.json({
        success: true,
        message: 'API version information',
        data: versionInfo
    });
};

export default {
    addVersionHeaders,
    validateVersion,
    deprecationWarning,
    featureFlag,
    getVersionInfo
};