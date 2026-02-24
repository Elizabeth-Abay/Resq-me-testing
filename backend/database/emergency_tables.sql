-- Emergency Response System Tables
-- Run this SQL to create the necessary tables for the emergency system

-- Emergency requests table (main table)
CREATE TABLE IF NOT EXISTS emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES verified_users(id),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    health_state JSONB NOT NULL,
    urgency_level VARCHAR(20) DEFAULT 'medium' CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled')),
    assigned_provider_id UUID REFERENCES service_provider_profile(service_provider_id),
    provider_location GEOGRAPHY(POINT, 4326),
    provider_notes TEXT,
    estimated_arrival_time TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Provider contact logs table
CREATE TABLE IF NOT EXISTS provider_contact_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES service_provider_profile(service_provider_id),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    contact_status VARCHAR(20) NOT NULL CHECK (contact_status IN ('success', 'failed', 'timeout')),
    contact_details JSONB,
    contacted_at TIMESTAMP DEFAULT NOW()
);

-- Emergency provider responses table (for accept/decline tracking)
CREATE TABLE IF NOT EXISTS emergency_provider_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    provider_id UUID NOT NULL REFERENCES service_provider_profile(service_provider_id),
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('accepted', 'declined', 'timeout')),
    response_details JSONB,
    responded_at TIMESTAMP DEFAULT NOW()
);

-- Emergency action logs table (for audit trail)
CREATE TABLE IF NOT EXISTS emergency_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id),
    provider_id UUID REFERENCES service_provider_profile(service_provider_id),
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB,
    action_timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emergency_requests_location ON emergency_requests USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests (status);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_user_id ON emergency_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_provider_id ON emergency_requests (assigned_provider_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_created_at ON emergency_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_urgency ON emergency_requests (urgency_level);

CREATE INDEX IF NOT EXISTS idx_provider_contact_logs_provider_id ON provider_contact_logs (provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_contact_logs_emergency_id ON provider_contact_logs (emergency_id);
CREATE INDEX IF NOT EXISTS idx_provider_contact_logs_contacted_at ON provider_contact_logs (contacted_at);

CREATE INDEX IF NOT EXISTS idx_emergency_provider_responses_emergency_id ON emergency_provider_responses (emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_provider_responses_provider_id ON emergency_provider_responses (provider_id);

CREATE INDEX IF NOT EXISTS idx_emergency_action_logs_emergency_id ON emergency_action_logs (emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_action_logs_provider_id ON emergency_action_logs (provider_id);
CREATE INDEX IF NOT EXISTS idx_emergency_action_logs_timestamp ON emergency_action_logs (action_timestamp);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_emergency_requests_updated_at
    BEFORE UPDATE ON emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent multiple providers from accepting the same emergency
CREATE OR REPLACE FUNCTION prevent_duplicate_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if another provider has already accepted this emergency
    IF EXISTS (
        SELECT 1 FROM emergency_requests 
        WHERE id = NEW.id 
        AND status = 'accepted' 
        AND assigned_provider_id IS NOT NULL
        AND assigned_provider_id != NEW.assigned_provider_id
    ) THEN
        RAISE EXCEPTION 'Emergency request has already been accepted by another provider';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent duplicate acceptance
CREATE TRIGGER prevent_duplicate_emergency_acceptance
    BEFORE UPDATE ON emergency_requests
    FOR EACH ROW
    WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
    EXECUTE FUNCTION prevent_duplicate_acceptance();

-- View for active emergencies with provider information
CREATE OR REPLACE VIEW active_emergencies AS
SELECT 
    er.id,
    er.user_id,
    er.location,
    er.health_state,
    er.urgency_level,
    er.status,
    er.assigned_provider_id,
    vu.fullname as provider_name,
    vu.phone_number as provider_phone,
    er.created_at,
    er.accepted_at,
    er.estimated_arrival_time,
    ST_X(er.location::geometry) as longitude,
    ST_Y(er.location::geometry) as latitude
FROM emergency_requests er
LEFT JOIN service_provider_profile sp ON er.assigned_provider_id = sp.service_provider_id
LEFT JOIN verified_users vu ON sp.service_provider_id = vu.id
WHERE er.status IN ('pending', 'accepted', 'en_route', 'arrived', 'in_progress');

-- Function to get nearby providers for an emergency
CREATE OR REPLACE FUNCTION get_nearby_providers(
    emergency_lat FLOAT,
    emergency_lng FLOAT,
    radius_km INTEGER DEFAULT 10
)
RETURNS TABLE (
    provider_id UUID,
    provider_name VARCHAR,
    phone_number VARCHAR,
    distance_km FLOAT,
    location GEOGRAPHY
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.service_provider_id,
        vu.fullname,
        vu.phone_number,
        ST_Distance(
            sp.location, 
            ST_SetSRID(ST_MakePoint(emergency_lng, emergency_lat), 4326)::geography
        ) / 1000 as distance_km,
        sp.location
    FROM service_provider_profile sp
    JOIN verified_users vu ON sp.service_provider_id = vu.id
    WHERE ST_DWithin(
        sp.location, 
        ST_SetSRID(ST_MakePoint(emergency_lng, emergency_lat), 4326)::geography, 
        radius_km * 1000
    )
    AND sp.license_expiration_date > NOW()
    ORDER BY distance_km ASC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;
