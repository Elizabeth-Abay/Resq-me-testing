const express = require('express');
const EmergencyController = require('../controller/EmergencyController');
const { accessValidator } = require('../middleware/TokenValdiator');
const JoiValidatorMiddleware = require('../middleware/JoiValidatorMiddleware');

const router = express.Router();
const emergencyController = new EmergencyController();

// Validation schemas
const emergencyRequestSchema = {
    body: {
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        healthState: Joi.object().required(),
        urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
        contactPhone: Joi.string().optional(),
        contactEmail: Joi.string().email().optional()
    }
};

const acceptEmergencySchema = {
    body: {
        emergencyId: Joi.string().uuid().required(),
        estimatedArrivalTime: Joi.date().iso().required(),
        currentLocation: Joi.object({
            latitude: Joi.number().min(-90).max(90).required(),
            longitude: Joi.number().min(-180).max(180).required()
        }).optional()
    }
};

const declineEmergencySchema = {
    body: {
        emergencyId: Joi.string().uuid().required(),
        declineReason: Joi.string().optional()
    }
};

const updateStatusSchema = {
    body: {
        emergencyId: Joi.string().uuid().required(),
        status: Joi.string().valid('en_route', 'arrived', 'in_progress', 'completed').required(),
        notes: Joi.string().optional(),
        currentLocation: Joi.object({
            latitude: Joi.number().min(-90).max(90).required(),
            longitude: Joi.number().min(-180).max(180).required()
        }).optional()
    }
};

// User endpoints
router.post('/create', 
    accessValidator, 
    JoiValidatorMiddleware(emergencyRequestSchema),
    emergencyController.createEmergencyRequest.bind(emergencyController)
);

router.get('/status/:emergencyId',
    accessValidator,
    emergencyController.getEmergencyStatus.bind(emergencyController)
);

// Provider endpoints
router.post('/accept',
    accessValidator,
    JoiValidatorMiddleware(acceptEmergencySchema),
    emergencyController.acceptEmergencyRequest.bind(emergencyController)
);

router.post('/decline',
    accessValidator,
    JoiValidatorMiddleware(declineEmergencySchema),
    emergencyController.declineEmergencyRequest.bind(emergencyController)
);

router.put('/status',
    accessValidator,
    JoiValidatorMiddleware(updateStatusSchema),
    emergencyController.updateEmergencyStatus.bind(emergencyController)
);

router.get('/provider/active',
    accessValidator,
    emergencyController.getActiveEmergencies.bind(emergencyController)
);

module.exports = router;
