// this model is about setting up the channel to listen to notifications
const pool = require('../config/pgConnection');
const EventEmitter = require('events');





class EmergencyNotificationModel extends EventEmitter {
    constructor() {
        super();
        this.listener = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            this.listener = await pool.connect(); 
            // listener is one client from the pool connected permanently

            console.log('Emergency notification service initialized');
            return {
                success: true
            }
        } catch (error) {
            console.error('Failed to initialize emergency notification service:', error.message);
            return {
                success: false,
                reason: "Error while initializing pool connection"
            }
        }
    }

    async startListening() {
        if (this.isRunning) {
            console.log('Emergency notification service is already running');
            return {
                success: true
            }
        }

        try {
            await this.listener.query('LISTEN emergency_happened');
            this.isRunning = true;
            console.log('Listening for emergency requests...');

            this.listener.on('notification', async (msg) => {
                try {
                    // only a single channel to have been notified
                    const payload = JSON.parse(msg.payload);
                    // 'emergency_id', 'allergies','health_state','latitude','longitude'
                    console.log('Received emergency notification:', payload);


                    this.emit('emergency_request_made', payload);
                    // event listener bridges the inputted info and the service layer's task next 

                } catch (error) {
                    console.error('Error processing notification:', error);
                    
                }
            });

        } catch (error) {
            console.error('Failed to start listening:', error.message);
            return {
                success: false,
                reason: "Failed to start listening:"
            }
        }
    }



    async stop() {
        if (this.listener) {
            await this.listener.query('UNLISTEN emergency_requests');
            this.listener.release();
        }

        if (this.pool) {
            await this.pool.end();
        }

        this.isRunning = false;
        console.log('Emergency notification service stopped');
    }

    // Health check method
    async isHealthy() {
        try {
            if (!this.isRunning || !this.listener) {
                return false;
            }

            await this.pool.query('SELECT 1');
            return true;
        } catch (error) {
            return false;
        }
    }

}



const EmergencyNotificationHandlerObj = new EmergencyNotificationModel();

EmergencyNotificationHandlerObj.initialize();
EmergencyNotificationHandlerObj.startListening();
EmergencyNotificationHandlerObj.isHealthy();




module.exports = EmergencyNotificationHandlerObj;