const DatabaseManager = require('../config/DatabaseManager');

class RobustEmergencyService {
    constructor() {
        this.db = DatabaseManager;
    }

    async createEmergencyRequest(emergencyData) {
        try {
            const { userId, latitude, longitude, healthState, urgencyLevel, contactPhone, contactEmail } = emergencyData;

            // Validate coordinates
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return {
                    success: false,
                    message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
                };
            }

            // Validate health state structure
            if (!healthState || typeof healthState !== 'object') {
                return {
                    success: false,
                    message: 'Health state must be a valid object'
                };
            }

            // Use transaction for atomicity
            const result = await this.db.transaction(async (client) => {
                // Check if user has existing active emergency
                const activeCheckQuery = `
                    SELECT id FROM emergency_requests 
                    WHERE user_id = $1 AND status IN ('pending', 'accepted', 'en_route', 'arrived', 'in_progress')
                    FOR UPDATE
                `;
                const activeCheck = await client.query(activeCheckQuery, [userId]);

                if (activeCheck.rows.length > 0) {
                    throw new Error('User already has an active emergency request');
                }

                // Create emergency request
                const query = `
                    INSERT INTO emergency_requests (
                        user_id, 
                        location, 
                        health_state, 
                        urgency_level, 
                        contact_phone, 
                        contact_email,
                        status,
                        created_at
                    ) VALUES (
                        $1,
                        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                        $4::jsonb,
                        $5,
                        $6,
                        $7,
                        'pending',
                        NOW()
                    )
                    RETURNING id, created_at, status, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude
                `;

                const values = [
                    userId, 
                    longitude, 
                    latitude, 
                    JSON.stringify(healthState), 
                    urgencyLevel, 
                    contactPhone, 
                    contactEmail
                ];

                const insertResult = await client.query(query, values);

                // Log the emergency creation
                await this.logEmergencyAction(client, {
                    emergencyId: insertResult.rows[0].id,
                    userId,
                    action: 'created',
                    details: { latitude, longitude, urgencyLevel, healthState }
                });

                return insertResult.rows[0];
            });

            return {
                success: true,
                data: {
                    emergencyId: result.id,
                    status: result.status,
                    createdAt: result.created_at,
                    location: {
                        latitude: parseFloat(result.latitude),
                        longitude: parseFloat(result.longitude)
                    }
                }
            };

        } catch (error) {
            console.error('Error creating emergency request:', error);
            
            if (error.message.includes('already has an active emergency')) {
                return {
                    success: false,
                    message: error.message
                };
            }

            return {
                success: false,
                message: 'Failed to create emergency request. Please try again.'
            };
        }
    }

    async acceptEmergencyRequest(acceptanceData) {
        try {
            const { emergencyId, providerId, estimatedArrivalTime, currentLocation, acceptedAt } = acceptanceData;

            // Validate estimated arrival time (must be in the future)
            const arrivalTime = new Date(estimatedArrivalTime);
            if (arrivalTime <= new Date()) {
                return {
                    success: false,
                    message: 'Estimated arrival time must be in the future'
                };
            }

            // Use transaction with row-level locking to prevent race conditions
            const result = await this.db.transaction(async (client) => {
                // Lock the emergency row for update
                const lockQuery = `
                    SELECT id, status, assigned_provider_id, user_id, urgency_level
                    FROM emergency_requests 
                    WHERE id = $1 
                    FOR UPDATE
                `;
                const lockResult = await client.query(lockQuery, [emergencyId]);

                if (lockResult.rows.length === 0) {
                    throw new Error('Emergency request not found');
                }

                const emergency = lockResult.rows[0];
                
                // Check if emergency is still available
                if (emergency.status !== 'pending') {
                    throw new Error(`Emergency request is already ${emergency.status}`);
                }

                // Check if already assigned to another provider
                if (emergency.assigned_provider_id) {
                    throw new Error('Emergency request has already been assigned to another provider');
                }

                // Verify provider is available and licensed
                const providerCheckQuery = `
                    SELECT sp.id, sp.service_provider_id, sp.license_expiration_date, 
                           sp.is_available, vu.fullname
                    FROM service_provider_profile sp
                    JOIN verified_users vu ON sp.service_provider_id = vu.id
                    WHERE sp.service_provider_id = $1 AND sp.license_expiration_date > NOW()
                    FOR UPDATE
                `;
                const providerCheck = await client.query(providerCheckQuery, [providerId]);

                if (providerCheck.rows.length === 0) {
                    throw new Error('Provider not found or license expired');
                }

                const provider = providerCheck.rows[0];
                if (!provider.is_available) {
                    throw new Error('Provider is currently not available');
                }

                // Update emergency request with assigned provider
                const updateQuery = `
                    UPDATE emergency_requests 
                    SET 
                        assigned_provider_id = $1,
                        status = 'accepted',
                        estimated_arrival_time = $2,
                        provider_location = $3,
                        accepted_at = $4,
                        updated_at = NOW()
                    WHERE id = $5
                    RETURNING id, status, assigned_provider_id, accepted_at
                `;

                let providerLocation = null;
                if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                    providerLocation = `ST_SetSRID(ST_MakePoint(${currentLocation.longitude}, ${currentLocation.latitude}), 4326)::geography`;
                }

                const updateValues = [
                    providerId, 
                    estimatedArrivalTime, 
                    providerLocation,
                    acceptedAt,
                    emergencyId
                ];

                const updateResult = await client.query(updateQuery, updateValues);

                // Mark provider as busy (optional - depends on business logic)
                await client.query(`
                    UPDATE service_provider_profile 
                    SET is_available = false, 
                        last_acceptance_time = NOW()
                    WHERE service_provider_id = $1
                `, [providerId]);

                // Log the acceptance
                await this.logEmergencyAction(client, {
                    emergencyId,
                    providerId,
                    userId: emergency.user_id,
                    action: 'accepted',
                    details: { 
                        estimatedArrivalTime, 
                        currentLocation,
                        urgencyLevel: emergency.urgency_level,
                        providerName: provider.fullname
                    }
                });

                // Create provider response record
                await client.query(`
                    INSERT INTO emergency_provider_responses (
                        emergency_id, provider_id, response_type, response_details, responded_at
                    ) VALUES ($1, $2, 'accepted', $3, NOW())
                `, [
                    emergencyId,
                    providerId,
                    JSON.stringify({ estimatedArrivalTime, currentLocation })
                ]);

                return {
                    emergencyId: updateResult.rows[0].id,
                    status: updateResult.rows[0].status,
                    assignedProviderId: updateResult.rows[0].assigned_provider_id,
                    acceptedAt: updateResult.rows[0].accepted_at,
                    providerName: provider.fullname
                };
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Error accepting emergency request:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('already') || 
                error.message.includes('not available')) {
                return {
                    success: false,
                    message: error.message
                };
            }

            return {
                success: false,
                message: 'Failed to accept emergency request. Please try again.'
            };
        }
    }

    async declineEmergencyRequest(declineData) {
        try {
            const { emergencyId, providerId, declineReason, declinedAt } = declineData;

            const result = await this.db.transaction(async (client) => {
                // Verify emergency exists and provider was contacted
                const checkQuery = `
                    SELECT er.id, er.status, er.user_id
                    FROM emergency_requests er
                    WHERE er.id = $1
                `;
                const checkResult = await client.query(checkQuery, [emergencyId]);

                if (checkResult.rows.length === 0) {
                    throw new Error('Emergency request not found');
                }

                const emergency = checkResult.rows[0];

                // Log the decline
                await client.query(`
                    INSERT INTO emergency_provider_responses (
                        emergency_id, provider_id, response_type, response_details, responded_at
                    ) VALUES ($1, $2, 'declined', $3, NOW())
                `, [
                    emergencyId,
                    providerId,
                    JSON.stringify({ reason: declineReason })
                ]);

                // Log the action
                await this.logEmergencyAction(client, {
                    emergencyId,
                    providerId,
                    userId: emergency.user_id,
                    action: 'declined',
                    details: { declineReason }
                });

                return {
                    emergencyId,
                    providerId,
                    response: 'declined'
                };
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Error declining emergency request:', error);
            
            if (error.message.includes('not found')) {
                return {
                    success: false,
                    message: error.message
                };
            }

            return {
                success: false,
                message: 'Failed to decline emergency request'
            };
        }
    }

    async updateEmergencyStatus(updateData) {
        try {
            const { emergencyId, providerId, status, notes, currentLocation, updatedAt } = updateData;

            // Validate status transitions
            const validTransitions = {
                'accepted': ['en_route'],
                'en_route': ['arrived'],
                'arrived': ['in_progress'],
                'in_progress': ['completed'],
                'accepted': ['completed'], // Direct completion possible
                'en_route': ['completed']  // Direct completion possible
            };

            const result = await this.db.transaction(async (client) => {
                // Get current status and verify provider assignment
                const currentQuery = `
                    SELECT id, status, assigned_provider_id, user_id, urgency_level
                    FROM emergency_requests 
                    WHERE id = $1 AND assigned_provider_id = $2
                    FOR UPDATE
                `;
                const currentResult = await client.query(currentQuery, [emergencyId, providerId]);

                if (currentResult.rows.length === 0) {
                    throw new Error('Emergency request not found or not assigned to this provider');
                }

                const current = currentResult.rows[0];

                // Validate status transition
                if (current.status !== status) {
                    const allowedTransitions = validTransitions[current.status] || [];
                    if (!allowedTransitions.includes(status)) {
                        throw new Error(`Invalid status transition from ${current.status} to ${status}`);
                    }
                }

                // Update emergency status
                let updateQuery = `
                    UPDATE emergency_requests 
                    SET 
                        status = $1,
                        provider_notes = $2,
                        updated_at = $3
                `;

                let updateValues = [status, notes, updatedAt];

                // Add location update if provided
                if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                    updateQuery += `,
                        provider_location = $4,
                        last_location_update = NOW()
                    `;
                    updateValues.push(`ST_SetSRID(ST_MakePoint(${currentLocation.longitude}, ${currentLocation.latitude}), 4326)::geography`);
                }

                updateQuery += `
                    WHERE id = $5 AND assigned_provider_id = $6
                    RETURNING id, status, updated_at
                `;
                updateValues.push(emergencyId, providerId);

                const updateResult = await client.query(updateQuery, updateValues);

                // Mark provider as available if emergency is completed
                if (status === 'completed') {
                    await client.query(`
                        UPDATE service_provider_profile 
                        SET is_available = true,
                            last_completion_time = NOW()
                        WHERE service_provider_id = $1
                    `, [providerId]);

                    // Set completed_at timestamp
                    await client.query(`
                        UPDATE emergency_requests 
                        SET completed_at = NOW()
                        WHERE id = $1
                    `, [emergencyId]);
                }

                // Log the status update
                await this.logEmergencyAction(client, {
                    emergencyId,
                    providerId,
                    userId: current.user_id,
                    action: 'status_update',
                    details: { 
                        status, 
                        notes, 
                        currentLocation,
                        previousStatus: current.status,
                        urgencyLevel: current.urgency_level
                    }
                });

                return {
                    emergencyId: updateResult.rows[0].id,
                    status: updateResult.rows[0].status,
                    updatedAt: updateResult.rows[0].updated_at
                };
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Error updating emergency status:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('Invalid status transition')) {
                return {
                    success: false,
                    message: error.message
                };
            }

            return {
                success: false,
                message: 'Failed to update emergency status'
            };
        }
    }

    async getProviderEmergencies(queryData) {
        try {
            const { providerId, status, limit = 10, offset = 0 } = queryData;

            // Validate pagination
            if (limit > 100) limit = 100;
            if (offset < 0) offset = 0;

            let whereClause = 'WHERE er.assigned_provider_id = $1';
            const queryParams = [providerId];
            let paramIndex = 2;

            if (status) {
                whereClause += ` AND er.status = $${paramIndex}`;
                queryParams.push(status);
                paramIndex++;
            }

            const query = `
                SELECT 
                    er.id as emergency_id,
                    er.status,
                    er.urgency_level,
                    er.health_state,
                    er.contact_phone,
                    er.contact_email,
                    er.created_at,
                    er.accepted_at,
                    er.estimated_arrival_time,
                    er.provider_notes,
                    er.completed_at,
                    vu.fullname as user_name,
                    vu.phone_number as user_phone,
                    vu.email as user_email,
                    ST_X(er.location::geometry) as longitude,
                    ST_Y(er.location::geometry) as latitude,
                    CASE 
                        WHEN er.provider_location IS NOT NULL THEN 
                            json_build_object(
                                'latitude', ST_Y(er.provider_location::geometry),
                                'longitude', ST_X(er.provider_location::geometry)
                            )
                        ELSE NULL
                    END as provider_current_location,
                    -- Calculate response time metrics
                    EXTRACT(EPOCH FROM (er.accepted_at - er.created_at)) as response_time_seconds,
                    EXTRACT(EPOCH FROM (er.completed_at - er.accepted_at)) as completion_time_seconds
                FROM emergency_requests er
                JOIN verified_users vu ON er.user_id = vu.id
                ${whereClause}
                ORDER BY er.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            queryParams.push(limit, offset);
            const result = await this.db.query(query, queryParams);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM emergency_requests er
                ${whereClause}
            `;

            const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            return {
                success: true,
                data: result.rows.map(row => ({
                    emergencyId: row.emergency_id,
                    status: row.status,
                    urgencyLevel: row.urgency_level,
                    healthState: row.health_state,
                    contactInfo: {
                        phone: row.contact_phone,
                        email: row.contact_email
                    },
                    user: {
                        name: row.user_name,
                        phone: row.user_phone,
                        email: row.user_email
                    },
                    location: {
                        latitude: parseFloat(row.latitude),
                        longitude: parseFloat(row.longitude)
                    },
                    providerLocation: row.provider_current_location,
                    timestamps: {
                        createdAt: row.created_at,
                        acceptedAt: row.accepted_at,
                        estimatedArrival: row.estimated_arrival_time,
                        completedAt: row.completed_at
                    },
                    providerNotes: row.provider_notes,
                    metrics: {
                        responseTimeSeconds: row.response_time_seconds ? parseFloat(row.response_time_seconds) : null,
                        completionTimeSeconds: row.completion_time_seconds ? parseFloat(row.completion_time_seconds) : null
                    }
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Math.floor(offset / limit) + 1
                }
            };

        } catch (error) {
            console.error('Error getting provider emergencies:', error);
            return {
                success: false,
                message: 'Failed to retrieve emergency requests'
            };
        }
    }

    async getEmergencyStatus(queryData) {
        try {
            const { emergencyId, userId } = queryData;

            const query = `
                SELECT 
                    er.id,
                    er.status,
                    er.urgency_level,
                    er.health_state,
                    er.contact_phone,
                    er.contact_email,
                    er.created_at,
                    er.accepted_at,
                    er.estimated_arrival_time,
                    er.provider_notes,
                    er.assigned_provider_id,
                    er.completed_at,
                    sp.service_provider_id,
                    vu.fullname as provider_name,
                    vu.phone_number as provider_phone,
                    vu.email as provider_email,
                    sp.is_individual_service_provider,
                    sp.license_expiration_date,
                    ST_X(er.location::geometry) as longitude,
                    ST_Y(er.location::geometry) as latitude,
                    CASE 
                        WHEN er.provider_location IS NOT NULL THEN 
                            json_build_object(
                                'latitude', ST_Y(er.provider_location::geometry),
                                'longitude', ST_X(er.provider_location::geometry),
                                'last_updated': er.last_location_update
                            )
                        ELSE NULL
                    END as provider_current_location,
                    -- Distance calculation
                    CASE 
                        WHEN er.provider_location IS NOT NULL AND er.location IS NOT NULL THEN
                            ST_Distance(er.provider_location, er.location) / 1000
                        ELSE NULL
                    END as distance_to_user_km
                FROM emergency_requests er
                LEFT JOIN service_provider_profile sp ON er.assigned_provider_id = sp.service_provider_id
                LEFT JOIN verified_users vu ON sp.service_provider_id = vu.id
                WHERE er.id = $1 AND er.user_id = $2
            `;

            const result = await this.db.query(query, [emergencyId, userId]);

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    success: true,
                    data: {
                        emergencyId: row.id,
                        status: row.status,
                        urgencyLevel: row.urgency_level,
                        healthState: row.health_state,
                        contactInfo: {
                            phone: row.contact_phone,
                            email: row.contact_email
                        },
                        location: {
                            latitude: parseFloat(row.latitude),
                            longitude: parseFloat(row.longitude)
                        },
                        provider: row.assigned_provider_id ? {
                            id: row.assigned_provider_id,
                            name: row.provider_name,
                            phone: row.provider_phone,
                            email: row.provider_email,
                            isIndividual: row.is_individual_service_provider,
                            licenseExpiration: row.license_expiration_date,
                            currentLocation: row.provider_current_location,
                            distanceToUserKm: row.distance_to_user_km ? parseFloat(row.distance_to_user_km) : null
                        } : null,
                        timestamps: {
                            createdAt: row.created_at,
                            acceptedAt: row.accepted_at,
                            estimatedArrival: row.estimated_arrival_time,
                            completedAt: row.completed_at
                        },
                        providerNotes: row.provider_notes
                    }
                };
            }

            return {
                success: false,
                message: 'Emergency request not found'
            };

        } catch (error) {
            console.error('Error getting emergency status:', error);
            return {
                success: false,
                message: 'Failed to retrieve emergency status'
            };
        }
    }

    async logEmergencyAction(client, actionData) {
        try {
            const { emergencyId, providerId, userId, action, details } = actionData;
            const queryClient = client || this.db;

            const query = `
                INSERT INTO emergency_action_logs (
                    emergency_id,
                    provider_id,
                    user_id,
                    action_type,
                    action_details,
                    action_timestamp
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `;

            await queryClient.query(query, [
                emergencyId,
                providerId,
                userId,
                action,
                JSON.stringify(details)
            ]);

        } catch (error) {
            console.error('Error logging emergency action:', error);
            // Don't throw - logging failure shouldn't break the main flow
        }
    }

    // Health check for the service
    async healthCheck() {
        try {
            const dbHealth = await this.db.healthCheck();
            
            // Check if there are any stuck emergencies
            const stuckEmergenciesQuery = `
                SELECT COUNT(*) as count
                FROM emergency_requests 
                WHERE status IN ('accepted', 'en_route', 'arrived', 'in_progress')
                AND created_at < NOW() - INTERVAL '2 hours'
            `;
            
            const stuckResult = await this.db.query(stuckEmergenciesQuery);
            const stuckEmergencies = parseInt(stuckResult.rows[0].count);

            return {
                status: 'healthy',
                database: dbHealth,
                stuckEmergencies,
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
}

module.exports = RobustEmergencyService;
