const RobustEmergencyNotificationService = require('../service/RobustEmergencyNotificationService');
const { Logger } = require('../utils/Logger');
const DatabaseManager = require('./DatabaseManager');

class RobustEmergencyListener {
    constructor() {
        this.emergencyService = null;
        this.isRunning = false;
        this.healthCheckInterval = null;
        this.statsInterval = null;
        this.shutdownGracefully = false;
    }

    async start() {
        try {
            Logger.info('Starting Robust Emergency Notification Listener...');
            
            // Initialize database
            await DatabaseManager.initialize();
            
            // Initialize emergency service
            this.emergencyService = new RobustEmergencyNotificationService();
            await this.emergencyService.initialize();
            
            // Set up event listeners with proper logging
            this.setupEventListeners();
            
            // Start listening for notifications
            await this.emergencyService.startListening();
            this.isRunning = true;
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Start stats reporting
            this.startStatsReporting();
            
            Logger.info('✅ Robust Emergency Notification Listener started successfully', {
                listeners: this.emergencyService.listeners.length,
                maxListeners: this.emergencyService.maxListeners
            });
            
            return true;
            
        } catch (error) {
            Logger.health.error('emergency_listener', error, {
                component: 'RobustEmergencyListener',
                action: 'start'
            });
            throw error;
        }
    }

    setupEventListeners() {
        // Emergency request received
        this.emergencyService.on('emergency_request', (data) => {
            Logger.emergency.created(data.emergency_id, data.user_id, {
                location: `${data.latitude}, ${data.longitude}`,
                urgencyLevel: data.urgency_level,
                healthState: data.health_state,
                timestamp: data.created_at
            });
        });

        // Emergency processed
        this.emergencyService.on('emergency_processed', (data) => {
            Logger.emergency.statusUpdate(data.emergencyId, null, 'processed', {
                providerCount: data.providerCount,
                successfulContacts: data.successfulContacts,
                failedContacts: data.failedContacts
            });
        });

        // Provider contacted
        this.emergencyService.on('provider_contacted', (data) => {
            Logger.emergency.providerContacted(data.emergencyId, data.providerId, data.success, {
                responseTime: data.responseTime,
                retryCount: data.retryCount
            });
        });

        // Service errors
        this.emergencyService.on('error', (error) => {
            Logger.health.error('emergency_service', error.error, {
                listenerId: error.listenerId,
                emergencyId: error.emergencyId,
                component: 'EmergencyNotificationService'
            });
        });

        // Critical errors
        this.emergencyService.on('critical_error', (error) => {
            Logger.health.error('emergency_listener_critical', error.error, {
                component: 'EmergencyNotificationService',
                severity: 'critical'
            });
            
            // Attempt recovery
            this.handleCriticalError(error);
        });

        // Heartbeat events
        this.emergencyService.on('heartbeat', (data) => {
            Logger.debug('Emergency listener heartbeat', {
                activeListeners: data.activeListeners,
                totalListeners: data.totalListeners,
                processingQueue: data.processingQueue
            });
        });
    }

    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.emergencyService.isHealthy();
                
                Logger.health.check(health.status, {
                    listeners: health.listeners,
                    processing: health.processing,
                    database: health.database
                });

                // If unhealthy, attempt recovery
                if (health.status !== 'healthy') {
                    Logger.warn('Emergency listener health check failed, attempting recovery', {
                        health
                    });
                    await this.attemptRecovery();
                }

            } catch (error) {
                Logger.health.error('health_check', error, {
                    component: 'RobustEmergencyListener'
                });
            }
        }, 30000); // Check every 30 seconds
    }

    startStatsReporting() {
        this.statsInterval = setInterval(() => {
            try {
                const stats = this.emergencyService.getStats();
                
                Logger.performance.memoryUsage({
                    component: 'EmergencyListener',
                    listeners: stats.listeners.length,
                    processingQueue: stats.processingQueue.length,
                    eventListeners: stats.eventListenerCount,
                    maxListeners: stats.maxListeners
                });

            } catch (error) {
                Logger.error('Error collecting stats', error);
            }
        }, 60000); // Report every minute
    }

    async attemptRecovery() {
        try {
            Logger.info('Attempting emergency listener recovery...');
            
            // Check if service is still running
            if (!this.emergencyService || !this.isRunning) {
                Logger.warn('Emergency service not running, restarting...');
                await this.restart();
                return;
            }

            // Check listener health
            const stats = this.emergencyService.getStats();
            const activeListeners = stats.listeners.filter(l => l.isActive).length;
            
            if (activeListeners === 0) {
                Logger.warn('No active listeners found, restarting service...');
                await this.restart();
                return;
            }

            // Check processing queue for stuck items
            const now = Date.now();
            for (const [emergencyId, info] of stats.processingQueue) {
                const processingTime = now - info.startTime;
                if (processingTime > 300000) { // 5 minutes
                    Logger.warn(`Emergency ${emergencyId} stuck in processing queue`, {
                        processingTime: `${processingTime}ms`,
                        listenerId: info.listenerId
                    });
                    
                    // Remove from queue and retry
                    this.emergencyService.processingQueue.delete(emergencyId);
                }
            }

        } catch (error) {
            Logger.error('Recovery attempt failed', error);
        }
    }

    async restart() {
        try {
            Logger.info('Restarting emergency notification service...');
            
            // Stop current service
            if (this.emergencyService) {
                await this.emergencyService.stop();
            }
            
            // Wait a bit before restarting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Create new service instance
            this.emergencyService = new RobustEmergencyNotificationService();
            await this.emergencyService.initialize();
            this.setupEventListeners();
            await this.emergencyService.startListening();
            
            Logger.info('Emergency notification service restarted successfully');
            
        } catch (error) {
            Logger.error('Failed to restart emergency service', error);
        }
    }

    handleCriticalError(error) {
        Logger.error('Critical error in emergency listener', error.error, {
            component: 'RobustEmergencyListener',
            severity: 'critical'
        });

        // Implement circuit breaker pattern
        if (error.error.message?.includes('Max reconnection attempts reached')) {
            Logger.warn('Circuit breaker activated - service temporarily disabled');
            // Could implement exponential backoff here
        }
    }

    async stop() {
        if (this.shutdownGracefully) {
            return; // Already shutting down
        }

        this.shutdownGracefully = true;
        
        try {
            Logger.info('Shutting down Robust Emergency Notification Listener...');
            
            // Clear intervals
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
            }
            
            // Stop emergency service
            if (this.emergencyService) {
                await this.emergencyService.stop();
            }
            
            this.isRunning = false;
            
            Logger.info('Robust Emergency Notification Listener stopped successfully');
            
        } catch (error) {
            Logger.error('Error during shutdown', error);
        }
    }

    // Graceful shutdown handling
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            Logger.info(`Received ${signal}, shutting down emergency listener...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
    }

    // Health check endpoint
    async getHealthStatus() {
        try {
            const serviceHealth = await this.emergencyService.isHealthy();
            const dbHealth = await DatabaseManager.healthCheck();
            
            return {
                status: this.isRunning && serviceHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                service: serviceHealth,
                database: dbHealth,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get detailed statistics
    getDetailedStats() {
        if (!this.emergencyService) {
            return null;
        }

        return {
            service: this.emergencyService.getStats(),
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                nodeVersion: process.version,
                platform: process.platform
            },
            health: {
                isRunning: this.isRunning,
                shutdownGracefully: this.shutdownGracefully,
                healthCheckInterval: !!this.healthCheckInterval,
                statsInterval: !!this.statsInterval
            }
        };
    }
}

// Create singleton instance
const robustEmergencyListener = new RobustEmergencyListener();

// Set up graceful shutdown
robustEmergencyListener.setupGracefulShutdown();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    Logger.health.error('uncaught_exception', error, {
        component: 'RobustEmergencyListener',
        severity: 'critical'
    });
    robustEmergencyListener.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.health.error('unhandled_rejection', new Error(reason), {
        component: 'RobustEmergencyListener',
        severity: 'critical',
        promise: promise.toString()
    });
});

module.exports = robustEmergencyListener;
