const express = require('express');
const RobustEmergencyService = require('../service/RobustEmergencyService');
const { accessValidator } = require('../middleware/TokenValdiator');
const { 
    createEmergencySchema,
    acceptEmergencySchema,
    declineEmergencySchema,
    updateStatusSchema,
    getEmergencyStatusSchema,
    getProviderEmergenciesSchema,
    createValidationMiddleware,
    createParamsValidationMiddleware,
    createQueryValidationMiddleware
} = require('../validators/emergencyValidators');
const { 
    emergencyLimiter,
    providerAcceptLimiter,
    createCustomLimiter,
    rateLimitStatus
} = require('../middleware/rateLimitingMiddleware');
const { Logger, createPerformanceMiddleware, createErrorMiddleware } = require('../utils/Logger');

const router = express.Router();
const emergencyService = new RobustEmergencyService();

// Apply performance monitoring to all routes
router.use(createPerformanceMiddleware());

// Apply error logging middleware
router.use(createErrorMiddleware());

// Apply rate limit status to all responses
router.use(rateLimitStatus);

// User endpoints

// Create emergency request - very strict rate limiting
router.post('/create', 
    accessValidator, 
    emergencyLimiter,
    createValidationMiddleware(createEmergencySchema),
    async (req, res) => {
        try {
            const result = await emergencyService.createEmergencyRequest(req.validatedBody);
            
            if (result.success) {
                Logger.emergency.created(
                    result.data.emergencyId, 
                    req.decodedAccess.userId,
                    result.data
                );
                
                return res.status(201).json({
                    success: true,
                    message: 'Emergency request created successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            Logger.emergency.processingError(null, error, {
                endpoint: '/emergency/create',
                userId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to create emergency request'
            });
        }
    }
);

// Get emergency status
router.get('/status/:emergencyId',
    accessValidator,
    createParamsValidationMiddleware(getEmergencyStatusSchema),
    async (req, res) => {
        try {
            const result = await emergencyService.getEmergencyStatus({
                emergencyId: req.params.emergencyId,
                userId: req.decodedAccess.userId
            });

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    data: result.data
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            Logger.api.error('GET', '/emergency/status/:emergencyId', error, req.decodedAccess?.userId);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve emergency status'
            });
        }
    }
);

// Provider endpoints

// Accept emergency request - rate limited for providers
router.post('/accept',
    accessValidator,
    providerAcceptLimiter,
    createValidationMiddleware(acceptEmergencySchema),
    async (req, res) => {
        try {
            const result = await emergencyService.acceptEmergencyRequest({
                ...req.validatedBody,
                providerId: req.decodedAccess.userId
            });

            if (result.success) {
                Logger.emergency.accepted(
                    result.data.emergencyId,
                    req.decodedAccess.userId,
                    result.data
                );
                
                return res.status(200).json({
                    success: true,
                    message: 'Emergency request accepted successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            Logger.emergency.processingError(null, error, {
                endpoint: '/emergency/accept',
                providerId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to accept emergency request'
            });
        }
    }
);

// Decline emergency request
router.post('/decline',
    accessValidator,
    createCustomLimiter({
        windowMs: 60000, // 1 minute
        max: 20, // 20 declines per minute
        message: 'Too many decline requests, please slow down'
    }),
    createValidationMiddleware(declineEmergencySchema),
    async (req, res) => {
        try {
            const result = await emergencyService.declineEmergencyRequest({
                ...req.validatedBody,
                providerId: req.decodedAccess.userId
            });

            if (result.success) {
                Logger.emergency.declined(
                    result.data.emergencyId,
                    req.decodedAccess.userId,
                    result.data.declineReason
                );
                
                return res.status(200).json({
                    success: true,
                    message: 'Emergency request declined',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            Logger.emergency.processingError(null, error, {
                endpoint: '/emergency/decline',
                providerId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to decline emergency request'
            });
        }
    }
);

// Update emergency status
router.put('/status',
    accessValidator,
    createCustomLimiter({
        windowMs: 30000, // 30 seconds
        max: 30, // 30 status updates per minute
        message: 'Too many status updates, please slow down'
    }),
    createValidationMiddleware(updateStatusSchema),
    async (req, res) => {
        try {
            const result = await emergencyService.updateEmergencyStatus({
                ...req.validatedBody,
                providerId: req.decodedAccess.userId
            });

            if (result.success) {
                Logger.emergency.statusUpdate(
                    result.data.emergencyId,
                    req.decodedAccess.userId,
                    result.data.status,
                    result.data
                );
                
                return res.status(200).json({
                    success: true,
                    message: 'Emergency status updated successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            Logger.emergency.processingError(null, error, {
                endpoint: '/emergency/status',
                providerId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to update emergency status'
            });
        }
    }
);

// Get provider's active emergencies
router.get('/provider/active',
    accessValidator,
    createQueryValidationMiddleware(getProviderEmergenciesSchema),
    async (req, res) => {
        try {
            const result = await emergencyService.getProviderEmergencies({
                providerId: req.decodedAccess.userId,
                ...req.validatedQuery
            });

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            Logger.api.error('GET', '/emergency/provider/active', error, req.decodedAccess?.userId);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve emergency requests'
            });
        }
    }
);

// Admin endpoints (require admin role)

// Get system health status
router.get('/admin/health',
    accessValidator,
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.decodedAccess.role !== 'admin') {
                Logger.security.unauthorized(req.ip, '/emergency/admin/health', req.get('User-Agent'));
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const health = await emergencyService.healthCheck();
            
            return res.status(200).json({
                success: true,
                data: health
            });

        } catch (error) {
            Logger.health.error('admin_health_check', error, {
                userId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve health status'
            });
        }
    }
);

// Get system statistics
router.get('/admin/stats',
    accessValidator,
    createCustomLimiter({
        windowMs: 60000, // 1 minute
        max: 10, // 10 stats requests per minute
        message: 'Too many stats requests, please slow down'
    }),
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.decodedAccess.role !== 'admin') {
                Logger.security.unauthorized(req.ip, '/emergency/admin/stats', req.get('User-Agent'));
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            // Get system statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_emergencies,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emergencies,
                    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_emergencies,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_emergencies,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as emergencies_last_24h,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as emergencies_last_7d
                FROM emergency_requests
            `;

            const providerStatsQuery = `
                SELECT 
                    COUNT(DISTINCT sp.service_provider_id) as total_providers,
                    COUNT(CASE WHEN sp.is_available = true THEN 1 END) as available_providers,
                    AVG(spp.average_rating) as avg_rating,
                    AVG(spp.response_rate) as avg_response_rate
                FROM service_provider_profile sp
                LEFT JOIN service_provider_profile spp ON sp.service_provider_id = spp.service_provider_id
            `;

            const [emergencyStats, providerStats] = await Promise.all([
                DatabaseManager.query(statsQuery),
                DatabaseManager.query(providerStatsQuery)
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    emergencies: emergencyStats.rows[0],
                    providers: providerStats.rows[0],
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            Logger.health.error('admin_stats', error, {
                userId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve system statistics'
            });
        }
    }
);

// Dead letter queue management
router.get('/admin/dead-letter-queue',
    accessValidator,
    createQueryValidationMiddleware({
        query: Joi.object({
            status: Joi.string().valid('pending', 'processing', 'processed', 'failed').optional(),
            limit: Joi.number().integer().min(1).max(100).default(20),
            offset: Joi.number().integer().min(0).default(0)
        })
    }),
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.decodedAccess.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { status, limit, offset } = req.validatedQuery;
            
            let whereClause = '';
            const queryParams = [];
            let paramIndex = 1;

            if (status) {
                whereClause += `WHERE status = $${paramIndex}`;
                queryParams.push(status);
                paramIndex++;
            }

            const query = `
                SELECT 
                    id,
                    provider_id,
                    emergency_id,
                    error_message,
                    retry_count,
                    max_retries,
                    next_retry_at,
                    created_at,
                    processed_at,
                    status
                FROM emergency_dead_letter_queue
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            queryParams.push(limit, offset);
            const result = await DatabaseManager.query(query, queryParams);

            return res.status(200).json({
                success: true,
                data: result.rows,
                pagination: {
                    limit,
                    offset,
                    count: result.rows.length
                }
            });

        } catch (error) {
            Logger.health.error('admin_dead_letter_queue', error, {
                userId: req.decodedAccess?.userId
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve dead letter queue'
            });
        }
    }
);

module.exports = router;
