-- Create weather_data table for storing hourly weather information
CREATE TABLE IF NOT EXISTS weather_data (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    temperature DECIMAL(4,1) NOT NULL,
    precipitation DECIMAL(5,1) NOT NULL DEFAULT 0,
    weather_code INTEGER NOT NULL,
    wind_speed DECIMAL(4,1) NOT NULL DEFAULT 0,
    humidity INTEGER NOT NULL DEFAULT 0,
    pressure DECIMAL(6,1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of date and hour
    UNIQUE(date, hour)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_weather_data_date ON weather_data(date);
CREATE INDEX IF NOT EXISTS idx_weather_data_date_hour ON weather_data(date, hour);
CREATE INDEX IF NOT EXISTS idx_weather_data_updated_at ON weather_data(updated_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_weather_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_weather_data_updated_at
    BEFORE UPDATE ON weather_data
    FOR EACH ROW
    EXECUTE FUNCTION update_weather_data_updated_at();

-- Add RLS (Row Level Security) - allow all operations for now
ALTER TABLE weather_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (can be restricted later if needed)
CREATE POLICY "Allow all operations on weather_data" ON weather_data
    FOR ALL USING (true);

-- Add comment to table
COMMENT ON TABLE weather_data IS 'Hourly weather data from Open-Meteo API for Hamburg, Seilerstraße 40';
COMMENT ON COLUMN weather_data.date IS 'Date of the weather data';
COMMENT ON COLUMN weather_data.hour IS 'Hour of the day (0-23)';
COMMENT ON COLUMN weather_data.temperature IS 'Temperature in Celsius';
COMMENT ON COLUMN weather_data.precipitation IS 'Precipitation in mm';
COMMENT ON COLUMN weather_data.weather_code IS 'WMO Weather interpretation code';
COMMENT ON COLUMN weather_data.wind_speed IS 'Wind speed in km/h';
COMMENT ON COLUMN weather_data.humidity IS 'Relative humidity in %';
COMMENT ON COLUMN weather_data.pressure IS 'Surface pressure in hPa';
