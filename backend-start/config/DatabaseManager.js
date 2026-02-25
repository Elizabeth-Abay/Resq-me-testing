const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const EventEmitter = require('events');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

class DatabaseManager extends EventEmitter {
    constructor() {
        super();
        this.pool = null;
        this.isInitialized = false;
        this.connectionCount = 0;
        this.maxConnections = 20;
        this.idleTimeoutMillis = 30000;
        this.connectionTimeoutMillis = 2000;
    }

    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    async initialize() {
        if (this.isInitialized) {
            return this.pool;
        }

        try {
            this.pool = new Pool({
                host: process.env.DATA_BASE_HOST,
                user: process.env.DATA_BASE_USER,
                password: process.env.DATA_BASE_USER_PASSWORD,
                database: process.env.DATA_BASE,
                max: this.maxConnections,
                idleTimeoutMillis: this.idleTimeoutMillis,
                connectionTimeoutMillis: this.connectionTimeoutMillis,
                // Add connection retry logic
                application_name: 'resqmission-api',
                // Enable statement logging in development
                ...(process.env.NODE_ENV === 'development' && {
                    log: (msg) => console.log('Database:', msg)
                })
            });

            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isInitialized = true;
            this.connectionCount = 0;

            // Monitor pool events
            this.pool.on('connect', () => {
                this.connectionCount++;
                this.emit('connection:opened', { count: this.connectionCount });
            });

            this.pool.on('remove', () => {
                this.connectionCount--;
                this.emit('connection:closed', { count: this.connectionCount });
            });

            this.pool.on('error', (err) => {
                console.error('Database pool error:', err);
                this.emit('error', err);
            });

            console.log('Database connection pool initialized successfully');
            return this.pool;

        } catch (error) {
            console.error('Failed to initialize database pool:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async getPool() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.pool;
    }

    async getClient() {
        const pool = await this.getPool();
        return pool.connect();
    }

    async query(text, params) {
        const pool = await this.getPool();
        return pool.query(text, params);
    }

    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health_check');
            return {
                status: 'healthy',
                connectionCount: this.connectionCount,
                totalConnections: this.pool.totalCount,
                idleConnections: this.pool.idleCount,
                waitingConnections: this.pool.waitingCount
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isInitialized = false;
            console.log('Database connection pool closed');
        }
    }

    // Transaction helper
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Export singleton instance
module.exports = DatabaseManager.getInstance();
