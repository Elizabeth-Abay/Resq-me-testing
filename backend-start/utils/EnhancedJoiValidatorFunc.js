const Joi = require('joi');
const { Logger } = require('./Logger');

class EnhancedJoiValidator {
    constructor() {
        this.defaultOptions = {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
            allowUnknown: false,
            strip: true
        };
    }

    // Enhanced validator creator with better error handling
    valiatoreCreator(schema, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        return function validator(req, res, next) {
            try {
                // Log request for debugging (only in development)
                if (process.env.NODE_ENV === 'development') {
                    Logger.debug(`Validating request body`, {
                        body: req.body,
                        schema: schema.describe(),
                        path: req.path,
                        method: req.method
                    });
                }

                const { error, value, warning } = schema.validate(req.body, mergedOptions);
                
                if (error) {
                    const validationErrors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value,
                        type: detail.type,
                        context: detail.context
                    }));

                    Logger.security.suspiciousActivity(
                        req.decodedAccess?.userId,
                        req.ip,
                        'Validation failed',
                        {
                            endpoint: req.path,
                            method: req.method,
                            errors: validationErrors,
                            input: this.sanitizeInputForLogging(req.body)
                        }
                    );

                    return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors: validationErrors,
                        code: 'VALIDATION_ERROR'
                    });
                }

                // Log warnings
                if (warning) {
                    Logger.warn(`Validation warnings`, {
                        warnings: warning.details,
                        path: req.path,
                        method: req.method
                    });
                }

                // Sanitize validated data
                const sanitizedValue = this.sanitizeValidatedData(value);
                
                req.validatedBody = sanitizedValue;
                
                Logger.debug(`Validation successful`, {
                    validatedData: this.sanitizeInputForLogging(sanitizedValue),
                    path: req.path
                });
                
                next();

            } catch (err) {
                Logger.health.error('validator_creator', err, {
                    path: req.path,
                    method: req.method,
                    body: this.sanitizeInputForLogging(req.body)
                });

                return res.status(500).json({
                    success: false,
                    message: 'Validation error occurred',
                    code: 'VALIDATION_SYSTEM_ERROR'
                });
            }
        }.bind(this);
    }

    // Enhanced parameter validator
    validatorForParams(schema, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        return function validator(req, res, next) {
            try {
                Logger.debug(`Validating request params`, {
                    params: req.params,
                    query: req.query,
                    path: req.path
                });

                const { error, value, warning } = schema.validate(req.query, mergedOptions);
                
                if (error) {
                    const validationErrors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value,
                        type: detail.type,
                        context: detail.context
                    }));

                    Logger.security.suspiciousActivity(
                        req.decodedAccess?.userId,
                        req.ip,
                        'Parameter validation failed',
                        {
                            endpoint: req.path,
                            method: req.method,
                            errors: validationErrors,
                            params: this.sanitizeInputForLogging(req.params),
                            query: this.sanitizeInputForLogging(req.query)
                        }
                    );

                    return res.status(400).json({
                        success: false,
                        message: 'Parameter validation failed',
                        errors: validationErrors,
                        code: 'PARAM_VALIDATION_ERROR'
                    });
                }

                // Log warnings
                if (warning) {
                    Logger.warn(`Parameter validation warnings`, {
                        warnings: warning.details,
                        path: req.path
                    });
                }

                // Sanitize validated data
                const sanitizedValue = this.sanitizeValidatedData(value);
                
                req.validatedParams = sanitizedValue;
                
                Logger.debug(`Parameter validation successful`, {
                    validatedParams: this.sanitizeInputForLogging(sanitizedValue),
                    path: req.path
                });
                
                next();

            } catch (err) {
                Logger.health.error('validator_params', err, {
                    path: req.path,
                    method: req.method,
                    params: this.sanitizeInputForLogging(req.params),
                    query: this.sanitizeInputForLogging(req.query)
                });

                return res.status(500).json({
                    success: false,
                    message: 'Parameter validation error occurred',
                    code: 'PARAM_VALIDATION_SYSTEM_ERROR'
                });
            }
        }.bind(this);
    }

    // Path parameter validator
    validatorForPathParams(schema, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        return function validator(req, res, next) {
            try {
                Logger.debug(`Validating path parameters`, {
                    params: req.params,
                    path: req.path
                });

                const { error, value, warning } = schema.validate(req.params, mergedOptions);
                
                if (error) {
                    const validationErrors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value,
                        type: detail.type,
                        context: detail.context
                    }));

                    Logger.security.suspiciousActivity(
                        req.decodedAccess?.userId,
                        req.ip,
                        'Path parameter validation failed',
                        {
                            endpoint: req.path,
                            method: req.method,
                            errors: validationErrors,
                            params: this.sanitizeInputForLogging(req.params)
                        }
                    );

                    return res.status(400).json({
                        success: false,
                        message: 'Path parameter validation failed',
                        errors: validationErrors,
                        code: 'PATH_PARAM_VALIDATION_ERROR'
                    });
                }

                // Log warnings
                if (warning) {
                    Logger.warn(`Path parameter validation warnings`, {
                        warnings: warning.details,
                        path: req.path
                    });
                }

                // Sanitize validated data
                const sanitizedValue = this.sanitizeValidatedData(value);
                
                req.validatedPathParams = sanitizedValue;
                
                Logger.debug(`Path parameter validation successful`, {
                    validatedPathParams: this.sanitizeInputForLogging(sanitizedValue),
                    path: req.path
                });
                
                next();

            } catch (err) {
                Logger.health.error('validator_path_params', err, {
                    path: req.path,
                    method: req.method,
                    params: this.sanitizeInputForLogging(req.params)
                });

                return res.status(500).json({
                    success: false,
                    message: 'Path parameter validation error occurred',
                    code: 'PATH_PARAM_VALIDATION_SYSTEM_ERROR'
                });
            }
        }.bind(this);
    }

    // Custom validator with multiple sources
    validatorForMultipleSources(sources, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        return function validator(req, res, next) {
            try {
                const data = {};
                const errors = [];

                // Validate each source
                for (const [sourceName, sourceSchema] of Object.entries(sources)) {
                    const sourceData = req[sourceName];
                    
                    if (!sourceData) {
                        errors.push({
                            source: sourceName,
                            message: `Source ${sourceName} not found in request`
                        });
                        continue;
                    }

                    const { error, value } = sourceSchema.validate(sourceData, mergedOptions);
                    
                    if (error) {
                        errors.push({
                            source: sourceName,
                            errors: error.details.map(detail => ({
                                field: detail.path.join('.'),
                                message: detail.message,
                                value: detail.context?.value,
                                type: detail.type
                            }))
                        });
                    } else {
                        data[sourceName] = this.sanitizeValidatedData(value);
                    }
                }

                if (errors.length > 0) {
                    Logger.security.suspiciousActivity(
                        req.decodedAccess?.userId,
                        req.ip,
                        'Multi-source validation failed',
                        {
                            endpoint: req.path,
                            method: req.method,
                            errors
                        }
                    );

                    return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors,
                        code: 'MULTI_SOURCE_VALIDATION_ERROR'
                    });
                }

                // Merge validated data
                Object.assign(req, data);
                
                Logger.debug(`Multi-source validation successful`, {
                    validatedData: this.sanitizeInputForLogging(data),
                    path: req.path
                });
                
                next();

            } catch (err) {
                Logger.health.error('validator_multiple_sources', err, {
                    path: req.path,
                    method: req.method
                });

                return res.status(500).json({
                    success: false,
                    message: 'Multi-source validation error occurred',
                    code: 'MULTI_SOURCE_VALIDATION_SYSTEM_ERROR'
                });
            }
        }.bind(this);
    }

    // Sanitize validated data
    sanitizeValidatedData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sanitized = Array.isArray(data) ? [] : {};

        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Remove potentially dangerous content
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .replace(/data:text\/html/gi, '')
                    .trim();
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeValidatedData(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    // Sanitize input for logging (remove sensitive data)
    sanitizeInputForLogging(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'authorization',
            'creditCard', 'ssn', 'socialSecurity', 'bankAccount',
            'healthState', 'allergies', 'medications'
        ];

        const sanitized = { ...data };

        for (const [key, value] of Object.entries(sanitized)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                if (typeof value === 'string') {
                    sanitized[key] = value.length > 0 ? '[REDACTED]' : value;
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = '[REDACTED_OBJECT]';
                }
            }
        }

        return sanitized;
    }

    // Create custom validation schemas
    createCustomSchema(config) {
        let schema = {};

        for (const [fieldName, fieldConfig] of Object.entries(config)) {
            let fieldSchema = Joi;

            // Add type
            if (fieldConfig.type) {
                switch (fieldConfig.type) {
                    case 'string':
                        fieldSchema = fieldSchema.string();
                        break;
                    case 'number':
                        fieldSchema = fieldSchema.number();
                        break;
                    case 'boolean':
                        fieldSchema = fieldSchema.boolean();
                        break;
                    case 'array':
                        fieldSchema = fieldSchema.array();
                        break;
                    case 'object':
                        fieldSchema = fieldSchema.object();
                        break;
                    case 'email':
                        fieldSchema = fieldSchema.string().email();
                        break;
                    case 'uuid':
                        fieldSchema = fieldSchema.string().uuid();
                        break;
                    case 'date':
                        fieldSchema = fieldSchema.date();
                        break;
                    default:
                        fieldSchema = fieldSchema.any();
                }
            }

            // Add required
            if (fieldConfig.required) {
                fieldSchema = fieldSchema.required();
            }

            // Add optional
            if (fieldConfig.optional) {
                fieldSchema = fieldSchema.optional();
            }

            // Add min/max for strings
            if (fieldConfig.minLength !== undefined) {
                fieldSchema = fieldSchema.min(fieldConfig.minLength);
            }
            if (fieldConfig.maxLength !== undefined) {
                fieldSchema = fieldSchema.max(fieldConfig.maxLength);
            }

            // Add min/max for numbers
            if (fieldConfig.min !== undefined) {
                fieldSchema = fieldSchema.min(fieldConfig.min);
            }
            if (fieldConfig.max !== undefined) {
                fieldSchema = fieldSchema.max(fieldConfig.max);
            }

            // Add pattern for strings
            if (fieldConfig.pattern) {
                fieldSchema = fieldSchema.pattern(fieldConfig.pattern);
            }

            // Add valid values
            if (fieldConfig.valid) {
                fieldSchema = fieldSchema.valid(fieldConfig.valid);
            }

            // Add default value
            if (fieldConfig.default !== undefined) {
                fieldSchema = fieldSchema.default(fieldConfig.default);
            }

            // Add custom validation
            if (fieldConfig.custom) {
                fieldSchema = fieldSchema.custom(fieldConfig.custom);
            }

            // Add message
            if (fieldConfig.message) {
                fieldSchema = fieldSchema.message(fieldConfig.message);
            }

            schema[fieldName] = fieldSchema;
        }

        return Joi.object(schema);
    }

    // Get validator statistics
    getStats() {
        return {
            defaultOptions: this.defaultOptions,
            supportedTypes: ['string', 'number', 'boolean', 'array', 'object', 'email', 'uuid', 'date']
        };
    }
}

// Create singleton instance
const enhancedJoiValidator = new EnhancedJoiValidator();

module.exports = enhancedJoiValidator;
