-- Emergency Notification Trigger Function
-- This function sends a pg_notify when a new emergency request is created

CREATE OR REPLACE FUNCTION notify_emergency_request()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    -- Construct the payload with location and health information
    payload := json_build_object(
        'emergency_id', NEW.id,
        'user_id', NEW.user_id,
        'latitude', ST_Y(NEW.location::geometry),
        'longitude', ST_X(NEW.location::geometry),
        'health_state', NEW.health_state,
        'urgency_level', NEW.urgency_level,
        'created_at', NEW.created_at,
        'contact_info', json_build_object(
            'phone', NEW.contact_phone,
            'email', NEW.contact_email
        )
    );
    
    -- Send notification with channel name and payload
    PERFORM pg_notify(
        'emergency_requests', 
        payload::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for emergency requests table
-- Replace 'emergency_requests' with your actual table name
DROP TRIGGER IF EXISTS emergency_request_trigger ON emergency_requests;
CREATE TRIGGER emergency_request_trigger
    AFTER INSERT ON emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_emergency_request();

-- Example table structure (adjust as needed)
/*
CREATE TABLE IF NOT EXISTS emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES verified_users(id),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    health_state JSONB NOT NULL,
    urgency_level VARCHAR(20) DEFAULT 'medium',
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for location queries
CREATE INDEX idx_emergency_requests_location ON emergency_requests USING GIST (location);
CREATE INDEX idx_emergency_requests_status ON emergency_requests (status);
CREATE INDEX idx_emergency_requests_created_at ON emergency_requests (created_at);
*/
