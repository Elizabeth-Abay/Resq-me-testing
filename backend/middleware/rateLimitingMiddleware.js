const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');
const DatabaseManager = require('../config/DatabaseManager');

// Redis client for distributed rate limiting
let redisClient = null;

async function initializeRedis() {
    try {
        redisClient = Redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            retry_delay_on_failover: 100,
            enable_offline_queue: false
        });

        await redisClient.connect();
        console.log('Redis client connected for rate limiting');
        return redisClient;
    } catch (error) {
        console.warn('Redis not available, falling back to memory store:', error.message);
        return null;
    }
}

// Initialize Redis on module load
initializeRedis();

// General API rate limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window per IP
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined,
    keyGenerator: (req) => {
        return `rl:general:${req.ip}`;
    }
});

// Emergency creation rate limiter (very strict)
const emergencyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 emergencies per 5 minutes per user
    message: {
        error: 'Too many emergency requests, please wait before creating another.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined,
    keyGenerator: async (req) => {
        // Use user ID if authenticated, otherwise IP
        const userId = req.decodedAccess?.userId;
        return userId ? `rl:emergency:user:${userId}` : `rl:emergency:ip:${req.ip}`;
    },
    skip: (req) => {
        // Skip for health checks and internal routes
        return req.path.includes('/health') || req.path.includes('/internal');
    }
});

// Authentication rate limiter (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined,
    keyGenerator: (req) => {
        // Use email/phone if available, otherwise IP
        const identifier = req.body?.email || req.body?.phone || req.ip;
        return `rl:auth:${identifier}`;
    },
    skipSuccessfulRequests: true
});

// Provider acceptance rate limiter
const providerAcceptLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 acceptances per minute per provider
    message: {
        error: 'Too many acceptance requests, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined,
    keyGenerator: async (req) => {
        const userId = req.decodedAccess?.userId;
        return userId ? `rl:accept:user:${userId}` : `rl:accept:ip:${req.ip}`;
    }
});

// File upload rate limiter
const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // 5 uploads per 10 minutes
    message: {
        error: 'Too many file uploads, please wait before uploading more.',
        retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined,
    keyGenerator: async (req) => {
        const userId = req.decodedAccess?.userId;
        return userId ? `rl:upload:user:${userId}` : `rl:upload:ip:${req.ip}`;
    }
});

// Custom rate limiter for specific endpoints
const createCustomLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: options.max || 100,
        message: options.message || 'Rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
        store: redisClient ? new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args),
        }) : undefined,
        keyGenerator: options.keyGenerator || ((req) => `rl:custom:${req.ip}`)
    });
};

// Rate limit status checker middleware
const rateLimitStatus = (req, res, next) => {
    const limits = {
        general: req.rateLimit?.limit || 100,
        remaining: req.rateLimit?.remaining || 0,
        resetTime: req.rateLimit?.resetTime || null
    };

    res.set({
        'X-RateLimit-Limit': limits.general,
        'X-RateLimit-Remaining': limits.remaining,
        ...(limits.resetTime && { 'X-RateLimit-Reset': new Date(limits.resetTime).toISOString() })
    });

    next();
};

// Dynamic rate limiter based on user tier
const createTieredLimiter = (defaultLimit, premiumLimit, enterpriseLimit) => {
    return async (req, res, next) => {
        try {
            // Get user tier from database
            const userId = req.decodedAccess?.userId;
            let limit = defaultLimit;

            if (userId) {
                const query = `
                    SELECT subscription_tier 
                    FROM user_subscriptions 
                    WHERE user_id = $1 AND is_active = true
                `;
                const result = await DatabaseManager.query(query, [userId]);
                
                const tier = result.rows[0]?.subscription_tier || 'free';
                
                switch (tier) {
                    case 'enterprise':
                        limit = enterpriseLimit;
                        break;
                    case 'premium':
                        limit = premiumLimit;
                        break;
                    default:
                        limit = defaultLimit;
                }
            }

            // Apply the tiered limit
            const tieredLimiter = createCustomLimiter({
                max: limit,
                keyGenerator: (req) => {
                    const userId = req.decodedAccess?.userId;
                    return userId ? `rl:tiered:user:${userId}` : `rl:tiered:ip:${req.ip}`;
                }
            });

            tieredLimiter(req, res, next);

        } catch (error) {
            console.error('Error in tiered rate limiter:', error);
            // Fall back to general limiter
            generalLimiter(req, res, next);
        }
    };
};

module.exports = {
    generalLimiter,
    emergencyLimiter,
    authLimiter,
    providerAcceptLimiter,
    uploadLimiter,
    createCustomLimiter,
    rateLimitStatus,
    createTieredLimiter,
    initializeRedis
};
