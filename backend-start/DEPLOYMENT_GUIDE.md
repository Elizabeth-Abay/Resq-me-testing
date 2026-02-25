# 🚀 ResQMission Enhanced Deployment Guide

## 📋 Overview

This guide covers the complete deployment of the enhanced ResQMission emergency response system with all security and scalability improvements.

## 🔧 Prerequisites

### System Requirements
- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 13.0 with PostGIS extension
- **Redis**: >= 6.0 (for rate limiting and caching)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB SSD

### Environment Variables
```bash
# Database Configuration
DATA_BASE_HOST=localhost
DATA_BASE_USER=your_db_user
DATA_BASE_USER_PASSWORD=your_db_password
DATA_BASE=resqmission

# Security
ACCESS_TOKEN_SECRET=your_super_secret_access_key_min_32_chars
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_min_32_chars
EMERGENCY_AUTH_SECRET=your_emergency_auth_secret_key

# Server Configuration
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Redis Configuration (optional but recommended)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# External Services
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Email Configuration
NODEMAILER_HOST=smtp.gmail.com
NODEMAILER_PORT=587
NODEMAILER_USER=your_email@gmail.com
NODEMAILER_PASS=your_app_password

# Provider Configuration
PROVIDER_BASE_URL=https://providers.yourdomain.com

# Logging
LOG_LEVEL=info
```

## 🗄️ Database Setup

### 1. PostgreSQL with PostGIS
```sql
-- Create database
CREATE DATABASE resqmission;

-- Connect to database
\c resqmission;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Run the schema files
\i database/emergency_tables.sql
\i database/emergency_enhanced_tables.sql
\i database/emergency_trigger.sql
```

### 2. Create Indexes for Performance
```sql
-- These are included in the schema files, but verify they exist:
SELECT indexname FROM pg_indexes WHERE tablename = 'emergency_requests';
SELECT indexname FROM pg_indexes WHERE tablename = 'service_provider_profile';
```

## 🚀 Application Deployment

### 1. Install Dependencies
```bash
# Use enhanced package.json
cp package.enhanced.json package.json

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs
chmod 755 logs
```

### 2. Start Services
```bash
# Start main API server
npm start

# Start emergency listener (in separate terminal/process)
npm run start:listener

# Or use PM2 for process management
pm2 start ecosystem.config.js
```

### 3. PM2 Configuration (Recommended)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'resqmission-api',
      script: 'config/SecureServer.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'resqmission-listener',
      script: 'config/RobustEmergencyListener.js',
      instances: 2,
      error_file: './logs/listener-error.log',
      out_file: './logs/listener-out.log',
      log_file: './logs/listener-combined.log',
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
```

## 🔒 Security Configuration

### 1. SSL/TLS Setup
```bash
# Using Nginx reverse proxy
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 5432/tcp  # PostgreSQL (if remote access needed)
ufw enable
```

### 3. Database Security
```sql
-- Create dedicated user with limited permissions
CREATE USER resqmission_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE resqmission TO resqmission_app;
GRANT USAGE ON SCHEMA public TO resqmission_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resqmission_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO resqmission_app;

-- Row Level Security (optional)
ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;
```

## 📊 Monitoring & Logging

### 1. Log Rotation
```bash
# Install logrotate
sudo apt-get install logrotate

# Create logrotate config
sudo nano /etc/logrotate.d/resqmission
```

```
/path/to/resqmission/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload resqmission-api
        pm2 reload resqmission-listener
    endscript
}
```

### 2. Health Monitoring
```bash
# Add to crontab
crontab -e

# Check health every 5 minutes
*/5 * * * * * curl -f http://localhost:3000/health || alert-admins

# Cleanup old logs daily
0 2 * * * * find /path/to/logs -name "*.log" -mtime +30 -delete
```

### 3. Performance Monitoring
```bash
# Install monitoring tools
npm install -g clinic

# Profile the application
clinic doctor -- node config/SecureServer.js
```

## 🔄 Backup Strategy

### 1. Database Backup
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/resqmission"
DB_NAME="resqmission"

# Create backup
pg_dump -h localhost -U postgres -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/backup_$DATE.sql

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

### 2. File Backup
```bash
# Backup uploaded files and logs
rsync -av /path/to/uploads/ /backups/uploads/
rsync -av /path/to/logs/ /backups/logs/
```

## 🧪 Testing

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Emergency Creation"
    weight: 70
    flow:
      - post:
          url: "/emergency/create"
          json:
            latitude: 40.7128
            longitude: -74.0060
            healthState:
              condition: "chest pain"
              severity: "high"
            urgencyLevel: "high"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U postgres -d resqmission

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 2. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart resqmission-api
```

#### 3. Emergency Listener Not Working
```bash
# Check listener status
curl http://localhost:3000/health

# Check logs
tail -f logs/emergency.log

# Restart listener
pm2 restart resqmission-listener
```

### Performance Tuning

#### 1. PostgreSQL Optimization
```sql
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 200
```

#### 2. Node.js Optimization
```bash
# Environment variables
export NODE_OPTIONS="--max-old-space-size=2048"
export UV_THREADPOOL_SIZE=16
```

## 📈 Scaling Up

### 1. Horizontal Scaling
```bash
# Multiple API instances
pm2 start ecosystem.config.js

# Load balancer configuration (Nginx)
upstream resqmission {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

### 2. Database Scaling
```sql
-- Read replicas
CREATE USER resqmission_read WITH PASSWORD 'read_password';
GRANT CONNECT ON DATABASE resqmission TO resqmission_read;
GRANT USAGE ON SCHEMA public TO resqmission_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO resqmission_read;
```

## 🔐 Security Checklist

- [ ] Environment variables set correctly
- [ ] Database uses dedicated user with limited permissions
- [ ] SSL/TLS configured
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] Security headers (Helmet) enabled
- [ ] CORS properly configured
- [ ] Log rotation setup
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Error handling tested
- [ ] Load testing completed

## 📞 Support

### Emergency Contacts
- **Technical Lead**: [Phone/Email]
- **System Administrator**: [Phone/Email]
- **Database Administrator**: [Phone/Email]

### Documentation
- API Documentation: `http://yourdomain.com/api`
- System Health: `http://yourdomain.com/health`
- Logs Location: `/path/to/logs/`

---

## 🎯 Success Metrics

After deployment, monitor these key metrics:

1. **Response Time**: < 200ms for 95% of requests
2. **Uptime**: > 99.9%
3. **Error Rate**: < 0.1%
4. **Emergency Processing Time**: < 30 seconds average
5. **Database Query Time**: < 100ms average
6. **Memory Usage**: < 80% of available RAM
7. **CPU Usage**: < 70% average

Your enhanced ResQMission system is now production-ready! 🎉
