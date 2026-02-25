const pool = require('../config/pgConnection')

class EmergencyContactSetterModel {
    async setEmergencyContacts(sentInfo) {
        try {
            // batch insert
            let {
                userId,
                firstEmergName, firstEmergEmail, firstEmergRelation,
                secondEmergName, secondEmergEmail, secondEmergRelation,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation,
                firstUserUrl,
                secondUserUrl,
                thirdUserUrl,
                fourthUserUrl,
                fifthUserUrl
            } = sentInfo;

            let query = `
                INSERT INTO emergency_contacts(patient_id ,  name , email , relationship , imageUrl)
                VALUES 
                    ($1 , $2 , $3 , $4 , $5),
                    ($1 , $6 , $7 , $8 , $9),
                    ($1, $10 , $11 , $12 , $13),
                    ($1, $14 , $15 , $16 , $17),
                    ($1, $18, $19 , $20 , $21)
            `

            let values = [
                userId,
                firstEmergName, firstEmergEmail, firstEmergRelation, firstUserUrl,
                secondEmergName, secondEmergEmail, secondEmergRelation, secondUserUrl,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation, thirdUserUrl,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation, fourthUserUrl,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation, fifthUserUrl
            ];

            let result = await pool.query(query, values);

            console.log("Inputting into model is done ", result.rowCount)

            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Database insertion problem"
                }
            }

            return {
                success: true
            }

        } catch (Err) {
            console.log('Error while EmergencyContactSetterModel.setEmergencyContacts ', Err.message);
            return {
                success: false,
                reason: "Error while EmergencyContactSetterModel.setEmergencyContacts"
            }
        }
    }

    async selectEmergencyContacts(userId) {
        try {
            let query = `SELECT email FROM emergency_contacts WHERE patient_id = $1`;
            let values = [userId];

            let result = await pool.query(query, values);

            if (result.rowCount === 0){
                return {
                    success : true,
                    data : []
                }
            }

            return {
                success : true,
                data : result.rows
                // result.rows = [{ name , email}]
            }

        } catch (Err) {
            console.log('Error while EmergencyContactSetterModel. selectEmergencyContacts selectEmergencyContacts ', Err.message);
            return {
                success: false,
                reason: "Error while EmergencyContactSetterModel. selectEmergencyContacts selectEmergencyContacts"
            }
        }
    }
}


module.exports = EmergencyContactSetterModel;


const pool = require('../config/pgConnection');

class EmergencyService {
    async createEmergencyRequest(emergencyData) {
        try {
            const { userId, latitude, longitude, healthState, urgencyLevel, contactPhone, contactEmail } = emergencyData;

            const query = `
                INSERT INTO emergency_requests (
                    user_id, 
                    location, 
                    health_state, 
                    urgency_level, 
                    contact_phone, 
                    contact_email,
                    status
                ) VALUES (
                    $1,
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                    $4::jsonb,
                    $5,
                    $6,
                    $7,
                    'pending'
                )
                RETURNING id, created_at, status
            `;

            const values = [userId, longitude, latitude, JSON.stringify(healthState), urgencyLevel, contactPhone, contactEmail];
            const result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    data: {
                        emergencyId: result.rows[0].id,
                        status: result.rows[0].status,
                        createdAt: result.rows[0].created_at
                    }
                };
            }

            return {
                success: false,
                message: 'Failed to create emergency request'
            };

        } catch (error) {
            console.error('Error creating emergency request:', error);
            return {
                success: false,
                message: 'Database error occurred'
            };
        }
    }

    async acceptEmergencyRequest(acceptanceData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { emergencyId, providerId, estimatedArrivalTime, currentLocation, acceptedAt } = acceptanceData;

            // Check if emergency exists and is still pending
            const checkQuery = `
                SELECT status, assigned_provider_id 
                FROM emergency_requests 
                WHERE id = $1 FOR UPDATE
            `;
            const checkResult = await client.query(checkQuery, [emergencyId]);

            if (checkResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    message: 'Emergency request not found'
                };
            }

            const emergency = checkResult.rows[0];
            if (emergency.status !== 'pending') {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    message: `Emergency request is already ${emergency.status}`
                };
            }

            if (emergency.assigned_provider_id) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    message: 'Emergency request has already been assigned to another provider'
                };
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
                RETURNING id, status, assigned_provider_id
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

            // Log the acceptance
            await this.logEmergencyAction(client, {
                emergencyId,
                providerId,
                action: 'accepted',
                details: { estimatedArrivalTime, currentLocation }
            });

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    emergencyId: updateResult.rows[0].id,
                    status: updateResult.rows[0].status,
                    assignedProviderId: updateResult.rows[0].assigned_provider_id,
                    acceptedAt
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error accepting emergency request:', error);
            return {
                success: false,
                message: 'Database error occurred'
            };
        } finally {
            client.release();
        }
    }

    async declineEmergencyRequest(declineData) {
        try {
            const { emergencyId, providerId, declineReason, declinedAt } = declineData;

            // Log the decline
            const query = `
                INSERT INTO emergency_provider_responses (
                    emergency_id,
                    provider_id,
                    response_type,
                    response_details,
                    responded_at
                ) VALUES ($1, $2, 'declined', $3, $4)
            `;

            await pool.query(query, [
                emergencyId,
                providerId,
                JSON.stringify({ reason: declineReason }),
                declinedAt
            ]);

            return {
                success: true,
                data: {
                    emergencyId,
                    providerId,
                    response: 'declined'
                }
            };

        } catch (error) {
            console.error('Error declining emergency request:', error);
            return {
                success: false,
                message: 'Database error occurred'
            };
        }
    }

    async updateEmergencyStatus(updateData) {
        try {
            const { emergencyId, providerId, status, notes, currentLocation, updatedAt } = updateData;

            const query = `
                UPDATE emergency_requests 
                SET 
                    status = $1,
                    provider_notes = $2,
                    provider_location = $3,
                    updated_at = $4
                WHERE id = $5 AND assigned_provider_id = $6
                RETURNING id, status, updated_at
            `;

            let providerLocation = null;
            if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                providerLocation = `ST_SetSRID(ST_MakePoint(${currentLocation.longitude}, ${currentLocation.latitude}), 4326)::geography`;
            }

            const values = [
                status,
                notes || null,
                providerLocation,
                updatedAt,
                emergencyId,
                providerId
            ];

            const result = await pool.query(query, values);

            if (result.rows.length > 0) {
                // Log the status update
                await this.logEmergencyAction(null, {
                    emergencyId,
                    providerId,
                    action: 'status_update',
                    details: { status, notes, currentLocation }
                });

                return {
                    success: true,
                    data: {
                        emergencyId: result.rows[0].id,
                        status: result.rows[0].status,
                        updatedAt: result.rows[0].updated_at
                    }
                };
            }

            return {
                success: false,
                message: 'Emergency request not found or not assigned to this provider'
            };

        } catch (error) {
            console.error('Error updating emergency status:', error);
            return {
                success: false,
                message: 'Database error occurred'
            };
        }
    }

    async getProviderEmergencies(queryData) {
        try {
            const { providerId, status, limit, offset } = queryData;

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
                    vu.fullname as user_name,
                    vu.phone_number as user_phone,
                    ST_X(er.location::geometry) as longitude,
                    ST_Y(er.location::geometry) as latitude
                FROM emergency_requests er
                JOIN verified_users vu ON er.user_id = vu.id
                ${whereClause}
                ORDER BY er.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            queryParams.push(limit, offset);
            const result = await pool.query(query, queryParams);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM emergency_requests er
                ${whereClause}
            `;

            const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
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
                        phone: row.user_phone
                    },
                    location: {
                        latitude: parseFloat(row.latitude),
                        longitude: parseFloat(row.longitude)
                    },
                    timestamps: {
                        createdAt: row.created_at,
                        acceptedAt: row.accepted_at,
                        estimatedArrival: row.estimated_arrival_time
                    },
                    providerNotes: row.provider_notes
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            };

        } catch (error) {
            console.error('Error getting provider emergencies:', error);
            return {
                success: false,
                message: 'Database error occurred'
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
                    sp.service_provider_id,
                    vu.fullname as provider_name,
                    vu.phone_number as provider_phone,
                    ST_X(er.location::geometry) as longitude,
                    ST_Y(er.location::geometry) as latitude,
                    CASE 
                        WHEN er.provider_location IS NOT NULL THEN 
                            json_build_object(
                                'latitude', ST_Y(er.provider_location::geometry),
                                'longitude', ST_X(er.provider_location::geometry)
                            )
                        ELSE NULL
                    END as provider_current_location
                FROM emergency_requests er
                LEFT JOIN service_provider_profile sp ON er.assigned_provider_id = sp.service_provider_id
                LEFT JOIN verified_users vu ON sp.service_provider_id = vu.id
                WHERE er.id = $1 AND er.user_id = $2
            `;

            const result = await pool.query(query, [emergencyId, userId]);

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
                            currentLocation: row.provider_current_location
                        } : null,
                        timestamps: {
                            createdAt: row.created_at,
                            acceptedAt: row.accepted_at,
                            estimatedArrival: row.estimated_arrival_time
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
                message: 'Database error occurred'
            };
        }
    }

    async logEmergencyAction(client, actionData) {
        try {
            const { emergencyId, providerId, action, details } = actionData;
            const queryClient = client || pool;

            const query = `
                INSERT INTO emergency_action_logs (
                    emergency_id,
                    provider_id,
                    action_type,
                    action_details,
                    action_timestamp
                ) VALUES ($1, $2, $3, $4, NOW())
            `;

            await queryClient.query(query, [
                emergencyId,
                providerId,
                action,
                JSON.stringify(details)
            ]);

        } catch (error) {
            console.error('Error logging emergency action:', error);
            // Don't throw - logging failure shouldn't break the main flow
        }
    }
}

module.exports = EmergencyService;
