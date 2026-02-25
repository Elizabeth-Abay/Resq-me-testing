const notificationPool = require('../config/pgNotificationConn');
const EventEmitter = require('events');





class EmergencyNotificationModel extends EventEmitter {
    constructor() {
        super();
        // the difference between this.pool and this.listener
        this.pool = null;
        this.listener = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            // Create a separate connection for listening
            this.pool = notificationPool;
            this.listener = await this.pool.connect(); // listener is the pool connected

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
                    console.log('Received emergency notification:', payload);


                    this.emit('emergency_request_made', payload);
                    // on the service layer this obj receives this notification
                    // and find a way to handle that in the event


                    // Process the emergency request
                    // await this.processEmergencyRequest(payload);

                } catch (error) {
                    console.error('Error processing notification:', error);
                    this.emit('error', error);
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

    async findNearbyProviders(sentInfo) {
        try {
            const { latitude, longitude , searchRadiusKm  } = sentInfo;

            // Query to find nearby service providers using PostGIS
            const query = `
                SELECT 
                    sp.id,
                    sp.service_provider_id as user_id,
                    sp.location,
                    sp.city,
                    sp.sub_city,
                    sp.identifying_landmark,
                    sp.license_expiration_date,
                    vu.email,
                    vu.fullname,
                    -- Calculate distance
                    ST_Distance(
                        sp.location, 
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                    ) / 1000 as distance_km
                FROM service_provider_profile sp
                JOIN verified_users vu ON sp.service_provider_id = vu.id
                WHERE ST_DWithin(
                    sp.location, 
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
                    $3 * 1000
                )
                AND sp.license_expiration_date > NOW()
                ORDER BY distance_km ASC
                LIMIT 10; -- Limit to top 10 closest providers
            `;

            const result = await this.pool.query(query, [longitude, latitude, searchRadiusKm]);

            // service providers profile
            let data = result.rows.map(row => ({
                userId: row.user_id,
                name: row.fullname,
                phone: row.phone_number,
                email: row.email,
                location: row.location,
                distanceKm: parseFloat(row.distance_km),
                isIndividual: row.is_individual_service_provider,
                city: row.city,
                subCity: row.sub_city,
                landmark: row.identifying_landmark
            }));

            return {
                success: true,
                data
            }

        } catch (error) {
            console.error('Error finding nearby providers:', error.message);
            return {
                success: false,
                reason: "Error while findNearbyProviders"
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


    async logProviderContact(providerId, emergencyId, status, details) {
        try {
            const query = `
                INSERT INTO provider_contact_logs (
                    provider_id, 
                    emergency_id, 
                    contact_status, 
                    contact_details, 
                    contacted_at
                ) VALUES ($1, $2, $3, $4, NOW())
            `;

            await this.pool.query(query, [
                providerId, 
                emergencyId, 
                status, 
                JSON.stringify({ status, details })
            ]);

        } catch (error) {
            console.error('Error logging provider contact:', error);
            // Don't throw here - logging failure shouldn't break the main flow
        }
    }
}



const EmergencyNotificationHandlerObj = new EmergencyNotificationModel();

module.exports = EmergencyNotificationHandlerObj;