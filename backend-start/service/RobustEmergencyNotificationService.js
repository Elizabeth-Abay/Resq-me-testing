const DatabaseManager = require('../config/DatabaseManager');
const EventEmitter = require('events');
const axios = require('axios');
const { performance } = require('perf_hooks');

class RobustEmergencyNotificationService extends EventEmitter {
    constructor() {
        super();
        this.db = DatabaseManager;
        this.listeners = [];
        this.isRunning = false;
        this.maxListeners = 100; // Prevent memory leaks
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.heartbeatInterval = null;
        this.processingQueue = new Map(); // Track processing emergencies
        this.eventCleanupInterval = null;
        
        // Set max listeners to prevent memory leak warnings
        this.setMaxListeners(this.maxListeners);
    }

    async initialize() {
        try {
            // Ensure database is initialized
            await this.db.initialize();
            
            // Initialize multiple listeners for redundancy
            const listenerCount = Math.min(3, this.db.maxConnections / 4); // Use 25% of connections for listening
            
            for (let i = 0; i < listenerCount; i++) {
                await this.createListener(i);
            }

            console.log(`Initialized ${listenerCount} emergency notification listeners`);
            
            // Start heartbeat monitoring
            this.startHeartbeat();
            
            // Start event cleanup
            this.startEventCleanup();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize robust emergency notification service:', error);
            throw error;
        }
    }

    async createListener(listenerId) {
        try {
            const client = await this.db.getClient();
            
            // Set up notification listener
            await client.query('LISTEN emergency_requests');
            
            const listener = {
                id: listenerId,
                client: client,
                isActive: true,
                lastHeartbeat: Date.now(),
                processedCount: 0
            };

            // Handle notifications
            client.on('notification', async (msg) => {
                try {
                    await this.handleNotification(msg, listener);
                } catch (error) {
                    console.error(`Error in listener ${listenerId}:`, error);
                    this.emit('error', { listenerId, error });
                }
            });

            // Handle connection errors
            client.on('error', (error) => {
                console.error(`Listener ${listenerId} connection error:`, error);
                listener.isActive = false;
                this.handleListenerFailure(listenerId, error);
            });

            this.listeners.push(listener);
            console.log(`Emergency listener ${listenerId} created successfully`);
            
            return listener;
        } catch (error) {
            console.error(`Failed to create listener ${listenerId}:`, error);
            throw error;
        }
    }

    async handleNotification(msg, listener) {
        const startTime = performance.now();
        
        try {
            const payload = JSON.parse(msg.payload);
            const emergencyId = payload.emergency_id;
            
            // Check if already processing (prevent duplicate processing)
            if (this.processingQueue.has(emergencyId)) {
                console.log(`Emergency ${emergencyId} already being processed, skipping...`);
                return;
            }

            // Mark as processing
            this.processingQueue.set(emergencyId, {
                startTime: Date.now(),
                listenerId: listener.id
            });

            console.log(`🚨 Listener ${listener.id} processing emergency ${emergencyId}`);
            
            // Emit the emergency request
            this.emit('emergency_request', payload);
            
            // Process the emergency request
            await this.processEmergencyRequest(payload);
            
            // Update listener stats
            listener.processedCount++;
            listener.lastHeartbeat = Date.now();
            
            // Remove from processing queue
            this.processingQueue.delete(emergencyId);
            
            const processingTime = performance.now() - startTime;
            console.log(`✅ Emergency ${emergencyId} processed in ${processingTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error(`Error handling notification in listener ${listener.id}:`, error);
            this.emit('error', { listenerId, error, payload: msg.payload });
            
            // Remove from processing queue on error
            if (payload?.emergency_id) {
                this.processingQueue.delete(payload.emergency_id);
            }
        }
    }

    async processEmergencyRequest(emergencyData) {
        try {
            console.log(`Processing emergency request ${emergencyData.emergency_id}`);
            
            // Find nearby service providers
            const nearbyProviders = await this.findNearbyProviders(emergencyData);
            
            if (nearbyProviders.length === 0) {
                console.log('No nearby providers found for emergency:', emergencyData.emergency_id);
                await this.logNoProvidersFound(emergencyData);
                return;
            }

            console.log(`Found ${nearbyProviders.length} nearby providers`);
            
            // Contact providers with retry mechanism
            const contactResults = await this.contactProvidersWithRetry(nearbyProviders, emergencyData);
            
            // Log results
            await this.logProviderContactResults(emergencyData.emergency_id, contactResults);
            
            // Emit completion event
            this.emit('emergency_processed', {
                emergencyId: emergencyData.emergency_id,
                providerCount: nearbyProviders.length,
                successfulContacts: contactResults.filter(r => r.success).length,
                failedContacts: contactResults.filter(r => !r.success).length
            });
            
        } catch (error) {
            console.error('Error processing emergency request:', error);
            this.emit('error', { emergencyId: emergencyData.emergency_id, error });
        }
    }

    async findNearbyProviders(emergencyData) {
        try {
            const { latitude, longitude, health_state } = emergencyData;
            
            // Dynamic search radius based on urgency
            const searchRadiusKm = this.getSearchRadius(emergencyData.urgency_level);
            
            // Query to find nearby service providers using PostGIS with proper indexing
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
                    -- Calculate distance with proper units
                    ST_Distance(
                        sp.location, 
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                    ) / 1000 as distance_km,
                    -- Check if provider is currently available
                    COALESCE(sp.is_available, true) as is_available,
                    -- Provider rating and response stats
                    COALESCE(sp.average_rating, 0) as rating,
                    COALESCE(sp.response_rate, 1.0) as response_rate
                FROM service_provider_profile sp
                JOIN verified_users vu ON sp.service_provider_id = vu.id
                WHERE ST_DWithin(
                    sp.location, 
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
                    $3 * 1000
                )
                AND sp.license_expiration_date > NOW()
                AND COALESCE(sp.is_available, true) = true
                ORDER BY 
                    distance_km ASC,
                    rating DESC,
                    response_rate DESC
                LIMIT 15; -- Increased limit for better matching
            `;

            const result = await this.db.query(query, [longitude, latitude, searchRadiusKm]);
            
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
                landmark: row.identifying_landmark,
                rating: row.rating,
                responseRate: row.response_rate,
                isAvailable: row.is_available
            }));

        } catch (error) {
            console.error('Error finding nearby providers:', error);
            throw error;
        }
    }

    getSearchRadius(urgencyLevel) {
        const radii = {
            'low': 5,      // 5 km
            'medium': 10,  // 10 km
            'high': 15,    // 15 km
            'critical': 25  // 25 km
        };
        return radii[urgencyLevel] || 10;
    }

    async contactProvidersWithRetry(providers, emergencyData) {
        const contactPromises = providers.map(async (provider, index) => {
            // Stagger requests to prevent overwhelming providers
            const delay = index * 100; // 100ms between requests
            await this.sleep(delay);
            
            return await this.contactProviderWithRetry(provider, emergencyData);
        });

        const results = await Promise.allSettled(contactPromises);
        
        return results.map((result, index) => ({
            providerId: providers[index].id,
            providerName: providers[index].name,
            success: result.status === 'fulfilled',
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }

    async contactProviderWithRetry(provider, emergencyData, retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second base delay
        
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
                timestamp: new Date().toISOString(),
                providerInfo: {
                    id: provider.id,
                    name: provider.name,
                    rating: provider.rating
                }
            };

            // Provider's webhook URL with fallback
            const webhookUrl = `${process.env.PROVIDER_BASE_URL || 'http://localhost:3000'}/api/provider/emergency-request`;
            
            console.log(`Contacting provider ${provider.name} at ${webhookUrl} (attempt ${retryCount + 1})`);
            
            const response = await axios.post(webhookUrl, payload, {
                timeout: 8000, // 8 second timeout
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emergency-Auth': this.generateAuthSignature(payload),
                    'X-Retry-Count': retryCount.toString(),
                    'X-Emergency-ID': emergencyData.emergency_id
                }
            });

            // Log successful contact
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'success', response.status, retryCount);
            
            return {
                providerId: provider.id,
                status: 'success',
                responseStatus: response.status,
                responseTime: response.headers['x-response-time'] || 'unknown',
                retryCount
            };

        } catch (error) {
            console.error(`Failed to contact provider ${provider.id} (attempt ${retryCount + 1}):`, error.message);
            
            // Log failed attempt
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'failed', error.message, retryCount);
            
            // Retry logic
            if (retryCount < maxRetries) {
                const exponentialDelay = baseDelay * Math.pow(2, retryCount);
                await this.sleep(exponentialDelay);
                return await this.contactProviderWithRetry(provider, emergencyData, retryCount + 1);
            }
            
            // Final failure - add to dead letter queue
            await this.addToDeadLetterQueue(provider, emergencyData, error);
            
            throw error;
        }
    }

    generateAuthSignature(payload) {
        // Simple HMAC signature for now - upgrade to proper JWT in production
        const crypto = require('crypto');
        const secret = process.env.EMERGENCY_AUTH_SECRET || 'emergency-secret-key';
        const timestamp = Date.now().toString();
        const message = JSON.stringify(payload) + timestamp;
        
        return crypto.createHmac('sha256', secret).update(message).digest('hex');
    }

    async addToDeadLetterQueue(provider, emergencyData, error) {
        try {
            const query = `
                INSERT INTO emergency_dead_letter_queue (
                    provider_id, 
                    emergency_id, 
                    payload, 
                    error_message, 
                    retry_count, 
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `;

            await this.db.query(query, [
                provider.id,
                emergencyData.emergency_id,
                JSON.stringify(emergencyData),
                error.message,
                3 // Max retries reached
            ]);

            console.log(`Added to dead letter queue: Provider ${provider.id}, Emergency ${emergencyData.emergency_id}`);
            
        } catch (dlqError) {
            console.error('Failed to add to dead letter queue:', dlqError);
        }
    }

    async logProviderContact(providerId, emergencyId, status, details, retryCount = 0) {
        try {
            const query = `
                INSERT INTO provider_contact_logs (
                    provider_id, 
                    emergency_id, 
                    contact_status, 
                    contact_details, 
                    retry_count,
                    contacted_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `;

            await this.db.query(query, [
                providerId, 
                emergencyId, 
                status, 
                JSON.stringify({ status, details, retryCount }),
                retryCount
            ]);

        } catch (error) {
            console.error('Error logging provider contact:', error);
        }
    }

    async logNoProvidersFound(emergencyData) {
        try {
            const query = `
                INSERT INTO emergency_no_provider_logs (
                    emergency_id, 
                    location, 
                    urgency_level, 
                    created_at
                ) VALUES ($1, $2, $3, NOW())
            `;

            await this.db.query(query, [
                emergencyData.emergency_id,
                `POINT(${emergencyData.longitude} ${emergencyData.latitude})`,
                emergencyData.urgency_level
            ]);

        } catch (error) {
            console.error('Error logging no providers found:', error);
        }
    }

    async logProviderContactResults(emergencyId, results) {
        try {
            const summary = {
                totalProviders: results.length,
                successfulContacts: results.filter(r => r.success).length,
                failedContacts: results.filter(r => !r.success).length,
                results: results
            };

            const query = `
                INSERT INTO emergency_contact_summary (
                    emergency_id, 
                    contact_summary, 
                    created_at
                ) VALUES ($1, $2, NOW())
            `;

            await this.db.query(query, [emergencyId, JSON.stringify(summary)]);

        } catch (error) {
            console.error('Error logging provider contact results:', error);
        }
    }

    handleListenerFailure(listenerId, error) {
        console.error(`Listener ${listenerId} failed, attempting reconnection...`);
        
        // Remove failed listener
        this.listeners = this.listeners.filter(l => l.id !== listenerId);
        
        // Attempt to recreate listener
        setTimeout(async () => {
            try {
                await this.createListener(listenerId);
                this.reconnectAttempts = 0;
                console.log(`Successfully reconnected listener ${listenerId}`);
            } catch (reconnectError) {
                console.error(`Failed to reconnect listener ${listenerId}:`, reconnectError);
                this.reconnectAttempts++;
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
                    setTimeout(() => this.handleListenerFailure(listenerId, error), delay);
                } else {
                    console.error(`Max reconnection attempts reached for listener ${listenerId}`);
                    this.emit('critical_error', { listenerId, error: 'Max reconnection attempts reached' });
                }
            }
        }, this.reconnectDelay);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            const now = Date.now();
            const heartbeatTimeout = 30000; // 30 seconds
            
            for (const listener of this.listeners) {
                if (now - listener.lastHeartbeat > heartbeatTimeout) {
                    console.warn(`Listener ${listener.id} heartbeat timeout`);
                    listener.isActive = false;
                    this.handleListenerFailure(listener.id, new Error('Heartbeat timeout'));
                }
            }
            
            // Emit health status
            this.emit('heartbeat', {
                activeListeners: this.listeners.filter(l => l.isActive).length,
                totalListeners: this.listeners.length,
                processingQueue: this.processingQueue.size
            });
        }, 15000); // Check every 15 seconds
    }

    startEventCleanup() {
        // Clean up old events to prevent memory leaks
        this.eventCleanupInterval = setInterval(() => {
            if (this.listenerCount > this.maxListeners) {
                console.warn(`Too many event listeners (${this.listenerCount}), cleaning up...`);
                this.removeAllListeners();
                this.setMaxListeners(this.maxListeners);
            }
        }, 60000); // Check every minute
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        try {
            // Clear intervals
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            
            if (this.eventCleanupInterval) {
                clearInterval(this.eventCleanupInterval);
            }
            
            // Release all listeners
            for (const listener of this.listeners) {
                try {
                    await listener.client.query('UNLISTEN emergency_requests');
                    listener.client.release();
                } catch (error) {
                    console.error(`Error stopping listener ${listener.id}:`, error);
                }
            }
            
            this.listeners = [];
            this.isRunning = false;
            this.processingQueue.clear();
            
            // Remove all event listeners to prevent memory leaks
            this.removeAllListeners();
            
            console.log('Robust emergency notification service stopped');
            
        } catch (error) {
            console.error('Error stopping emergency notification service:', error);
        }
    }

    // Health check method
    async isHealthy() {
        try {
            const dbHealth = await this.db.healthCheck();
            
            return {
                status: this.isRunning && dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
                listeners: {
                    active: this.listeners.filter(l => l.isActive).length,
                    total: this.listeners.length
                },
                processing: this.processingQueue.size,
                database: dbHealth
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    getStats() {
        return {
            listeners: this.listeners.map(l => ({
                id: l.id,
                isActive: l.isActive,
                processedCount: l.processedCount,
                lastHeartbeat: l.lastHeartbeat
            })),
            processingQueue: Array.from(this.processingQueue.entries()).map(([id, info]) => ({
                emergencyId: id,
                startTime: info.startTime,
                listenerId: info.listenerId
            })),
            eventListenerCount: this.listenerCount,
            maxListeners: this.maxListeners
        };
    }
}

module.exports = RobustEmergencyNotificationService;
