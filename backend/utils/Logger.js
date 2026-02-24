const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for better readability
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
        service: 'resqmission-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        
        // File transport for combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true
        }),
        
        // Separate file for emergency operations
        new winston.transports.File({
            filename: path.join(logsDir, 'emergency.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 7,
            tailable: true
        })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log')
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log')
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                let log = `${timestamp} [${level}]: ${message}`;
                
                if (Object.keys(meta).length > 0) {
                    log += ` ${JSON.stringify(meta, null, 2)}`;
                }
                
                if (stack) {
                    log += `\n${stack}`;
                }
                
                return log;
            })
        )
    }));
}

// Helper methods for structured logging
const Logger = {
    // General logging
    info: (message, meta = {}) => {
        logger.info(message, meta);
    },
    
    error: (message, error = null, meta = {}) => {
        const errorMeta = {
            ...meta,
            ...(error && {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                }
            })
        };
        logger.error(message, errorMeta);
    },
    
    warn: (message, meta = {}) => {
        logger.warn(message, meta);
    },
    
    debug: (message, meta = {}) => {
        logger.debug(message, meta);
    },
    
    // Emergency-specific logging
    emergency: {
        created: (emergencyId, userId, details) => {
            logger.info(`Emergency created`, {
                type: 'emergency_created',
                emergencyId,
                userId,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        accepted: (emergencyId, providerId, details) => {
            logger.info(`Emergency accepted by provider`, {
                type: 'emergency_accepted',
                emergencyId,
                providerId,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        declined: (emergencyId, providerId, reason) => {
            logger.info(`Emergency declined by provider`, {
                type: 'emergency_declined',
                emergencyId,
                providerId,
                reason,
                timestamp: new Date().toISOString()
            });
        },
        
        statusUpdate: (emergencyId, providerId, status, details) => {
            logger.info(`Emergency status updated`, {
                type: 'emergency_status_update',
                emergencyId,
                providerId,
                status,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        providerContacted: (emergencyId, providerId, success, details) => {
            logger.info(`Provider contacted for emergency`, {
                type: 'provider_contacted',
                emergencyId,
                providerId,
                success,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        noProvidersFound: (emergencyId, location, urgencyLevel) => {
            logger.warn(`No providers found for emergency`, {
                type: 'no_providers_found',
                emergencyId,
                location,
                urgencyLevel,
                timestamp: new Date().toISOString()
            });
        },
        
        processingError: (emergencyId, error, context) => {
            logger.error(`Error processing emergency`, error, {
                type: 'emergency_processing_error',
                emergencyId,
                context,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // Database logging
    database: {
        query: (query, params, duration) => {
            logger.debug(`Database query executed`, {
                type: 'database_query',
                query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
                paramCount: params ? params.length : 0,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            });
        },
        
        error: (query, error, params) => {
            logger.error(`Database query failed`, error, {
                type: 'database_error',
                query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
                params: params ? JSON.stringify(params).substring(0, 500) : null,
                timestamp: new Date().toISOString()
            });
        },
        
        connection: (status, details) => {
            logger.info(`Database connection ${status}`, {
                type: 'database_connection',
                status,
                details,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // Authentication logging
    auth: {
        login: (userId, email, ip) => {
            logger.info(`User logged in`, {
                type: 'auth_login',
                userId,
                email,
                ip,
                timestamp: new Date().toISOString()
            });
        },
        
        logout: (userId, ip) => {
            logger.info(`User logged out`, {
                type: 'auth_logout',
                userId,
                ip,
                timestamp: new Date().toISOString()
            });
        },
        
        failed: (email, ip, reason) => {
            logger.warn(`Authentication failed`, {
                type: 'auth_failed',
                email,
                ip,
                reason,
                timestamp: new Date().toISOString()
            });
        },
        
        tokenRefresh: (userId, ip) => {
            logger.info(`Token refreshed`, {
                type: 'auth_token_refresh',
                userId,
                ip,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // API request logging
    api: {
        request: (method, url, userId, ip, userAgent) => {
            logger.info(`API request received`, {
                type: 'api_request',
                method,
                url,
                userId,
                ip,
                userAgent: userAgent ? userAgent.substring(0, 200) : null,
                timestamp: new Date().toISOString()
            });
        },
        
        response: (method, url, statusCode, duration) => {
            logger.info(`API response sent`, {
                type: 'api_response',
                method,
                url,
                statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            });
        },
        
        error: (method, url, error, userId) => {
            logger.error(`API request failed`, error, {
                type: 'api_error',
                method,
                url,
                userId,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // Performance logging
    performance: {
        slowQuery: (query, duration, params) => {
            logger.warn(`Slow database query detected`, {
                type: 'performance_slow_query',
                query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
                duration: `${duration}ms`,
                paramCount: params ? params.length : 0,
                timestamp: new Date().toISOString()
            });
        },
        
        memoryUsage: (usage) => {
            logger.info(`Memory usage`, {
                type: 'performance_memory',
                ...usage,
                timestamp: new Date().toISOString()
            });
        },
        
        emergencyProcessing: (emergencyId, processingTime, providerCount) => {
            logger.info(`Emergency processing completed`, {
                type: 'performance_emergency_processing',
                emergencyId,
                processingTime: `${processingTime}ms`,
                providerCount,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // Security logging
    security: {
        rateLimit: (ip, endpoint, limit) => {
            logger.warn(`Rate limit exceeded`, {
                type: 'security_rate_limit',
                ip,
                endpoint,
                limit,
                timestamp: new Date().toISOString()
            });
        },
        
        suspiciousActivity: (userId, ip, activity, details) => {
            logger.warn(`Suspicious activity detected`, {
                type: 'security_suspicious',
                userId,
                ip,
                activity,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        unauthorized: (ip, endpoint, userAgent) => {
            logger.warn(`Unauthorized access attempt`, {
                type: 'security_unauthorized',
                ip,
                endpoint,
                userAgent: userAgent ? userAgent.substring(0, 200) : null,
                timestamp: new Date().toISOString()
            });
        }
    },
    
    // System health logging
    health: {
        check: (status, details) => {
            logger.info(`Health check performed`, {
                type: 'health_check',
                status,
                details,
                timestamp: new Date().toISOString()
            });
        },
        
        error: (component, error, details) => {
            logger.error(`Component error`, error, {
                type: 'health_component_error',
                component,
                details,
                timestamp: new Date().toISOString()
            });
        }
    }
};

// Performance monitoring middleware
const createPerformanceMiddleware = () => {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Log request
        Logger.api.request(req.method, req.url, req.decodedAccess?.userId, req.ip, req.get('User-Agent'));
        
        // Override res.end to log response
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const duration = Date.now() - startTime;
            Logger.api.response(req.method, req.url, res.statusCode, duration);
            
            // Log slow requests
            if (duration > 1000) {
                Logger.performance.slowQuery(`${req.method} ${req.url}`, duration, null);
            }
            
            originalEnd.call(this, chunk, encoding);
        };
        
        next();
    };
};

// Error logging middleware
const createErrorMiddleware = () => {
    return (error, req, res, next) => {
        Logger.api.error(req.method, req.url, error, req.decodedAccess?.userId);
        next(error);
    };
};

module.exports = {
    Logger,
    createPerformanceMiddleware,
    createErrorMiddleware,
    winston // Export winston instance for advanced usage
};
