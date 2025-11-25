// shared/utils/errorHandler.js

/**
 * Custom Application Error class with status codes
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error for debugging
    console.error('Error occurred:', {
        message: err.message,
        statusCode: err.statusCode,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Send error response
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        sendErrorProd(err, res);
    }
};

/**
 * Send detailed error in development
 */
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

/**
 * Send sanitized error in production
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went wrong!'
        });
    }
};

/**
 * Validation error handler
 */
export const handleValidationError = (error) => {
    const errors = Object.values(error.errors).map(val => val.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

/**
 * Database error handlers
 */
export const handleCastErrorDB = (error) => {
    const message = `Invalid ${error.path}: ${error.value}`;
    return new AppError(message, 400);
};

export const handleDuplicateFieldsDB = (error) => {
    const value = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

/**
 * JWT error handlers
 */
export const handleJWTError = () =>
    new AppError('Invalid token. Please log in again!', 401);

export const handleJWTExpiredError = () =>
    new AppError('Your token has expired! Please log in again.', 401);

export default {
    AppError,
    asyncHandler,
    globalErrorHandler,
    handleValidationError,
    handleCastErrorDB,
    handleDuplicateFieldsDB,
    handleJWTError,
    handleJWTExpiredError
};