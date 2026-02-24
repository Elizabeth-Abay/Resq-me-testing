
const axios = require('axios');
// const dotenv = require('dotenv');
// const path = require('path');

// dotenv.config({
//     path: path.resolve(__dirname, '../../.env')
// });

class EmergencyNotificationService extends EventEmitter {
    constructor() {
        super();
        this.pool = null;
        this.listener = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            // Create a separate connection for listening
            this.pool = notificationPool;
            // if we are going to have a single listener why do we need to have a this.listener

            this.listener = await this.pool.connect();
            // listener is the pool connected
            console.log('Emergency notification service initialized');
        } catch (error) {
            console.error('Failed to initialize emergency notification service:', error.message);
            throw error;
        }
    }

    async startListening() {
        if (this.isRunning) {
            console.log('Emergency notification service is already running');
            return;
        }

        try {
            await this.listener.query('LISTEN emergency_happened');
            this.isRunning = true;
            console.log('Listening for emergency requests...');

            this.listener.on('notification', async (msg) => {
                try {
                    const payload = JSON.parse(msg.payload);
                    console.log('Received emergency notification:', payload);
                    
                    // why
                    // Emit the emergency request
                    this.emit('emergency_request', payload);
                    // why d
                    
                    // Process the emergency request
                    await this.processEmergencyRequest(payload);
                    
                } catch (error) {
                    console.error('Error processing notification:', error);
                    this.emit('error', error);
                }
            });

        } catch (error) {
            console.error('Failed to start listening:', error);
            throw error;
        }
    }

    async processEmergencyRequest(emergencyData) {
        try {
            console.log(`Processing emergency request ${emergencyData.emergency_id}`);
            
            // Find nearby service providers
            const nearbyProviders = await this.findNearbyProviders(emergencyData);
            
            if (nearbyProviders.length === 0) {
                console.log('No nearby providers found for emergency:', emergencyData.emergency_id);
                return;
            }

            console.log(`Found ${nearbyProviders.length} nearby providers`);
            
            // Contact each provider
            const contactPromises = nearbyProviders.map(provider => 
                this.contactProvider(provider, emergencyData)
            );
            
            const results = await Promise.allSettled(contactPromises);
            
            // Log results
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    console.log(`Successfully contacted provider ${nearbyProviders[index].id}`);
                } else {
                    console.error(`Failed to contact provider ${nearbyProviders[index].id}:`, result.reason);
                }
            });

        } catch (error) {
            console.error('Error processing emergency request:', error);
            this.emit('error', error);
        }
    }

    async findNearbyProviders(emergencyData) {
        try {
            const { latitude, longitude } = emergencyData;
            
            // Search radius in kilometers (adjust as needed)
            const searchRadiusKm = 10;
            
            // Query to find nearby service providers using PostGIS
            const query = `
                SELECT 
                    sp.id,
                    sp.service_provider_id as user_id,
                    sp.location,
                    sp.is_individual_service_provider,
                    sp.city,
                    sp.sub_city,
                    sp.identifying_landmark,
                    sp.license_expiration_date,
                    vu.phone_number,
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
            
            return result.rows.map(row => ({
                id: row.id,
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

        } catch (error) {
            console.error('Error finding nearby providers:', error);
            throw error;
        }
    }

    async contactProvider(provider, emergencyData) {
        try {
            const payload = {
                emergencyId: emergencyData.emergency_id,
                userId: emergencyData.user_id,
                location: {
                    latitude: emergencyData.latitude,
                    longitude: emergencyData.longitude
                },
                healthState: emergencyData.health_state,
                urgencyLevel: emergencyData.urgency_level,
                contactInfo: emergencyData.contact_info,
                distanceKm: provider.distanceKm,
                timestamp: new Date().toISOString()
            };

            // Provider's webhook URL (you should store this in your database)
            const webhookUrl = `${process.env.PROVIDER_BASE_URL || 'http://localhost:3000'}/api/provider/emergency-request`;
            
            console.log(`Contacting provider ${provider.name} at ${webhookUrl}`);
            
            const response = await axios.post(webhookUrl, payload, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emergency-Auth': process.env.EMERGENCY_AUTH_TOKEN || 'emergency-token'
                }
            });

            // Log that the provider was contacted successfully
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'success', response.status);
            
            return {
                providerId: provider.id,
                status: 'success',
                responseStatus: response.status
            };

        } catch (error) {
            // Log failed contact attempt
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'failed', error.message);
            
            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
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

module.exports = EmergencyNotificationService;
