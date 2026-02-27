// this model is about setting up the channel to listen to notifications
const notificationPool = require('../config/pgNotificationConn');
const EventEmitter = require('events');
const HandleEvents = require('../events/modelNotification');




class EmergencyNotificationModel extends EventEmitter {
    constructor() {
        super()
        this.listener = null;
        this.isRunning = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.on('emergency_request_made', async (payload) => {
            console.log(' [MODEL] Received emergency_request_made event with payload:', payload);
            try {
                const result = await HandleEvents(payload);
                console.log(' [MODEL] Event handling result:', result);
            } catch (err) {
                console.error(' [MODEL] Error handling emergency_request_made event:', err.message);
            }
        })
    }

    async initialize() {
        try {
            console.log(' Initializing emergency notification service...');
            console.log(' Database connection config:', {
                host: process.env.PG_HOST || 'localhost',
                port: process.env.PG_PORT || 5432,
                database: process.env.PG_DATABASE || 'unknown',
                user: process.env.PG_USER || 'unknown'
            });

            this.listener = await notificationPool.connect();
            // listener is one client from the notificationPoolconnected permanently

            console.log(' Database connection established');
            console.log(' Emergency notification service initialized');
            return {
                success: true
            }
        } catch (error) {
            console.error(' Failed to initialize emergency notification service:', error.message);
            console.error(' Full error:', error);
            return {
                success: false,
                reason: "Error while initializing notificationPool connection: " + error.message
            }
        }
    }

    async startListening() {
        if (this.isRunning) {
            console.log(' Emergency notification service is already running');
            return {
                success: true
            }
        }

        console.log(' Starting to listen for PostgreSQL notifications...');

        const listenWithRetry = async () => {
            try {
                this.connectionAttempts++;
                console.log(` Connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}`);

                // Test the connection first
                await this.listener.query('SELECT NOW()');
                console.log(' Database connection test passed');

                // Start listening to the channel
                await this.listener.query('LISTEN emergency_happened');
                this.isRunning = true;
                console.log(' Successfully listening to channel: emergency_happened');
                console.log(' Waiting for PostgreSQL notifications...');

                this.listener.on('notification', async (msg) => {
                    try {
                        console.log(' Raw notification received:', {
                            channel: msg.channel,
                            pid: msg.pid,
                            payload: msg.payload
                        });

                        // only a single channel to have been notified
                        if (!msg.payload) {
                            console.log(' Received empty payload, skipping...');
                            return;
                        }

                        const payload = JSON.parse(msg.payload);
                        console.log(' Parsed payload:', payload);
                        console.log(' Emitting emergency_request_made event');

                        this.emit('emergency_request_made', payload);
                        console.log(' Event emitted successfully');
                        // event listener bridges inputted info and service layer's task next 

                    } catch (error) {
                        console.error(' Error processing notification:', error.message);
                        console.error(' Raw payload that failed:', msg.payload);

                    }
                });

                // Add connection error handling
                this.listener.on('error', (err) => {
                    console.error(' Database connection error:', err.message);
                    this.isRunning = false;
                    setTimeout(listenWithRetry, 5000);
                });

                this.listener.on('end', () => {
                    console.log(' Database connection ended');
                    this.isRunning = false;
                    setTimeout(listenWithRetry, 5000);
                });

                console.log(' Notification listener setup complete');
                return {
                    success: true,
                    message: "Successfully started listening"
                }

            } catch (error) {
                console.error(' Failed to start listening:', error.message);
                console.error(' Full error:', error);
                this.isRunning = false;

                if (this.connectionAttempts >= this.maxConnectionAttempts) {
                    console.error(' Max connection attempts reached. Giving up.');
                    return {
                        success: false,
                        reason: "Max connection attempts reached"
                    }
                }

                // Try to reconnect
                console.log(` Retrying in 5 seconds...`);
                setTimeout(async () => {
                    try {
                        if (this.listener) {
                            await this.listener.release();
                        }
                        this.listener = await pool.connect();
                        await listenWithRetry();
                    } catch (reconnectError) {
                        console.error(' Reconnection failed:', reconnectError.message);
                        setTimeout(listenWithRetry, 5000);
                    }
                }, 5000);

                return {
                    success: false,
                    reason: "Failed to start listening, will retry"
                }
            }
        };

        return await listenWithRetry();
    }



    async stop() {
        console.log(' Stopping emergency notification service...');

        if (this.listener) {
            try {
                await this.listener.query('UNLISTEN emergency_happened');
                console.log(' Unlistened from emergency_happened channel');
                await this.listener.release();
                console.log(' Database connection released');
            } catch (error) {
                console.error(' Error during cleanup:', error.message);
            }
        }

        if (this.pool) {
            await this.pool.end();
        }

        this.isRunning = false;
        console.log(' Emergency notification service stopped');
    }

    // Health check method
    async isHealthy() {
        try {
            if (!this.isRunning || !this.listener) {
                console.log(' Not healthy - not running or no listener');
                return false;
            }

            await this.listener.query('SELECT 1');
            console.log(' Service is healthy');
            return true;
        } catch (error) {
            console.log(' Health check failed:', error.message);
            return false;
        }
    }

    // Success check function for testing
    async testNotification() {
        try {
            console.log(' Testing notification system...');

            // Send a test notification directly
            await this.listener.query(`
                SELECT pg_notify('emergency_happened', $1)
            `, [JSON.stringify({
                test: true,
                emergency_id: 'test-' + Date.now(),
                message: 'Test notification from listener',
                timestamp: new Date().toISOString()
            })]);

            console.log(' Test notification sent');
            return { success: true };
        } catch (error) {
            console.error(' Test notification failed:', error.message);
            return { success: false, error: error.message };
        }
    }

}



const EmergencyNotificationHandlerObj = new EmergencyNotificationModel();

// Auto-start the listener
console.log(' Auto-starting emergency notification listener...');
EmergencyNotificationHandlerObj.initialize().then(initResult => {
    if (initResult.success) {
        EmergencyNotificationHandlerObj.startListening().then(listenResult => {
            console.log(' Listener start result:', listenResult);

            // Test the system after 2 seconds
            setTimeout(() => {
                console.log(' Running health check...');
                EmergencyNotificationHandlerObj.isHealthy().then(healthy => {
                    console.log(' Health check result:', healthy ? 'HEALTHY' : 'UNHEALTHY');
                });
            }, 2000);
        });
    } else {
        console.error(' Failed to initialize listener:', initResult.reason);
    }
});

// Export for use in other modules
module.exports = EmergencyNotificationHandlerObj;