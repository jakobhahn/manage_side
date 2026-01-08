-- Create forecasts table for storing revenue forecasts and actuals
CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Date information
  forecast_date DATE NOT NULL,
  
  -- Forecast data (created when forecast is generated)
  forecasted_revenue DECIMAL(10, 2) NOT NULL,
  confidence DECIMAL(5, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  trend VARCHAR(10) NOT NULL CHECK (trend IN ('up', 'down', 'stable')),
  
  -- Factors used in forecast calculation
  historical_average DECIMAL(10, 2) NOT NULL,
  weekly_trend DECIMAL(5, 2) NOT NULL,
  monthly_trend DECIMAL(5, 2) NOT NULL,
  seasonal_factor DECIMAL(5, 2) NOT NULL,
  weather_factor DECIMAL(5, 2) NOT NULL,
  
  -- Weather data used in forecast (stored as JSONB for flexibility)
  forecast_weather JSONB,
  
  -- Actual data (updated when day has passed)
  actual_revenue DECIMAL(10, 2),
  actual_weather JSONB,
  
  -- Accuracy metrics (calculated when actual is available)
  accuracy_percentage DECIMAL(5, 2),
  accuracy_difference DECIMAL(10, 2),
  accuracy_rating VARCHAR(20) CHECK (accuracy_rating IN ('excellent', 'good', 'fair', 'poor')),
  
  -- Metadata
  forecast_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actual_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one forecast per organization per date
  UNIQUE(organization_id, forecast_date)
);

-- Create indexes for efficient querying
CREATE INDEX idx_forecasts_org_date ON public.forecasts(organization_id, forecast_date);
CREATE INDEX idx_forecasts_date ON public.forecasts(forecast_date);
CREATE INDEX idx_forecasts_accuracy ON public.forecasts(organization_id, accuracy_rating) WHERE accuracy_rating IS NOT NULL;
CREATE INDEX idx_forecasts_created_at ON public.forecasts(forecast_created_at);

-- Enable Row Level Security
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forecasts
CREATE POLICY "Organizations can view their forecasts" ON public.forecasts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "System can insert forecasts" ON public.forecasts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update forecasts" ON public.forecasts
  FOR UPDATE USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.forecasts IS 'Revenue forecasts with actuals for tracking forecast accuracy';
COMMENT ON COLUMN public.forecasts.forecast_date IS 'The date this forecast is for';
COMMENT ON COLUMN public.forecasts.forecast_weather IS 'Weather data used when creating the forecast (from forecast API)';
COMMENT ON COLUMN public.forecasts.actual_weather IS 'Actual weather data for the day (from weather_history)';
COMMENT ON COLUMN public.forecasts.accuracy_percentage IS 'Percentage accuracy: (1 - |forecast - actual| / actual) * 100';



