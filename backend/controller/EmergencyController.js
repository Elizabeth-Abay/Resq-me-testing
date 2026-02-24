const EmergencyService = require('../service/EmergencyService');

class EmergencyController {
    constructor() {
        this.emergencyService = new EmergencyService();
    }

    // Endpoint for providers to accept emergency requests
    async acceptEmergencyRequest(req, res) {
        try {
            const { emergencyId, providerId, estimatedArrivalTime, currentLocation } = req.body;
            const { userId } = req.decodedAccess; // Provider's user ID from token

            // Validate required fields
            if (!emergencyId || !estimatedArrivalTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Emergency ID and estimated arrival time are required'
                });
            }

            // Accept the emergency request
            const result = await this.emergencyService.acceptEmergencyRequest({
                emergencyId,
                providerId: userId, // Use the authenticated provider's ID
                estimatedArrivalTime,
                currentLocation,
                acceptedAt: new Date().toISOString()
            });

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Emergency request accepted successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'Failed to accept emergency request'
                });
            }

        } catch (error) {
            console.error('Error in EmergencyController.acceptEmergencyRequest:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Endpoint for providers to decline emergency requests
    async declineEmergencyRequest(req, res) {
        try {
            const { emergencyId, declineReason } = req.body;
            const { userId } = req.decodedAccess; // Provider's user ID from token

            if (!emergencyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Emergency ID is required'
                });
            }

            const result = await this.emergencyService.declineEmergencyRequest({
                emergencyId,
                providerId: userId,
                declineReason,
                declinedAt: new Date().toISOString()
            });

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Emergency request declined',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'Failed to decline emergency request'
                });
            }

        } catch (error) {
            console.error('Error in EmergencyController.declineEmergencyRequest:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Endpoint for providers to update their status (en route, arrived, completed)
    async updateEmergencyStatus(req, res) {
        try {
            const { emergencyId, status, notes, currentLocation } = req.body;
            const { userId } = req.decodedAccess;

            if (!emergencyId || !status) {
                return res.status(400).json({
                    success: false,
                    message: 'Emergency ID and status are required'
                });
            }

            // Validate status
            const validStatuses = ['en_route', 'arrived', 'in_progress', 'completed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const result = await this.emergencyService.updateEmergencyStatus({
                emergencyId,
                providerId: userId,
                status,
                notes,
                currentLocation,
                updatedAt: new Date().toISOString()
            });

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Emergency status updated successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'Failed to update emergency status'
                });
            }

        } catch (error) {
            console.error('Error in EmergencyController.updateEmergencyStatus:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Endpoint for providers to get their active emergency requests
    async getActiveEmergencies(req, res) {
        try {
            const { userId } = req.decodedAccess;
            const { status, limit = 10, offset = 0 } = req.query;

            const result = await this.emergencyService.getProviderEmergencies({
                providerId: userId,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Error in EmergencyController.getActiveEmergencies:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Endpoint for users to create emergency requests
    async createEmergencyRequest(req, res) {
        try {
            const { userId } = req.decodedAccess;
            const { 
                latitude, 
                longitude, 
                healthState, 
                urgencyLevel = 'medium',
                contactPhone,
                contactEmail 
            } = req.body;

            // Validate required fields
            if (!latitude || !longitude || !healthState) {
                return res.status(400).json({
                    success: false,
                    message: 'Latitude, longitude, and health state are required'
                });
            }

            // Validate coordinates
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coordinates'
                });
            }

            // Validate urgency level
            const validUrgencyLevels = ['low', 'medium', 'high', 'critical'];
            if (!validUrgencyLevels.includes(urgencyLevel)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid urgency level. Must be one of: ${validUrgencyLevels.join(', ')}`
                });
            }

            const result = await this.emergencyService.createEmergencyRequest({
                userId,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                healthState,
                urgencyLevel,
                contactPhone,
                contactEmail
            });

            if (result.success) {
                return res.status(201).json({
                    success: true,
                    message: 'Emergency request created successfully',
                    data: result.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'Failed to create emergency request'
                });
            }

        } catch (error) {
            console.error('Error in EmergencyController.createEmergencyRequest:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Endpoint for users to get their emergency request status
    async getEmergencyStatus(req, res) {
        try {
            const { userId } = req.decodedAccess;
            const { emergencyId } = req.params;

            if (!emergencyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Emergency ID is required'
                });
            }

            const result = await this.emergencyService.getEmergencyStatus({
                emergencyId,
                userId
            });

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    data: result.data
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: result.message || 'Emergency request not found'
                });
            }

        } catch (error) {
            console.error('Error in EmergencyController.getEmergencyStatus:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = EmergencyController;
