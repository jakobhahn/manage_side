-- Create revenue analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS revenue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  average_transaction DECIMAL(10,2) DEFAULT 0,
  payment_methods JSONB DEFAULT '{}',
  hourly_breakdown JSONB DEFAULT '{}',
  peak_hours JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, date)
);

-- Enable RLS on revenue_analytics
ALTER TABLE revenue_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy for revenue_analytics
CREATE POLICY "Users can view organization revenue" ON revenue_analytics
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_org_date ON revenue_analytics(organization_id, date);

-- Function to update revenue analytics for an organization
CREATE OR REPLACE FUNCTION update_revenue_analytics(org_id UUID)
RETURNS void AS $$
DECLARE
  transaction_record RECORD;
  current_date DATE;
  daily_revenue DECIMAL(10,2) := 0;
  daily_count INTEGER := 0;
  payment_methods_json JSONB := '{}';
  hourly_breakdown_json JSONB := '{}';
  peak_hours_json JSONB := '{}';
  hour_key TEXT;
  hour_revenue DECIMAL(10,2);
  max_revenue DECIMAL(10,2) := 0;
  peak_hour TEXT;
BEGIN
  -- Get all transactions for the organization from the last 7 days
  FOR transaction_record IN 
    SELECT 
      DATE(transaction_date) as trans_date,
      amount,
      payment_method,
      EXTRACT(HOUR FROM transaction_date) as hour
    FROM payment_transactions 
    WHERE organization_id = org_id 
      AND status = 'completed'
      AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
  LOOP
    current_date := transaction_record.trans_date;
    
    -- Aggregate daily data
    daily_revenue := daily_revenue + transaction_record.amount;
    daily_count := daily_count + 1;
    
    -- Aggregate payment methods
    payment_methods_json := jsonb_set(
      payment_methods_json,
      ARRAY[transaction_record.payment_method],
      COALESCE(
        (payment_methods_json ->> transaction_record.payment_method)::DECIMAL + transaction_record.amount,
        transaction_record.amount
      )::TEXT
    );
    
    -- Aggregate hourly data
    hour_key := transaction_record.hour::TEXT;
    hour_revenue := COALESCE(
      (hourly_breakdown_json ->> hour_key)::DECIMAL + transaction_record.amount,
      transaction_record.amount
    );
    hourly_breakdown_json := jsonb_set(
      hourly_breakdown_json,
      ARRAY[hour_key],
      hour_revenue::TEXT
    );
    
    -- Find peak hour
    IF hour_revenue > max_revenue THEN
      max_revenue := hour_revenue;
      peak_hour := hour_key;
    END IF;
  END LOOP;
  
  -- Update or insert revenue analytics for each day
  FOR current_date IN 
    SELECT DISTINCT DATE(transaction_date) 
    FROM payment_transactions 
    WHERE organization_id = org_id 
      AND status = 'completed'
      AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
  LOOP
    -- Calculate daily totals
    SELECT 
      COALESCE(SUM(amount), 0),
      COUNT(*),
      COALESCE(AVG(amount), 0)
    INTO daily_revenue, daily_count, average_transaction
    FROM payment_transactions 
    WHERE organization_id = org_id 
      AND DATE(transaction_date) = current_date
      AND status = 'completed';
    
    -- Calculate payment methods for this day
    SELECT jsonb_object_agg(payment_method, total_amount)
    INTO payment_methods_json
    FROM (
      SELECT 
        payment_method,
        SUM(amount) as total_amount
      FROM payment_transactions 
      WHERE organization_id = org_id 
        AND DATE(transaction_date) = current_date
        AND status = 'completed'
      GROUP BY payment_method
    ) payment_summary;
    
    -- Calculate hourly breakdown for this day
    SELECT jsonb_object_agg(hour_key, hour_revenue)
    INTO hourly_breakdown_json
    FROM (
      SELECT 
        EXTRACT(HOUR FROM transaction_date)::TEXT as hour_key,
        SUM(amount) as hour_revenue
      FROM payment_transactions 
      WHERE organization_id = org_id 
        AND DATE(transaction_date) = current_date
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM transaction_date)
      ORDER BY hour_revenue DESC
    ) hourly_summary;
    
    -- Find peak hours (top 3)
    SELECT jsonb_object_agg(hour_key, hour_revenue)
    INTO peak_hours_json
    FROM (
      SELECT 
        EXTRACT(HOUR FROM transaction_date)::TEXT as hour_key,
        SUM(amount) as hour_revenue
      FROM payment_transactions 
      WHERE organization_id = org_id 
        AND DATE(transaction_date) = current_date
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM transaction_date)
      ORDER BY hour_revenue DESC
      LIMIT 3
    ) peak_summary;
    
    -- Upsert the revenue analytics record
    INSERT INTO revenue_analytics (
      organization_id,
      date,
      total_revenue,
      transaction_count,
      average_transaction,
      payment_methods,
      hourly_breakdown,
      peak_hours
    ) VALUES (
      org_id,
      current_date,
      daily_revenue,
      daily_count,
      average_transaction,
      COALESCE(payment_methods_json, '{}'),
      COALESCE(hourly_breakdown_json, '{}'),
      COALESCE(peak_hours_json, '{}')
    )
    ON CONFLICT (organization_id, date)
    DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      transaction_count = EXCLUDED.transaction_count,
      average_transaction = EXCLUDED.average_transaction,
      payment_methods = EXCLUDED.payment_methods,
      hourly_breakdown = EXCLUDED.hourly_breakdown,
      peak_hours = EXCLUDED.peak_hours,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_revenue_analytics TO authenticated;

-- Create a trigger to automatically update revenue analytics when transactions are inserted/updated
CREATE OR REPLACE FUNCTION trigger_update_revenue_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update revenue analytics for the organization
  PERFORM update_revenue_analytics(COALESCE(NEW.organization_id, OLD.organization_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment_transactions
DROP TRIGGER IF EXISTS update_revenue_analytics_trigger ON payment_transactions;
CREATE TRIGGER update_revenue_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_revenue_analytics();
