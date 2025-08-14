-- =====================================================
-- ENHANCED SUPABASE SECURITY POLICIES AND AUDIT LOGGING
-- Advanced RLS policies and comprehensive audit system
-- =====================================================

-- 1. SECURITY MONITORING TABLES
-- =====================================================

-- Enhanced security event tracking
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'multiple_failed_logins', 'suspicious_location', 'device_fingerprint_mismatch',
        'concurrent_session_limit_exceeded', 'rapid_password_changes', 
        'unusual_oauth_activity', 'token_abuse', 'account_enumeration',
        'brute_force_attempt', 'credential_stuffing', 'session_hijacking',
        'privilege_escalation', 'data_access_violation', 'api_abuse'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    geolocation JSONB,
    response_actions TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User security settings
CREATE TABLE IF NOT EXISTS public.user_security_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_required BOOLEAN DEFAULT false,
    mfa_required_reason TEXT,
    mfa_required_at TIMESTAMP WITH TIME ZONE,
    trusted_devices JSONB DEFAULT '[]',
    allowed_ip_ranges INET[] DEFAULT '{}',
    session_timeout_minutes INTEGER DEFAULT 1440, -- 24 hours
    max_concurrent_sessions INTEGER DEFAULT 3,
    password_expiry_days INTEGER DEFAULT 90,
    security_notifications JSONB DEFAULT '{"email": true, "sms": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session tracking table
CREATE TABLE IF NOT EXISTS public.active_sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT
);

-- IP address reputation tracking
CREATE TABLE IF NOT EXISTS public.ip_reputation (
    ip_address INET PRIMARY KEY,
    reputation_score INTEGER DEFAULT 0, -- -100 to +100
    failed_attempts INTEGER DEFAULT 0,
    successful_logins INTEGER DEFAULT 0,
    last_failure TIMESTAMP WITH TIME ZONE,
    last_success TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMP WITH TIME ZONE,
    blocked_reason TEXT,
    country_code TEXT,
    is_vpn BOOLEAN DEFAULT false,
    is_tor BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events(event_type, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON public.security_events(resolved, severity) WHERE NOT resolved;

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON public.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_device ON public.active_sessions(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_ip_reputation_score ON public.ip_reputation(reputation_score);
CREATE INDEX IF NOT EXISTS idx_ip_reputation_blocked ON public.ip_reputation(is_blocked) WHERE is_blocked;

-- 2. ENHANCED RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;

-- Security events policies
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_events;
CREATE POLICY "Users can view their own security events" ON public.security_events
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all security events" ON public.security_events;
CREATE POLICY "Admins can view all security events" ON public.security_events
    FOR SELECT USING (is_current_user_admin());

DROP POLICY IF EXISTS "Service role can manage security events" ON public.security_events;
CREATE POLICY "Service role can manage security events" ON public.security_events
    FOR ALL USING (auth.role() = 'service_role');

-- User security settings policies
DROP POLICY IF EXISTS "Users can view their own security settings" ON public.user_security_settings;
CREATE POLICY "Users can view their own security settings" ON public.user_security_settings
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own security settings" ON public.user_security_settings;
CREATE POLICY "Users can update their own security settings" ON public.user_security_settings
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own security settings" ON public.user_security_settings;
CREATE POLICY "Users can insert their own security settings" ON public.user_security_settings
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Active sessions policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.active_sessions;
CREATE POLICY "Users can view their own sessions" ON public.active_sessions
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke their own sessions" ON public.active_sessions;
CREATE POLICY "Users can revoke their own sessions" ON public.active_sessions
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage sessions" ON public.active_sessions;
CREATE POLICY "Service role can manage sessions" ON public.active_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- IP reputation policies (read-only for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view IP reputation" ON public.ip_reputation;
CREATE POLICY "Authenticated users can view IP reputation" ON public.ip_reputation
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage IP reputation" ON public.ip_reputation;
CREATE POLICY "Service role can manage IP reputation" ON public.ip_reputation
    FOR ALL USING (auth.role() = 'service_role');

-- 3. ADVANCED SECURITY FUNCTIONS
-- =====================================================

-- Function to record security events
CREATE OR REPLACE FUNCTION public.record_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'low',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
    ip_score INTEGER;
BEGIN
    -- Insert security event
    INSERT INTO public.security_events (
        user_id, event_type, severity, ip_address, 
        user_agent, device_fingerprint, metadata
    ) VALUES (
        p_user_id, p_event_type, p_severity, p_ip_address,
        p_user_agent, p_device_fingerprint, p_metadata
    ) RETURNING id INTO event_id;

    -- Update IP reputation if IP provided
    IF p_ip_address IS NOT NULL THEN
        INSERT INTO public.ip_reputation (ip_address, failed_attempts, last_failure)
        VALUES (p_ip_address, 1, NOW())
        ON CONFLICT (ip_address) DO UPDATE SET
            failed_attempts = ip_reputation.failed_attempts + 1,
            last_failure = NOW(),
            reputation_score = GREATEST(ip_reputation.reputation_score - 5, -100),
            updated_at = NOW();
    END IF;

    -- Auto-block IP if too many failures
    SELECT reputation_score INTO ip_score
    FROM public.ip_reputation 
    WHERE ip_address = p_ip_address;

    IF ip_score <= -50 AND p_ip_address IS NOT NULL THEN
        UPDATE public.ip_reputation 
        SET is_blocked = true, 
            blocked_at = NOW(),
            blocked_reason = 'Automatic block due to suspicious activity'
        WHERE ip_address = p_ip_address AND NOT is_blocked;
    END IF;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track active sessions
CREATE OR REPLACE FUNCTION public.track_session(
    p_session_id TEXT,
    p_user_id UUID,
    p_device_fingerprint TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.active_sessions (
        session_id, user_id, device_fingerprint, 
        ip_address, user_agent, expires_at
    ) VALUES (
        p_session_id, p_user_id, p_device_fingerprint,
        p_ip_address, p_user_agent, 
        COALESCE(p_expires_at, NOW() + INTERVAL '24 hours')
    )
    ON CONFLICT (session_id) DO UPDATE SET
        last_activity = NOW(),
        ip_address = COALESCE(p_ip_address, active_sessions.ip_address),
        user_agent = COALESCE(p_user_agent, active_sessions.user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke user sessions
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(
    p_user_id UUID,
    p_except_session_id TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'User requested'
) RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE public.active_sessions 
    SET is_revoked = true,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE user_id = p_user_id 
    AND NOT is_revoked
    AND (p_except_session_id IS NULL OR session_id != p_except_session_id);
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check session validity
CREATE OR REPLACE FUNCTION public.is_session_valid(
    p_session_id TEXT,
    p_device_fingerprint TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    session_valid BOOLEAN := false;
BEGIN
    SELECT 
        NOT is_revoked 
        AND expires_at > NOW() 
        AND (p_device_fingerprint IS NULL OR device_fingerprint = p_device_fingerprint)
    INTO session_valid
    FROM public.active_sessions
    WHERE session_id = p_session_id;
    
    -- Update last activity if valid
    IF session_valid THEN
        UPDATE public.active_sessions 
        SET last_activity = NOW()
        WHERE session_id = p_session_id;
    END IF;
    
    RETURN COALESCE(session_valid, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze user risk score
CREATE OR REPLACE FUNCTION public.calculate_user_risk_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    failed_logins INTEGER;
    security_events INTEGER;
    days_since_last_password_change INTEGER;
    concurrent_sessions INTEGER;
BEGIN
    -- Factor 1: Recent failed login attempts
    SELECT COUNT(*) INTO failed_logins
    FROM public.auth_activity
    WHERE user_id = p_user_id
    AND activity_type = 'failed_login'
    AND created_at > NOW() - INTERVAL '7 days';
    
    risk_score := risk_score + (failed_logins * 10);

    -- Factor 2: Recent security events
    SELECT COUNT(*) INTO security_events
    FROM public.security_events
    WHERE user_id = p_user_id
    AND severity IN ('high', 'critical')
    AND created_at > NOW() - INTERVAL '30 days';
    
    risk_score := risk_score + (security_events * 25);

    -- Factor 3: Password age
    SELECT EXTRACT(days FROM NOW() - last_password_change) INTO days_since_last_password_change
    FROM public.account_security
    WHERE user_id = p_user_id;
    
    IF days_since_last_password_change > 90 THEN
        risk_score := risk_score + 15;
    ELSIF days_since_last_password_change > 180 THEN
        risk_score := risk_score + 30;
    END IF;

    -- Factor 4: Concurrent sessions
    SELECT COUNT(*) INTO concurrent_sessions
    FROM public.active_sessions
    WHERE user_id = p_user_id
    AND NOT is_revoked
    AND expires_at > NOW();
    
    IF concurrent_sessions > 3 THEN
        risk_score := risk_score + (concurrent_sessions * 5);
    END IF;

    RETURN LEAST(risk_score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. AUDIT LOGGING TRIGGERS
-- =====================================================

-- Comprehensive audit logging function
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    audit_data JSONB;
    table_name TEXT;
    operation TEXT;
BEGIN
    table_name := TG_TABLE_NAME;
    operation := TG_OP;
    
    -- Build audit data
    IF operation = 'DELETE' THEN
        audit_data := jsonb_build_object(
            'table', table_name,
            'operation', operation,
            'old_data', row_to_json(OLD),
            'user_id', auth.uid(),
            'timestamp', NOW()
        );
    ELSIF operation = 'INSERT' THEN
        audit_data := jsonb_build_object(
            'table', table_name,
            'operation', operation,
            'new_data', row_to_json(NEW),
            'user_id', auth.uid(),
            'timestamp', NOW()
        );
    ELSIF operation = 'UPDATE' THEN
        audit_data := jsonb_build_object(
            'table', table_name,
            'operation', operation,
            'old_data', row_to_json(OLD),
            'new_data', row_to_json(NEW),
            'changed_fields', (
                SELECT jsonb_object_agg(key, value) 
                FROM jsonb_each(row_to_json(NEW)::jsonb) 
                WHERE value != (row_to_json(OLD)::jsonb ->> key)::jsonb
            ),
            'user_id', auth.uid(),
            'timestamp', NOW()
        );
    END IF;
    
    -- Log to auth activity with audit metadata
    PERFORM public.log_auth_activity(
        COALESCE(auth.uid(), 'system'::UUID),
        'data_modification',
        NULL,
        NULL,
        true,
        NULL,
        audit_data
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_account_security_changes ON public.account_security;
CREATE TRIGGER audit_account_security_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.account_security
    FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_user_security_settings_changes ON public.user_security_settings;
CREATE TRIGGER audit_user_security_settings_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.user_security_settings
    FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- 5. SECURITY MONITORING VIEWS
-- =====================================================

-- Real-time security dashboard view
CREATE OR REPLACE VIEW public.security_dashboard AS
SELECT 
    'active_threats' as metric,
    COUNT(*) as value
FROM public.security_events 
WHERE NOT resolved 
AND severity IN ('high', 'critical')
AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'blocked_ips' as metric,
    COUNT(*) as value
FROM public.ip_reputation 
WHERE is_blocked
UNION ALL
SELECT 
    'suspicious_activities' as metric,
    COUNT(*) as value
FROM public.security_events 
WHERE severity = 'medium'
AND created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'active_sessions' as metric,
    COUNT(*) as value
FROM public.active_sessions 
WHERE NOT is_revoked 
AND expires_at > NOW();

-- High-risk users view
CREATE OR REPLACE VIEW public.high_risk_users AS
SELECT 
    p.id,
    p.email,
    p.full_name,
    public.calculate_user_risk_score(p.id) as risk_score,
    COUNT(se.id) as security_events,
    MAX(se.created_at) as last_security_event
FROM public.profiles p
LEFT JOIN public.security_events se ON p.id = se.user_id
WHERE public.calculate_user_risk_score(p.id) > 30
GROUP BY p.id, p.email, p.full_name
ORDER BY risk_score DESC;

-- Suspicious IP addresses view
CREATE OR REPLACE VIEW public.suspicious_ips AS
SELECT 
    ip_address,
    reputation_score,
    failed_attempts,
    successful_logins,
    is_blocked,
    country_code,
    is_vpn,
    is_tor,
    last_failure,
    blocked_reason
FROM public.ip_reputation 
WHERE reputation_score < -20 
OR failed_attempts > 10
OR is_blocked
ORDER BY reputation_score ASC, failed_attempts DESC;

-- 6. AUTOMATED CLEANUP JOBS
-- =====================================================

-- Enhanced cleanup function
CREATE OR REPLACE FUNCTION public.security_maintenance_cleanup()
RETURNS TABLE(
    task TEXT,
    records_affected INTEGER,
    execution_time INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    affected_count INTEGER;
BEGIN
    -- Task 1: Clean expired sessions
    start_time := NOW();
    DELETE FROM public.active_sessions 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'expired_sessions_cleanup'::TEXT, affected_count, NOW() - start_time;

    -- Task 2: Archive old security events
    start_time := NOW();
    DELETE FROM public.security_events 
    WHERE created_at < NOW() - INTERVAL '6 months'
    AND resolved = true;
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'old_security_events_cleanup'::TEXT, affected_count, NOW() - start_time;

    -- Task 3: Reset IP reputation for good actors
    start_time := NOW();
    UPDATE public.ip_reputation 
    SET reputation_score = LEAST(reputation_score + 10, 100),
        updated_at = NOW()
    WHERE last_success > NOW() - INTERVAL '30 days'
    AND successful_logins > failed_attempts * 2
    AND NOT is_blocked;
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'ip_reputation_improvement'::TEXT, affected_count, NOW() - start_time;

    -- Task 4: Auto-resolve old low-severity events
    start_time := NOW();
    UPDATE public.security_events 
    SET resolved = true,
        resolved_at = NOW(),
        resolved_by = 'system'::UUID
    WHERE severity = 'low'
    AND created_at < NOW() - INTERVAL '7 days'
    AND NOT resolved;
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'auto_resolve_low_events'::TEXT, affected_count, NOW() - start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. PERMISSIONS AND GRANTS
-- =====================================================

-- Grant permissions for security functions
GRANT EXECUTE ON FUNCTION public.record_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_valid TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions TO authenticated;

-- Grant view access
GRANT SELECT ON public.security_dashboard TO authenticated;
GRANT SELECT ON public.user_security_settings TO authenticated;
GRANT SELECT ON public.active_sessions TO authenticated;

-- Admin-only access to sensitive views
CREATE OR REPLACE FUNCTION public.grant_admin_security_access()
RETURNS VOID AS $$
BEGIN
    IF is_current_user_admin() THEN
        -- Grants would be handled by RLS policies
        RAISE NOTICE 'Admin access validated';
    ELSE
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENHANCED SECURITY SETUP COMPLETE
-- All advanced RLS policies and audit logging configured
-- =====================================================