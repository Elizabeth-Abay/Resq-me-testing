const EmergencyNotificationService = require('../service/EmergencyNotificationService');

class EmergencyListener {
    constructor() {
        this.emergencyService = null;
        this.isRunning = false;
    }

    async start() {
        try {
            console.log('Starting Emergency Notification Listener...');
            
            this.emergencyService = new EmergencyNotificationService();
            await this.emergencyService.initialize();
            
            // Set up event listeners
            this.emergencyService.on('emergency_request', (data) => {
                console.log('EMERGENCY REQUEST RECEIVED:', {
                    id: data.emergency_id,
                    location: `${data.latitude}, ${data.longitude}`,
                    urgency: data.urgency_level,
                    timestamp: data.created_at
                });
            });

            this.emergencyService.on('error', (error) => {
                console.error('Emergency Service Error:', error);
            });

            await this.emergencyService.startListening();
            this.isRunning = true;
            
            console.log('Emergency Notification Listener started successfully');
            console.log('Listening for emergency requests...');
            
        } catch (error) {
            console.error('Failed to start Emergency Notification Listener:', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (this.emergencyService) {
                await this.emergencyService.stop();
            }
            this.isRunning = false;
            console.log('Emergency Notification Listener stopped');
        } catch (error) {
            console.error('Error stopping emergency listener:', error);
        }
    }

    async healthCheck() {
        try {
            if (!this.isRunning || !this.emergencyService) {
                return { status: 'unhealthy', message: 'Service not running' };
            }

            const isHealthy = await this.emergencyService.isHealthy();
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                isRunning: this.isRunning
            };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

// Create singleton instance
const emergencyListener = new EmergencyListener();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down emergency listener...');
    await emergencyListener.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down emergency listener...');
    await emergencyListener.stop();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    emergencyListener.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = emergencyListener;
