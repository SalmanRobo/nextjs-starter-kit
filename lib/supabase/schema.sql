-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
CREATE TYPE user_type AS ENUM ('buyer', 'seller', 'agent', 'admin');
CREATE TYPE property_type AS ENUM ('apartment', 'villa', 'land', 'commercial');
CREATE TYPE property_status AS ENUM ('available', 'sold', 'rented', 'under_offer');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE inquiry_status AS ENUM ('new', 'responded', 'closed');
CREATE TYPE language AS ENUM ('en', 'ar');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  user_type user_type DEFAULT 'buyer',
  company TEXT,
  license_number TEXT,
  preferred_language language DEFAULT 'en',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties table
CREATE TABLE properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  property_type property_type NOT NULL,
  status property_status DEFAULT 'available',
  price DECIMAL(15,2) NOT NULL,
  area_sqm DECIMAL(10,2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  location JSONB NOT NULL, -- {lat, lng, address}
  city TEXT NOT NULL,
  district TEXT,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT FALSE,
  agent_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property bookings/viewings
CREATE TABLE bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status booking_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User favorites
CREATE TABLE favorites (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);

-- Property inquiries
CREATE TABLE inquiries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status inquiry_status DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_featured ON properties(featured);
CREATE INDEX idx_properties_agent ON properties(agent_id);
CREATE INDEX idx_bookings_property ON bookings(property_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_date ON bookings(scheduled_date);
CREATE INDEX idx_inquiries_property ON inquiries(property_id);
CREATE INDEX idx_inquiries_status ON inquiries(status);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inquiries_updated_at BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties policies
CREATE POLICY "Anyone can view available properties" ON properties
  FOR SELECT USING (
    status = 'available' OR 
    agent_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type IN ('admin')
    )
  );

CREATE POLICY "Agents can insert properties" ON properties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type IN ('agent', 'admin')
    )
  );

CREATE POLICY "Agents can update own properties" ON properties
  FOR UPDATE USING (
    agent_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete properties" ON properties
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Bookings policies
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.agent_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Users can create bookings" ON bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookings" ON bookings
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.agent_id = auth.uid()
    )
  );

-- Favorites policies
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (user_id = auth.uid());

-- Inquiries policies
CREATE POLICY "Users can view relevant inquiries" ON inquiries
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.agent_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Users can create inquiries" ON inquiries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can update property inquiries" ON inquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.agent_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Create a function to handle user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, preferred_language)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')::language);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();