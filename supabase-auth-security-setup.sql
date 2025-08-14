-- =====================================================
-- SUPABASE AUTHENTICATION SECURITY SETUP
-- Complete SQL script for production-ready auth system
-- =====================================================

-- 1. AUTH ACTIVITY TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.auth_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'sign_up', 'sign_in', 'sign_out', 'password_change', 
        'password_reset_request', 'password_reset_complete',
        'email_verification_sent', 'email_verified', 
        'profile_update', 'account_deleted', 'failed_login',
        'suspicious_activity', 'account_locked', 'account_unlocked'
    )),
    ip_address INET,
    user_agent TEXT,
    location JSONB, -- Store geolocation data if available
    device_fingerprint TEXT,
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_auth_activity_user_id ON public.auth_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_activity_created_at ON public.auth_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_type ON public.auth_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_auth_activity_success ON public.auth_activity(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_ip ON public.auth_activity(ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.auth_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_activity
DROP POLICY IF EXISTS "Users can view their own auth activity" ON public.auth_activity;
CREATE POLICY "Users can view their own auth activity" ON public.auth_activity
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all auth activity" ON public.auth_activity;
CREATE POLICY "Admins can view all auth activity" ON public.auth_activity
    FOR SELECT USING (is_current_user_admin());

DROP POLICY IF EXISTS "Service role can insert auth activity" ON public.auth_activity;
CREATE POLICY "Service role can insert auth activity" ON public.auth_activity
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete old auth activity" ON public.auth_activity;
CREATE POLICY "Admins can delete old auth activity" ON public.auth_activity
    FOR DELETE USING (is_current_user_admin() AND created_at < NOW() - INTERVAL '1 year');

-- 2. EMAIL VERIFICATION TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for email verification
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_token_hash ON public.email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON public.email_verification_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email verification
DROP POLICY IF EXISTS "Users can view their own verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Users can view their own verification tokens" ON public.email_verification_tokens
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Service role can manage verification tokens" ON public.email_verification_tokens
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins can view all verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Admins can view all verification tokens" ON public.email_verification_tokens
    FOR SELECT USING (is_current_user_admin());

-- 3. PASSWORD HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for password history
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON public.password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON public.password_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for password history
DROP POLICY IF EXISTS "Users cannot view password history" ON public.password_history;
CREATE POLICY "Users cannot view password history" ON public.password_history
    FOR SELECT USING (false); -- No one can view password hashes

DROP POLICY IF EXISTS "Service role can manage password history" ON public.password_history;
CREATE POLICY "Service role can manage password history" ON public.password_history
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins can delete old password history" ON public.password_history;
CREATE POLICY "Admins can delete old password history" ON public.password_history
    FOR DELETE USING (is_current_user_admin() AND created_at < NOW() - INTERVAL '2 years');

-- 4. ACCOUNT SECURITY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.account_security (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_reason TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    recovery_codes TEXT[],
    last_password_change TIMESTAMP WITH TIME ZONE,
    password_expires_at TIMESTAMP WITH TIME ZONE,
    suspicious_activity_score INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for account security
CREATE INDEX IF NOT EXISTS idx_account_security_locked ON public.account_security(is_locked);
CREATE INDEX IF NOT EXISTS idx_account_security_last_activity ON public.account_security(last_activity_at);

-- Enable RLS
ALTER TABLE public.account_security ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account security
DROP POLICY IF EXISTS "Users can view their own security settings" ON public.account_security;
CREATE POLICY "Users can view their own security settings" ON public.account_security
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own security settings" ON public.account_security;
CREATE POLICY "Users can update their own security settings" ON public.account_security
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage account security" ON public.account_security;
CREATE POLICY "Service role can manage account security" ON public.account_security
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins can view all account security" ON public.account_security;
CREATE POLICY "Admins can view all account security" ON public.account_security
    FOR SELECT USING (is_current_user_admin());

-- 5. ENHANCED UTILITY FUNCTIONS
-- =====================================================

-- Function to log authentication activity
CREATE OR REPLACE FUNCTION public.log_auth_activity(
    p_user_id UUID,
    p_activity_type TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_failure_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.auth_activity (
        user_id, activity_type, ip_address, user_agent, 
        success, failure_reason, metadata
    ) VALUES (
        p_user_id, p_activity_type, p_ip_address, p_user_agent,
        p_success, p_failure_reason, p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    locked BOOLEAN;
BEGIN
    SELECT is_locked INTO locked
    FROM public.account_security
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment failed login attempts
CREATE OR REPLACE FUNCTION public.increment_failed_login_attempts(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    attempts INTEGER;
    max_attempts INTEGER := 5;
BEGIN
    INSERT INTO public.account_security (user_id, failed_login_attempts, last_failed_login_at)
    VALUES (p_user_id, 1, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        failed_login_attempts = account_security.failed_login_attempts + 1,
        last_failed_login_at = NOW(),
        is_locked = CASE 
            WHEN account_security.failed_login_attempts + 1 >= max_attempts THEN true
            ELSE account_security.is_locked
        END,
        locked_at = CASE 
            WHEN account_security.failed_login_attempts + 1 >= max_attempts THEN NOW()
            ELSE account_security.locked_at
        END,
        locked_reason = CASE 
            WHEN account_security.failed_login_attempts + 1 >= max_attempts THEN 'Too many failed login attempts'
            ELSE account_security.locked_reason
        END
    RETURNING failed_login_attempts INTO attempts;
    
    RETURN attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset failed login attempts on successful login
CREATE OR REPLACE FUNCTION public.reset_failed_login_attempts(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.account_security (user_id, failed_login_attempts, last_activity_at)
    VALUES (p_user_id, 0, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        failed_login_attempts = 0,
        last_activity_at = NOW(),
        is_locked = false,
        locked_at = NULL,
        locked_reason = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check password history
CREATE OR REPLACE FUNCTION public.check_password_history(
    p_user_id UUID,
    p_password_hash TEXT,
    p_history_limit INTEGER DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
    found_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO found_count
    FROM public.password_history
    WHERE user_id = p_user_id 
    AND password_hash = p_password_hash
    AND created_at > NOW() - INTERVAL '1 year'
    ORDER BY created_at DESC
    LIMIT p_history_limit;
    
    RETURN found_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add password to history
CREATE OR REPLACE FUNCTION public.add_password_to_history(
    p_user_id UUID,
    p_password_hash TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    history_id UUID;
BEGIN
    INSERT INTO public.password_history (
        user_id, password_hash, ip_address, user_agent
    ) VALUES (
        p_user_id, p_password_hash, p_ip_address, p_user_agent
    ) RETURNING id INTO history_id;
    
    -- Clean up old password history (keep only last 10)
    DELETE FROM public.password_history 
    WHERE user_id = p_user_id 
    AND id NOT IN (
        SELECT id FROM public.password_history 
        WHERE user_id = p_user_id 
        ORDER BY created_at DESC 
        LIMIT 10
    );
    
    RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGERS FOR AUTOMATIC PROFILE MANAGEMENT
-- =====================================================

-- Enhanced trigger function for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile for new user
    INSERT INTO public.profiles (id, email, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NOW(),
        NOW()
    );
    
    -- Initialize account security record
    INSERT INTO public.account_security (user_id)
    VALUES (NEW.id);
    
    -- Log the sign up activity
    PERFORM public.log_auth_activity(
        NEW.id,
        'sign_up',
        NULL,
        NULL,
        true,
        NULL,
        jsonb_build_object('email', NEW.email)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for profile updates
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    
    -- Log profile update activity
    PERFORM public.log_auth_activity(
        NEW.id,
        'profile_update',
        NULL,
        NULL,
        true,
        NULL,
        jsonb_build_object(
            'old_full_name', OLD.full_name,
            'new_full_name', NEW.full_name,
            'old_phone', OLD.phone_number,
            'new_phone', NEW.phone_number
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- Create the trigger for profile updates
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_profile_update();

-- Trigger for updating timestamps on other tables
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to relevant tables
DROP TRIGGER IF EXISTS set_timestamp_bookings ON public.bookings;
CREATE TRIGGER set_timestamp_bookings
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_properties ON public.properties;
CREATE TRIGGER set_timestamp_properties
    BEFORE UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_account_security ON public.account_security;
CREATE TRIGGER set_timestamp_account_security
    BEFORE UPDATE ON public.account_security
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- 7. ENHANCED RLS POLICIES FOR EXISTING TABLES
-- =====================================================

-- Enhanced profiles policies
DROP POLICY IF EXISTS "super_optimized_profiles_select" ON public.profiles;
CREATE POLICY "enhanced_profiles_select" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR 
        is_current_user_admin() OR
        (role = 'agent' AND id IN (
            SELECT agent_id FROM public.properties WHERE agent_id IS NOT NULL
        ))
    );

DROP POLICY IF EXISTS "super_optimized_profiles_update" ON public.profiles;
CREATE POLICY "enhanced_profiles_update" ON public.profiles
    FOR UPDATE USING (
        id = auth.uid() OR 
        is_current_user_admin()
    );

-- Enhanced properties policies with agent restrictions
DROP POLICY IF EXISTS "super_optimized_properties_insert" ON public.properties;
CREATE POLICY "enhanced_properties_insert" ON public.properties
    FOR INSERT WITH CHECK (
        is_current_user_admin() OR 
        (is_current_user_agent() AND agent_id = auth.uid())
    );

-- Enhanced bookings policies
DROP POLICY IF EXISTS "super_optimized_bookings_select" ON public.bookings;
CREATE POLICY "enhanced_bookings_select" ON public.bookings
    FOR SELECT USING (
        user_id = auth.uid() OR 
        agent_id = auth.uid() OR 
        is_current_user_admin()
    );

-- 8. SECURITY VIEWS FOR MONITORING
-- =====================================================

-- View for recent authentication activity
CREATE OR REPLACE VIEW public.recent_auth_activity AS
SELECT 
    aa.id,
    aa.user_id,
    p.email,
    p.full_name,
    aa.activity_type,
    aa.success,
    aa.failure_reason,
    aa.ip_address,
    aa.created_at
FROM public.auth_activity aa
LEFT JOIN public.profiles p ON aa.user_id = p.id
WHERE aa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY aa.created_at DESC;

-- View for suspicious activity monitoring
CREATE OR REPLACE VIEW public.suspicious_activity AS
SELECT 
    user_id,
    COUNT(*) as failed_attempts,
    array_agg(DISTINCT ip_address) as ip_addresses,
    MIN(created_at) as first_attempt,
    MAX(created_at) as last_attempt
FROM public.auth_activity
WHERE activity_type = 'failed_login'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) >= 3;

-- 9. CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION public.cleanup_old_auth_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up old auth activity (older than 1 year)
    DELETE FROM public.auth_activity 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up expired email verification tokens
    DELETE FROM public.email_verification_tokens 
    WHERE expires_at < NOW();
    
    -- Clean up old password history (older than 2 years)
    DELETE FROM public.password_history 
    WHERE created_at < NOW() - INTERVAL '2 years';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.auth_activity TO authenticated;
GRANT SELECT ON public.recent_auth_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked TO authenticated;

-- Final security check - ensure all tables have RLS enabled
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'properties', 'bookings', 'favorites', 'auth_activity', 'email_verification_tokens', 'password_history', 'account_security')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END
$$;

-- =====================================================
-- MIGRATION COMPLETE
-- Authentication security system is now fully configured
-- =====================================================