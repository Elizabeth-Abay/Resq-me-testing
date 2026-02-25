-- Enhanced Emergency Response System Tables
-- Additional tables for the robust emergency system

-- Dead letter queue for failed provider contacts
CREATE TABLE IF NOT EXISTS emergency_dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES service_provider_profile(service_provider_id),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed'))
);

-- Emergency contact summary table
CREATE TABLE IF NOT EXISTS emergency_contact_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    contact_summary JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Logs for when no providers are found
CREATE TABLE IF NOT EXISTS emergency_no_provider_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_id UUID REFERENCES emergency_requests(id),
    location GEOGRAPHY(POINT, 4326),
    urgency_level VARCHAR(20),
    search_radius_km INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced emergency action logs with user tracking
ALTER TABLE emergency_action_logs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES verified_users(id),
ADD COLUMN IF NOT EXISTS action_metadata JSONB;

-- Provider availability tracking
ALTER TABLE service_provider_profile 
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_acceptance_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_completion_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_rate DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS total_emergencies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_responses INTEGER DEFAULT 0;

-- User subscriptions for tiered rate limiting
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES verified_users(id),
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Emergency performance metrics
CREATE TABLE IF NOT EXISTS emergency_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    provider_id UUID REFERENCES service_provider_profile(service_provider_id),
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Provider response time tracking
CREATE TABLE IF NOT EXISTS provider_response_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES service_provider_profile(service_provider_id),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    contact_sent_at TIMESTAMP NOT NULL,
    response_received_at TIMESTAMP,
    response_time_seconds INTEGER,
    response_type VARCHAR(20) CHECK (response_type IN ('accepted', 'declined', 'timeout')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced indexes for performance
CREATE INDEX IF NOT EXISTS idx_emergency_dead_letter_queue_emergency_id ON emergency_dead_letter_queue(emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_dead_letter_queue_provider_id ON emergency_dead_letter_queue(provider_id);
CREATE INDEX IF NOT EXISTS idx_emergency_dead_letter_queue_status ON emergency_dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_emergency_dead_letter_queue_next_retry ON emergency_dead_letter_queue(next_retry_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_emergency_contact_summary_emergency_id ON emergency_contact_summary(emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contact_summary_created_at ON emergency_contact_summary(created_at);

CREATE INDEX IF NOT EXISTS idx_emergency_no_provider_logs_created_at ON emergency_no_provider_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_no_provider_logs_location ON emergency_no_provider_logs USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_emergency_action_logs_user_id ON emergency_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_action_logs_action_timestamp ON emergency_action_logs(action_timestamp);

CREATE INDEX IF NOT EXISTS idx_service_provider_profile_available ON service_provider_profile(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_service_provider_profile_rating ON service_provider_profile(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_service_provider_profile_response_rate ON service_provider_profile(response_rate DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(subscription_tier);

CREATE INDEX IF NOT EXISTS idx_emergency_performance_metrics_emergency_id ON emergency_performance_metrics(emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_performance_metrics_provider_id ON emergency_performance_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_emergency_performance_metrics_type ON emergency_performance_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_provider_response_times_provider_id ON provider_response_times(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_response_times_emergency_id ON provider_response_times(emergency_id);
CREATE INDEX IF NOT EXISTS idx_provider_response_times_response_time ON provider_response_times(response_time_seconds);

-- Function to update provider statistics
CREATE OR REPLACE FUNCTION update_provider_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.response_type = 'accepted' THEN
        UPDATE service_provider_profile 
        SET 
            total_emergencies = total_emergencies + 1,
            successful_responses = successful_responses + 1,
            last_acceptance_time = NEW.response_received_at,
            response_rate = ROUND((successful_responses::DECIMAL / total_emergencies::DECIMAL) * 100, 2)
        WHERE service_provider_id = NEW.provider_id;
        
        INSERT INTO emergency_performance_metrics (
            emergency_id, provider_id, metric_type, metric_value, metric_unit
        ) VALUES (
            NEW.emergency_id, 
            NEW.provider_id, 
            'response_time', 
            NEW.response_time_seconds, 
            'seconds'
        );
        
    ELSIF TG_OP = 'INSERT' AND NEW.response_type = 'declined' THEN
        UPDATE service_provider_profile 
        SET 
            total_emergencies = total_emergencies + 1,
            response_rate = ROUND((successful_responses::DECIMAL / total_emergencies::DECIMAL) * 100, 2)
        WHERE service_provider_id = NEW.provider_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update provider stats
CREATE TRIGGER update_provider_stats_trigger
    AFTER INSERT ON provider_response_times
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_stats();

-- Function to clean up old dead letter queue entries
CREATE OR REPLACE FUNCTION cleanup_dead_letter_queue()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM emergency_dead_letter_queue 
    WHERE status = 'processed' 
    AND processed_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to retry failed dead letter queue entries
CREATE OR REPLACE FUNCTION retry_dead_letter_queue()
RETURNS INTEGER AS $$
DECLARE
    retry_count INTEGER;
    retry_entry RECORD;
BEGIN
    retry_count := 0;
    
    FOR retry_entry IN 
        SELECT id, provider_id, emergency_id, payload, retry_count as current_retry_count
        FROM emergency_dead_letter_queue 
        WHERE status = 'pending' 
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND retry_count < max_retries
        ORDER BY created_at
        LIMIT 100
    LOOP
        -- Update the entry to processing
        UPDATE emergency_dead_letter_queue 
        SET 
            status = 'processing',
            next_retry_at = NOW() + (retry_entry.current_retry_count + 1) * INTERVAL '1 minute'
        WHERE id = retry_entry.id;
        
        -- Here you would trigger the retry logic
        -- For now, just increment the retry count
        UPDATE emergency_dead_letter_queue 
        SET 
            retry_count = retry_count + 1,
            status = CASE 
                WHEN retry_entry.current_retry_count + 1 >= max_retries THEN 'failed'
                ELSE 'pending'
            END
        WHERE id = retry_entry.id;
        
        retry_count := retry_count + 1;
    END LOOP;
    
    RETURN retry_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get provider performance summary
CREATE OR REPLACE FUNCTION get_provider_performance_summary(provider_uuid UUID)
RETURNS TABLE (
    total_emergences INTEGER,
    successful_responses INTEGER,
    response_rate DECIMAL(5,2),
    average_response_time DECIMAL(8,2),
    last_acceptance TIMESTAMP,
    rating DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(spp.total_emergencies, 0) as total_emergences,
        COALESCE(spp.successful_responses, 0) as successful_responses,
        COALESCE(spp.response_rate, 0) as response_rate,
        COALESCE(AVG(prt.response_time_seconds), 0) as average_response_time,
        spp.last_acceptance_time,
        COALESCE(spp.average_rating, 0) as rating
    FROM service_provider_profile spp
    LEFT JOIN provider_response_times prt ON spp.service_provider_id = prt.provider_id
    WHERE spp.service_provider_id = provider_uuid
    GROUP BY spp.service_provider_id, spp.total_emergencies, spp.successful_responses, 
             spp.response_rate, spp.last_acceptance_time, spp.average_rating;
END;
$$ LANGUAGE plpgsql;

-- View for active emergencies with enhanced provider info
CREATE OR REPLACE VIEW active_emergencies_enhanced AS
SELECT 
    er.id,
    er.user_id,
    er.location,
    er.health_state,
    er.urgency_level,
    er.status,
    er.assigned_provider_id,
    er.created_at,
    er.accepted_at,
    er.estimated_arrival_time,
    er.provider_notes,
    vu.fullname as provider_name,
    vu.phone_number as provider_phone,
    vu.email as provider_email,
    spp.average_rating as provider_rating,
    spp.response_rate as provider_response_rate,
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
    -- Calculate response time
    EXTRACT(EPOCH FROM (er.accepted_at - er.created_at)) as response_time_seconds
FROM emergency_requests er
LEFT JOIN service_provider_profile sp ON er.assigned_provider_id = sp.service_provider_id
LEFT JOIN verified_users vu ON sp.service_provider_id = vu.id
LEFT JOIN service_provider_profile spp ON er.assigned_provider_id = spp.service_provider_id
WHERE er.status IN ('pending', 'accepted', 'en_route', 'arrived', 'in_progress');

-- Function to automatically mark long-running emergencies as stuck
CREATE OR REPLACE FUNCTION mark_stuck_emergencies()
RETURNS INTEGER AS $$
DECLARE
    stuck_count INTEGER;
BEGIN
    UPDATE emergency_requests 
    SET status = 'stuck',
        updated_at = NOW()
    WHERE status IN ('accepted', 'en_route', 'arrived', 'in_progress')
    AND created_at < NOW() - INTERVAL '4 hours';
    
    GET DIAGNOSTICS stuck_count = ROW_COUNT;
    
    -- Log the stuck emergencies
    INSERT INTO emergency_action_logs (
        emergency_id, action_type, action_details, action_timestamp
    )
    SELECT 
        id, 
        'marked_stuck', 
        json_build_object('previous_status', status, 'stuck_duration', EXTRACT(EPOCH FROM (NOW() - created_at)) || ' seconds'),
        NOW()
    FROM emergency_requests 
    WHERE status = 'stuck'
    AND updated_at = NOW();
    
    RETURN stuck_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup jobs (requires pg_cron extension)
-- Uncomment these if you have pg_cron installed:
/*
SELECT cron.schedule('cleanup-dead-letter-queue', '0 2 * * *', 'SELECT cleanup_dead_letter_queue();');
SELECT cron.schedule('retry-dead-letter-queue', '*/5 * * * *', 'SELECT retry_dead_letter_queue();');
SELECT cron.schedule('mark-stuck-emergencies', '0 * * * *', 'SELECT mark_stuck_emergencies();');
*/
