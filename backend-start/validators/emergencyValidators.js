const Joi = require('joi');
const { Logger } = require('../utils/Logger');

// Health state validation schema
const healthStateSchema = Joi.object({
    condition: Joi.string().required().min(1).max(200).messages({
        'string.empty': 'Health condition cannot be empty',
        'string.min': 'Health condition must be at least 1 character',
        'string.max': 'Health condition cannot exceed 200 characters',
        'any.required': 'Health condition is required'
    }),
    severity: Joi.string().valid('mild', 'moderate', 'severe', 'critical').required().messages({
        'any.only': 'Severity must be one of: mild, moderate, severe, critical',
        'any.required': 'Severity is required'
    }),
    symptoms: Joi.array().items(
        Joi.string().min(1).max(100)
    ).max(10).optional().messages({
        'array.max': 'Cannot have more than 10 symptoms'
    }),
    medications: Joi.array().items(
        Joi.object({
            name: Joi.string().min(1).max(100).required(),
            dosage: Joi.string().min(1).max(50).optional(),
            frequency: Joi.string().min(1).max(50).optional()
        })
    ).max(5).optional().messages({
        'array.max': 'Cannot have more than 5 medications'
    }),
    allergies: Joi.array().items(
        Joi.string().min(1).max(100)
    ).max(10).optional().messages({
        'array.max': 'Cannot have more than 10 allergies'
    }),
    medicalHistory: Joi.array().items(
        Joi.string().min(1).max(200)
    ).max(5).optional().messages({
        'array.max': 'Cannot have more than 5 medical history entries'
    }),
    additionalNotes: Joi.string().max(500).optional().messages({
        'string.max': 'Additional notes cannot exceed 500 characters'
    })
}).messages({
    'object.unknown': 'Invalid field in health state data'
});

// Location validation schema
const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90',
        'any.required': 'Latitude is required'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180',
        'any.required': 'Longitude is required'
    })
});

// Contact information validation
const contactInfoSchema = Joi.object({
    phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).min(10).max(20).optional().messages({
        'string.pattern.base': 'Phone number must contain only digits, spaces, and basic phone characters',
        'string.min': 'Phone number must be at least 10 characters',
        'string.max': 'Phone number cannot exceed 20 characters'
    }),
    email: Joi.string().email().max(255).optional().messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email cannot exceed 255 characters'
    })
}).or('phone', 'email').messages({
    'object.missing': 'At least one contact method (phone or email) is required'
});

// Emergency request validation
const createEmergencySchema = {
    body: Joi.object({
        latitude: Joi.number().min(-90).max(90).required().messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'any.required': 'Latitude is required'
        }),
        longitude: Joi.number().min(-180).max(180).required().messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'any.required': 'Longitude is required'
        }),
        healthState: healthStateSchema.required(),
        urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium').messages({
            'any.only': 'Urgency level must be one of: low, medium, high, critical'
        }),
        contactPhone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).min(10).max(20).optional().messages({
            'string.pattern.base': 'Phone number must contain only digits, spaces, and basic phone characters',
            'string.min': 'Phone number must be at least 10 characters',
            'string.max': 'Phone number cannot exceed 20 characters'
        }),
        contactEmail: Joi.string().email().max(255).optional().messages({
            'string.email': 'Please provide a valid email address',
            'string.max': 'Email cannot exceed 255 characters'
        })
    }).custom((value, helpers) => {
        // Validate that at least one contact method is provided
        if (!value.contactPhone && !value.contactEmail) {
            return helpers.error('custom.contactRequired');
        }
        return value;
    }, 'Contact Validation').messages({
        'custom.contactRequired': 'At least one contact method (phone or email) is required'
    })
};

// Accept emergency request validation
const acceptEmergencySchema = {
    body: Joi.object({
        emergencyId: Joi.string().uuid().required().messages({
            'string.guid': 'Emergency ID must be a valid UUID',
            'any.required': 'Emergency ID is required'
        }),
        estimatedArrivalTime: Joi.date().iso().min('now').required().messages({
            'date.format': 'Estimated arrival time must be a valid ISO date',
            'date.min': 'Estimated arrival time must be in the future',
            'any.required': 'Estimated arrival time is required'
        }),
        currentLocation: locationSchema.optional(),
        notes: Joi.string().max(500).optional().messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
    })
};

// Decline emergency request validation
const declineEmergencySchema = {
    body: Joi.object({
        emergencyId: Joi.string().uuid().required().messages({
            'string.guid': 'Emergency ID must be a valid UUID',
            'any.required': 'Emergency ID is required'
        }),
        declineReason: Joi.string().min(1).max(200).optional().messages({
            'string.empty': 'Decline reason cannot be empty',
            'string.min': 'Decline reason must be at least 1 character',
            'string.max': 'Decline reason cannot exceed 200 characters'
        })
    })
};

// Update emergency status validation
const updateStatusSchema = {
    body: Joi.object({
        emergencyId: Joi.string().uuid().required().messages({
            'string.guid': 'Emergency ID must be a valid UUID',
            'any.required': 'Emergency ID is required'
        }),
        status: Joi.string().valid('en_route', 'arrived', 'in_progress', 'completed').required().messages({
            'any.only': 'Status must be one of: en_route, arrived, in_progress, completed',
            'any.required': 'Status is required'
        }),
        notes: Joi.string().max(1000).optional().messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        }),
        currentLocation: locationSchema.optional(),
        completionDetails: Joi.object({
            outcome: Joi.string().valid('resolved', 'transferred', 'cancelled').optional(),
            finalNotes: Joi.string().max(1000).optional(),
            followUpRequired: Joi.boolean().optional(),
            followUpDetails: Joi.string().max(500).optional()
        }).optional()
    })
};

// Get emergency status validation
const getEmergencyStatusSchema = {
    params: Joi.object({
        emergencyId: Joi.string().uuid().required().messages({
            'string.guid': 'Emergency ID must be a valid UUID',
            'any.required': 'Emergency ID is required'
        })
    })
};

// Provider emergencies query validation
const getProviderEmergenciesSchema = {
    query: Joi.object({
        status: Joi.string().valid('pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed').optional(),
        limit: Joi.number().integer().min(1).max(100).default(10).messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100',
            'number.integer': 'Limit must be an integer'
        }),
        offset: Joi.number().integer().min(0).default(0).messages({
            'number.min': 'Offset cannot be negative',
            'number.integer': 'Offset must be an integer'
        }),
        startDate: Joi.date().iso().optional().messages({
            'date.format': 'Start date must be a valid ISO date'
        }),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
            'date.format': 'End date must be a valid ISO date',
            'date.min': 'End date must be after start date'
        })
    })
};

// Custom validation functions
const validateCoordinates = (latitude, longitude) => {
    // Additional coordinate validation
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
        return { valid: false, message: 'Coordinates must be valid numbers' };
    }
    
    // Check if coordinates are in reasonable ranges (more strict than Joi)
    if (lat < -85 || lat > 85) {
        return { valid: false, message: 'Latitude appears to be invalid' };
    }
    
    if (lng < -180 || lng > 180) {
        return { valid: false, message: 'Longitude appears to be invalid' };
    }
    
    // Check for obvious invalid coordinates (like 0,0 in the middle of ocean)
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) {
        return { valid: false, message: 'Coordinates appear to be invalid (null island)' };
    }
    
    return { valid: true };
};

const validateHealthState = (healthState) => {
    // Check for potentially dangerous or invalid content
    const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
        /javascript:/gi, // JavaScript protocol
        /on\w+\s*=/gi, // Event handlers
        /data:text\/html/gi // Data URLs
    ];
    
    const healthString = JSON.stringify(healthState);
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(healthString)) {
            Logger.security.suspiciousActivity(null, null, 'Invalid health state content', { 
                healthState: healthString.substring(0, 200) 
            });
            return { valid: false, message: 'Health state contains invalid content' };
        }
    }
    
    return { valid: true };
};

const sanitizeString = (str) => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:text\/html/gi, '')
        .trim();
};

// Validation middleware factory
const createValidationMiddleware = (schema, source = 'body') => {
    return (req, res, next) => {
        const data = req[source];
        
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        
        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            Logger.security.suspiciousActivity(
                req.decodedAccess?.userId,
                req.ip,
                'Validation failed',
                {
                    endpoint: req.path,
                    method: req.method,
                    errors: validationErrors,
                    input: data
                }
            );
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        
        // Additional custom validations
        if (source === 'body' && value.latitude && value.longitude) {
            const coordValidation = validateCoordinates(value.latitude, value.longitude);
            if (!coordValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: coordValidation.message
                });
            }
        }
        
        if (source === 'body' && value.healthState) {
            const healthValidation = validateHealthState(value.healthState);
            if (!healthValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: healthValidation.message
                });
            }
            
            // Sanitize health state
            value.healthState = JSON.parse(JSON.stringify(value.healthState).replace(/\\n/g, ' ').replace(/\\r/g, ' '));
        }
        
        // Sanitize string fields
        if (source === 'body') {
            Object.keys(value).forEach(key => {
                if (typeof value[key] === 'string') {
                    value[key] = sanitizeString(value[key]);
                }
            });
        }
        
        req.validatedBody = value;
        next();
    };
};

// Parameter validation middleware
const createParamsValidationMiddleware = (schema) => {
    return createValidationMiddleware(schema, 'params');
};

// Query validation middleware
const createQueryValidationMiddleware = (schema) => {
    return createValidationMiddleware(schema, 'query');
};

module.exports = {
    createEmergencySchema,
    acceptEmergencySchema,
    declineEmergencySchema,
    updateStatusSchema,
    getEmergencyStatusSchema,
    getProviderEmergenciesSchema,
    healthStateSchema,
    locationSchema,
    contactInfoSchema,
    validateCoordinates,
    validateHealthState,
    sanitizeString,
    createValidationMiddleware,
    createParamsValidationMiddleware,
    createQueryValidationMiddleware
};
