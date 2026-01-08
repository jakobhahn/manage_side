-- Create weather history table for storing historical weather data with location context
CREATE TABLE public.weather_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Location information
  location_address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- Weather data (actual recorded data, not forecast)
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When this weather actually occurred
  date DATE NOT NULL, -- Date component for easy querying
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  
  -- Weather measurements
  temperature DECIMAL(5, 2) NOT NULL, -- Celsius
  precipitation DECIMAL(6, 2) NOT NULL DEFAULT 0, -- mm
  weather_code INTEGER NOT NULL,
  wind_speed DECIMAL(5, 2) NOT NULL DEFAULT 0, -- km/h
  humidity INTEGER NOT NULL CHECK (humidity >= 0 AND humidity <= 100), -- %
  pressure DECIMAL(7, 2) NOT NULL DEFAULT 0, -- hPa
  
  -- Metadata
  data_source VARCHAR(50) NOT NULL DEFAULT 'open-meteo',
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no duplicate entries for same location/time
  UNIQUE(organization_id, latitude, longitude, recorded_at)
);

-- Create indexes for efficient querying
CREATE INDEX idx_weather_history_org_date ON weather_history(organization_id, date);
CREATE INDEX idx_weather_history_location ON weather_history(latitude, longitude);
CREATE INDEX idx_weather_history_recorded_at ON weather_history(recorded_at);
CREATE INDEX idx_weather_history_org_location_date ON weather_history(organization_id, latitude, longitude, date);

-- Enable Row Level Security
ALTER TABLE public.weather_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see weather history for their organization
CREATE POLICY "Users can view weather history for their organization" ON public.weather_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Only system can insert weather history (via service role)
CREATE POLICY "System can insert weather history" ON public.weather_history
  FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.weather_history IS 'Historical weather data with location context for each organization';
COMMENT ON COLUMN public.weather_history.recorded_at IS 'The actual timestamp when this weather occurred (not when it was fetched)';
COMMENT ON COLUMN public.weather_history.location_address IS 'Human-readable address used for geocoding';
COMMENT ON COLUMN public.weather_history.data_source IS 'Source of weather data (e.g., open-meteo, weatherapi)';
COMMENT ON COLUMN public.weather_history.sync_timestamp IS 'When this data was fetched and stored in our database';








