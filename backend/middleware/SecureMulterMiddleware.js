const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('../utils/Logger');

class SecureMulterMiddleware {
    constructor() {
        this.allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif'
        ];
        
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.maxFiles = 5; // Maximum files per request
    }

    // Enhanced memory storage with validation
    getMemoryStorage() {
        return multer.memoryStorage();
    }

    // File filter for security
    fileFilter = (req, file, cb) => {
        try {
            // Check MIME type
            if (!this.allowedMimeTypes.includes(file.mimetype)) {
                Logger.security.suspiciousActivity(
                    req.decodedAccess?.userId,
                    req.ip,
                    'Invalid file type uploaded',
                    {
                        filename: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size
                    }
                );
                return cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`), false);
            }

            // Check filename for suspicious patterns
            const filename = file.originalname.toLowerCase();
            const suspiciousPatterns = [
                /\.exe$/i,
                /\.bat$/i,
                /\.cmd$/i,
                /\.scr$/i,
                /\.pif$/i,
                /\.com$/i,
                /\.js$/i,
                /\.vbs$/i,
                /\.jar$/i,
                /\.app$/i,
                /\.deb$/i,
                /\.rpm$/i,
                /\.dmg$/i,
                /\.pkg$/i
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.test(filename)) {
                    Logger.security.suspiciousActivity(
                        req.decodedAccess?.userId,
                        req.ip,
                        'Suspicious file extension detected',
                        {
                            filename: file.originalname,
                            pattern: pattern.toString()
                        }
                    );
                    return cb(new Error(`File extension not allowed: ${filename}`), false);
                }
            }

            // Check for double extensions
            if (filename.includes('.') && filename.split('.').length > 2) {
                Logger.security.suspiciousActivity(
                    req.decodedAccess?.userId,
                    req.ip,
                    'Multiple file extensions detected',
                    {
                        filename: file.originalname
                    }
                );
                return cb(new Error('Multiple file extensions not allowed'), false);
            }

            // Check filename length
            if (filename.length > 255) {
                return cb(new Error('Filename too long (max 255 characters)'), false);
            }

            // Check for path traversal attempts
            if (filename.includes('../') || filename.includes('..\\')) {
                Logger.security.suspiciousActivity(
                    req.decodedAccess?.userId,
                    req.ip,
                    'Path traversal attempt in filename',
                    {
                        filename: file.originalname
                    }
                );
                return cb(new Error('Invalid filename'), false);
            }

            cb(null, true);

        } catch (error) {
            Logger.health.error('file_filter', error, {
                filename: file.originalname,
                mimetype: file.mimetype
            });
            cb(error, false);
        }
    };

    // Enhanced limits with security considerations
    getLimits() {
        return {
            fileSize: this.maxFileSize,
            files: this.maxFiles,
            fields: 10, // Maximum number of form fields
            fieldNameSize: 100, // Maximum field name size
            fieldSize: 1024 * 1024 // Maximum field value size (1MB)
        };
    }

    // Generate secure filename
    generateSecureFilename(originalname) {
        const ext = path.extname(originalname);
        const name = path.basename(originalname, ext);
        const timestamp = Date.now();
        const random = crypto.randomBytes(16).toString('hex');
        
        // Sanitize filename
        const sanitizedName = name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 50); // Limit length
        
        return `${sanitizedName}_${timestamp}_${random}${ext}`;
    }

    // Multi-upload middleware for ID cards (front and back)
    getMultiUploadMiddleware() {
        return multer({
            storage: this.getMemoryStorage(),
            limits: this.getLimits(),
            fileFilter: this.fileFilter
        }).fields([
            {
                name: 'front',
                maxCount: 1
            },
            {
                name: 'back',
                maxCount: 1
            },
            {
                name: 'profilePic',
                maxCount: 1
            }
        ]);
    }

    // Single upload middleware for license pictures
    getSingleUploadMiddleware(fieldName = 'license-picture') {
        return multer({
            storage: this.getMemoryStorage(),
            limits: this.getLimits(),
            fileFilter: this.fileFilter
        }).single(fieldName);
    }

    // Multi-upload for emergency contacts
    getEmergencyContactUploadMiddleware() {
        return multer({
            storage: this.getMemoryStorage(),
            limits: {
                ...this.getLimits(),
                files: 5 // 5 emergency contacts max
            },
            fileFilter: this.fileFilter
        }).fields([
            {
                name: 'first-emergency',
                maxCount: 1
            },
            {
                name: 'second-emergency',
                maxCount: 1
            },
            {
                name: 'third-emergency',
                maxCount: 1
            },
            {
                name: 'fourth-emergency',
                maxCount: 1
            },
            {
                name: 'fifth-emergency',
                maxCount: 1
            }
        ]);
    }

    // Custom upload middleware with validation
    getCustomUploadMiddleware(options = {}) {
        const config = {
            maxFiles: options.maxFiles || 1,
            maxFileSize: options.maxFileSize || this.maxFileSize,
            allowedTypes: options.allowedTypes || this.allowedMimeTypes,
            required: options.required || false
        };

        return multer({
            storage: this.getMemoryStorage(),
            limits: {
                fileSize: config.maxFileSize,
                files: config.maxFiles
            },
            fileFilter: (req, file, cb) => {
                // Check if file is required
                if (config.required && !file) {
                    return cb(new Error('File is required'), false);
                }

                // Check allowed types for this upload
                if (!config.allowedTypes.includes(file.mimetype)) {
                    return cb(new Error(`File type ${file.mimetype} not allowed`), false);
                }

                // Use the main file filter
                this.fileFilter(req, file, cb);
            }
        });
    }

    // Validation middleware to check if files were uploaded
    requireFiles(fieldNames) {
        return (req, res, next) => {
            const missingFiles = [];

            if (Array.isArray(fieldNames)) {
                for (const fieldName of fieldNames) {
                    if (!req.files || !req.files[fieldName] || req.files[fieldName].length === 0) {
                        missingFiles.push(fieldName);
                    }
                }
            } else {
                if (!req.file) {
                    missingFiles.push(fieldNames);
                }
            }

            if (missingFiles.length > 0) {
                Logger.security.suspiciousActivity(
                    req.decodedAccess?.userId,
                    req.ip,
                    'Required files missing',
                    {
                        missingFiles,
                        path: req.path
                    }
                );
                return res.status(400).json({
                    success: false,
                    message: `Required files missing: ${missingFiles.join(', ')}`,
                    code: 'REQUIRED_FILES_MISSING',
                    missingFiles
                });
            }

            next();
        };
    }

    // Middleware to validate uploaded files
    validateUploadedFiles() {
        return (req, res, next) => {
            try {
                if (req.files) {
                    for (const [fieldName, files] of Object.entries(req.files)) {
                        const fileArray = Array.isArray(files) ? files : [files];
                        
                        for (const file of fileArray) {
                            // Additional validation after upload
                            if (file.size === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: `File ${fieldName} is empty`,
                                    code: 'EMPTY_FILE'
                                });
                            }

                            // Validate file buffer
                            if (!file.buffer || file.buffer.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: `File ${fieldName} has no content`,
                                    code: 'NO_FILE_CONTENT'
                                });
                            }

                            // Log successful upload
                            Logger.info(`File uploaded successfully`, {
                                field: fieldName,
                                filename: file.originalname,
                                size: file.size,
                                mimetype: file.mimetype,
                                userId: req.decodedAccess?.userId
                            });
                        }
                    }
                }

                next();
            } catch (error) {
                Logger.health.error('file_validation', error, {
                    userId: req.decodedAccess?.userId
                });
                return res.status(500).json({
                    success: false,
                    message: 'File validation failed',
                    code: 'VALIDATION_ERROR'
                });
            }
        };
    }

    // Get file statistics
    getStats() {
        return {
            allowedMimeTypes: this.allowedMimeTypes,
            maxFileSize: this.maxFileSize,
            maxFiles: this.maxFiles
        };
    }
}

// Create singleton instance
const secureMulterMiddleware = new SecureMulterMiddleware();

module.exports = secureMulterMiddleware;
