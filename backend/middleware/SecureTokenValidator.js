const jwt = require('jsonwebtoken');
const { Logger } = require('../utils/Logger');
const DatabaseManager = require('../config/DatabaseManager');

class SecureTokenValidator {
    constructor() {
        this.accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
        this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
        this.tokenBlacklist = new Set(); // In production, use Redis
        this.rateLimitMap = new Map(); // Simple rate limiting for token validation
    }

    // Enhanced access token validator
    async accessValidator(req, res, next) {
        try {
            const authHeader = req.headers['authorization'];
            
            if (!authHeader) {
                Logger.security.unauthorized(req.ip, req.path, req.get('User-Agent'));
                return res.status(401).json({ 
                    success: false,
                    message: 'Authorization header required',
                    code: 'AUTH_HEADER_MISSING'
                });
            }

            if (!authHeader.startsWith('Bearer ')) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid authorization format', {
                    header: authHeader.substring(0, 20) + '...'
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid authorization format',
                    code: 'INVALID_AUTH_FORMAT'
                });
            }

            const token = authHeader.substring(7);
            
            // Check token length (basic validation)
            if (token.length < 10 || token.length > 500) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid token length', {
                    length: token.length
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token',
                    code: 'INVALID_TOKEN_LENGTH'
                });
            }

            // Rate limiting for token validation attempts
            const clientKey = `${req.ip}:${token.substring(0, 10)}`;
            const now = Date.now();
            const rateLimitWindow = 60000; // 1 minute
            const maxAttempts = 100;

            if (this.rateLimitMap.has(clientKey)) {
                const attempts = this.rateLimitMap.get(clientKey);
                const recentAttempts = attempts.filter(time => now - time < rateLimitWindow);
                
                if (recentAttempts.length >= maxAttempts) {
                    Logger.security.rateLimit(req.ip, '/token-validation', maxAttempts);
                    return res.status(429).json({ 
                        success: false,
                        message: 'Too many token validation attempts',
                        code: 'RATE_LIMIT_EXCEEDED'
                    });
                }
                
                this.rateLimitMap.set(clientKey, [...recentAttempts, now]);
            } else {
                this.rateLimitMap.set(clientKey, [now]);
            }

            // Check if token is blacklisted
            if (this.tokenBlacklist.has(token)) {
                Logger.security.suspiciousActivity(null, req.ip, 'Blacklisted token used', {
                    token: token.substring(0, 20) + '...'
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Token has been revoked',
                    code: 'TOKEN_REVOKED'
                });
            }

            // Verify JWT
            const decoded = jwt.verify(token, this.accessTokenSecret, {
                algorithms: ['HS256'],
                clockTolerance: 30 // Allow 30 seconds clock skew
            });

            // Validate token structure
            if (!decoded.userId || !decoded.exp || !decoded.iat) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid token structure', {
                    decoded: Object.keys(decoded)
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token structure',
                    code: 'INVALID_TOKEN_STRUCTURE'
                });
            }

            // Check token expiration (additional check)
            const currentTime = Math.floor(Date.now() / 1000);
            if (decoded.exp < currentTime) {
                Logger.security.suspiciousActivity(null, req.ip, 'Expired token used', {
                    userId: decoded.userId,
                    exp: decoded.exp,
                    now: currentTime
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }

            // Check if token was issued in the future (clock skew attack)
            if (decoded.iat > currentTime + 300) { // Allow 5 minutes future
                Logger.security.suspiciousActivity(null, req.ip, 'Future-dated token', {
                    userId: decoded.userId,
                    iat: decoded.iat,
                    now: currentTime
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token issue time',
                    code: 'FUTURE_TOKEN'
                });
            }

            // Verify user exists and is active
            const userCheckQuery = `
                SELECT id, email, phone_number, is_active, role, last_login
                FROM verified_users 
                WHERE id = $1 AND is_active = true
            `;
            
            const userResult = await DatabaseManager.query(userCheckQuery, [decoded.userId]);
            
            if (userResult.rows.length === 0) {
                Logger.security.suspiciousActivity(null, req.ip, 'Token for non-existent user', {
                    userId: decoded.userId
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'User not found or inactive',
                    code: 'USER_NOT_FOUND'
                });
            }

            const user = userResult.rows[0];

            // Add user info to request
            req.decodedAccess = {
                ...decoded,
                email: user.email,
                phone: user.phone_number,
                role: user.role,
                lastLogin: user.last_login
            };

            // Log successful authentication
            Logger.auth.tokenRefresh(decoded.userId, req.ip);

            next();

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid JWT token', {
                    error: error.message
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token',
                    code: 'INVALID_JWT'
                });
            }

            if (error.name === 'TokenExpiredError') {
                Logger.security.suspiciousActivity(null, req.ip, 'Expired JWT token', {
                    error: error.message
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired',
                    code: 'JWT_EXPIRED'
                });
            }

            Logger.health.error('token_validation', error, {
                ip: req.ip,
                path: req.path
            });

            return res.status(500).json({ 
                success: false,
                message: 'Token validation failed',
                code: 'VALIDATION_ERROR'
            });
        }
    }

    // Enhanced refresh token validator
    async refreshValidator(req, res, next) {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                Logger.security.unauthorized(req.ip, req.path, req.get('User-Agent'));
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token required',
                    code: 'REFRESH_TOKEN_MISSING'
                });
            }

            // Basic token validation
            if (refreshToken.length < 10 || refreshToken.length > 500) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid refresh token length', {
                    length: refreshToken.length
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid refresh token',
                    code: 'INVALID_REFRESH_TOKEN_LENGTH'
                });
            }

            // Check if refresh token is blacklisted
            if (this.tokenBlacklist.has(refreshToken)) {
                Logger.security.suspiciousActivity(null, req.ip, 'Blacklisted refresh token used', {
                    token: refreshToken.substring(0, 20) + '...'
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token has been revoked',
                    code: 'REFRESH_TOKEN_REVOKED'
                });
            }

            // Verify JWT
            const decoded = jwt.verify(refreshToken, this.refreshTokenSecret, {
                algorithms: ['HS256'],
                clockTolerance: 30
            });

            // Validate refresh token structure
            if (!decoded.randomString || !decoded.exp || !decoded.iat) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid refresh token structure', {
                    decoded: Object.keys(decoded)
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid refresh token structure',
                    code: 'INVALID_REFRESH_TOKEN_STRUCTURE'
                });
            }

            // Check expiration
            const currentRefreshTime = Math.floor(Date.now() / 1000);
            if (decoded.exp < currentRefreshTime) {
                Logger.security.suspiciousActivity(null, req.ip, 'Expired refresh token used', {
                    exp: decoded.exp,
                    now: currentRefreshTime
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token expired',
                    code: 'REFRESH_TOKEN_EXPIRED'
                });
            }

            // Verify refresh token exists in database and is valid
            const tokenCheckQuery = `
                SELECT rt.id, rt.user_id, rt.is_valid, vu.email, vu.is_active
                FROM refresh_token rt
                JOIN verified_users vu ON rt.user_id = vu.id
                WHERE rt.random_string_hashed = $1
            `;
            
            const crypto = require('crypto');
            const hashedToken = crypto.createHash('sha-256').update(decoded.randomString).digest('hex');
            
            const tokenResult = await DatabaseManager.query(tokenCheckQuery, [hashedToken]);
            
            if (tokenResult.rows.length === 0) {
                Logger.security.suspiciousActivity(null, req.ip, 'Refresh token not found in database', {
                    tokenHash: hashedToken.substring(0, 20) + '...'
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token not found',
                    code: 'REFRESH_TOKEN_NOT_FOUND'
                });
            }

            const tokenData = tokenResult.rows[0];

            if (!tokenData.is_valid || !tokenData.is_active) {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid refresh token used', {
                    userId: tokenData.user_id,
                    tokenValid: tokenData.is_valid,
                    userActive: tokenData.is_active
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token invalid',
                    code: 'REFRESH_TOKEN_INVALID'
                });
            }

            // Invalidate the used refresh token (one-time use)
            await DatabaseManager.query(`
                UPDATE refresh_token 
                SET is_valid = false 
                WHERE id = $1
            `, [tokenData.id]);

            // Add decoded data to request
            req.body = {
                ...decoded,
                userId: tokenData.user_id,
                email: tokenData.email
            };

            Logger.auth.tokenRefresh(tokenData.user_id, req.ip);
            next();

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                Logger.security.suspiciousActivity(null, req.ip, 'Invalid refresh JWT', {
                    error: error.message
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid refresh token',
                    code: 'INVALID_REFRESH_JWT'
                });
            }

            if (error.name === 'TokenExpiredError') {
                Logger.security.suspiciousActivity(null, req.ip, 'Expired refresh JWT', {
                    error: error.message
                });
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token expired',
                    code: 'REFRESH_JWT_EXPIRED'
                });
            }

            Logger.health.error('refresh_token_validation', error, {
                ip: req.ip,
                path: req.path
            });

            return res.status(500).json({ 
                success: false,
                message: 'Refresh token validation failed',
                code: 'REFRESH_VALIDATION_ERROR'
            });
        }
    }

    // Method to blacklist a token
    blacklistToken(token) {
        this.tokenBlacklist.add(token);
        
        // Clean up old tokens periodically (keep only last 10000)
        if (this.tokenBlacklist.size > 10000) {
            const tokens = Array.from(this.tokenBlacklist);
            this.tokenBlacklist.clear();
            tokens.slice(-5000).forEach(token => this.tokenBlacklist.add(token));
        }
    }

    // Method to clean up rate limiting map
    cleanupRateLimit() {
        const now = Date.now();
        const cutoff = now - 300000; // 5 minutes ago
        
        for (const [key, attempts] of this.rateLimitMap) {
            const recentAttempts = attempts.filter(time => time > cutoff);
            if (recentAttempts.length === 0) {
                this.rateLimitMap.delete(key);
            } else {
                this.rateLimitMap.set(key, recentAttempts);
            }
        }
    }

    // Get statistics
    getStats() {
        return {
            blacklistedTokens: this.tokenBlacklist.size,
            rateLimitEntries: this.rateLimitMap.size,
            memoryUsage: process.memoryUsage()
        };
    }
}

// Create singleton instance
const secureTokenValidator = new SecureTokenValidator();

// Clean up rate limiting map periodically
setInterval(() => {
    secureTokenValidator.cleanupRateLimit();
}, 300000); // Every 5 minutes

module.exports = secureTokenValidator;
