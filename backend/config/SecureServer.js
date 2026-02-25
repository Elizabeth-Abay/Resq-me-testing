const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const DatabaseManager = require('./DatabaseManager');
const { Logger, createPerformanceMiddleware, createErrorMiddleware } = require('../utils/Logger');
const { generalLimiter } = require('../../backend-start/middleware/rateLimitingMiddleware');

// Import routes
const authRouter = require('../../backend-start/routes/AuthRoute');
const tokenRouter = require('../../backend-start/routes/tokenRoute');
const profileRouter = require('../../backend-start/routes/profileSetter');
const robustEmergencyRouter = require('../../backend-start/routes/robustEmergencyRoutes');

class SecureServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            // Initialize database first
            await DatabaseManager.initialize();
            Logger.info('Database initialized successfully');

            // Setup security middleware
            this.setupSecurity();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            Logger.info('Secure server initialized successfully');
            
        } catch (error) {
            Logger.health.error('server_initialization', error, {
                component: 'SecureServer'
            });
            throw error;
        }
    }

    setupSecurity() {
        // Helmet for security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        }));

        // CORS with proper configuration
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',') 
            : ['http://localhost:3000', 'http://localhost:3001'];

        this.app.use(cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    Logger.security.unauthorized(null, '/cors', origin);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        }));

        // Trust proxy for rate limiting
        this.app.set('trust proxy', 1);
    }

    setupMiddleware() {
        // Compression for better performance
        this.app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
            threshold: 1024,
            level: 6
        }));

        // Body parsing with size limits
        this.app.use(express.json({
            limit: '10mb',
            strict: true,
            type: 'application/json'
        }));

        this.app.use(express.urlencoded({
            extended: true,
            limit: '10mb',
            parameterLimit: 1000
        }));

        // Performance monitoring
        this.app.use(createPerformanceMiddleware());

        // Rate limiting
        this.app.use(generalLimiter);

        // Request ID for tracking
        this.app.use((req, res, next) => {
            req.requestId = require('crypto').randomUUID();
            res.set('X-Request-ID', req.requestId);
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint (no auth required)
        this.app.get('/health', async (req, res) => {
            try {
                const dbHealth = await DatabaseManager.healthCheck();
                const memory = process.memoryUsage();
                const uptime = process.uptime();
                
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
                    memory: {
                        used: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
                        total: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
                        external: `${Math.round(memory.external / 1024 / 1024)}MB`
                    },
                    database: dbHealth,
                    version: process.env.npm_package_version || '1.0.0',
                    environment: process.env.NODE_ENV || 'development'
                };

                res.status(200).json(health);
                
            } catch (error) {
                Logger.health.error('health_check', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // API routes
        this.app.use('/auth', authRouter);
        this.app.use('/token', tokenRouter);
        this.app.use('/profile', profileRouter);
        this.app.use('/emergency', robustEmergencyRouter);

        // API documentation endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'ResQMission API',
                version: '1.0.0',
                description: 'Emergency response system API',
                endpoints: {
                    auth: '/auth',
                    token: '/token',
                    profile: '/profile',
                    emergency: '/emergency',
                    health: '/health'
                },
                documentation: '/api/docs',
                timestamp: new Date().toISOString()
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            Logger.api.request(req.method, req.url, null, req.ip, req.get('User-Agent'));
            res.status(404).json({
                success: false,
                message: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        // Error logging middleware
        this.app.use(createErrorMiddleware());

        // Global error handler
        this.app.use((error, req, res, next) => {
            Logger.api.error(req.method, req.url, error, req.decodedAccess?.userId);

            // Don't leak error details in production
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            const response = {
                success: false,
                message: isDevelopment ? error.message : 'Internal server error',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            };

            if (isDevelopment) {
                response.stack = error.stack;
                response.details = error;
            }

            // Handle specific error types
            if (error.name === 'ValidationError') {
                return res.status(400).json({
                    ...response,
                    message: 'Validation failed',
                    errors: error.details
                });
            }

            if (error.name === 'UnauthorizedError') {
                return res.status(401).json({
                    ...response,
                    message: 'Authentication required'
                });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    ...response,
                    message: 'Invalid token'
                });
            }

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    ...response,
                    message: 'Token expired'
                });
            }

            // Default error response
            const statusCode = error.statusCode || error.status || 500;
            res.status(statusCode).json(response);
        });
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) {
                Logger.warn('Shutdown already in progress');
                return;
            }

            this.isShuttingDown = true;
            Logger.info(`Received ${signal}, starting graceful shutdown...`);

            // Stop accepting new connections
            if (this.server) {
                this.server.close(async () => {
                    Logger.info('HTTP server closed');

                    try {
                        // Close database connections
                        await DatabaseManager.close();
                        Logger.info('Database connections closed');

                        // Close logger
                        Logger.winston.end();
                        
                        process.exit(0);
                    } catch (error) {
                        Logger.error('Error during shutdown', error);
                        process.exit(1);
                    }
                });

                // Force shutdown after 30 seconds
                setTimeout(() => {
                    Logger.error('Forced shutdown due to timeout');
                    process.exit(1);
                }, 30000);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            Logger.health.error('uncaught_exception', error, {
                severity: 'critical'
            });
            shutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            Logger.health.error('unhandled_rejection', new Error(reason), {
                severity: 'critical',
                promise: promise.toString()
            });
            shutdown('unhandledRejection');
        });
    }

    async start() {
        const PORT = process.env.PORT || 3000;
        
        try {
            await this.initialize();
            
            this.server = this.app.listen(PORT, () => {
                Logger.info(`🚀 Secure server started successfully`, {
                    port: PORT,
                    environment: process.env.NODE_ENV || 'development',
                    nodeVersion: process.version,
                    pid: process.pid
                });
                
                console.log(`🚀 Server running on port ${PORT}`);
                console.log(`📊 Health check: http://localhost:${PORT}/health`);
                console.log(`📚 API documentation: http://localhost:${PORT}/api`);
            });

            // Handle server errors
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    Logger.error(`Port ${PORT} is already in use`);
                } else {
                    Logger.health.error('server_error', error);
                }
                process.exit(1);
            });

        } catch (error) {
            Logger.health.error('server_start', error);
            process.exit(1);
        }
    }

    async stop() {
        if (this.isShuttingDown) {
            return;
        }
        
        await this.setupGracefulShutdown();
    }
}

// Create and export server instance
const secureServer = new SecureServer();

module.exports = secureServer;
