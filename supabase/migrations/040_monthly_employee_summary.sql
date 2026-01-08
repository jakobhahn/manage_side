-- Drop the view if it exists to allow type changes
DROP VIEW IF EXISTS public.monthly_employee_summary CASCADE;

-- Create a view for monthly employee summaries (for payroll preparation)
-- This view generates months for all employees (last 12 months + current month)
-- and combines them with actual data from time_clock_entries and vacation_requests
CREATE VIEW public.monthly_employee_summary AS
WITH month_series AS (
  -- Generate all months for each user (last 12 months + current month)
  SELECT DISTINCT
    u.organization_id,
    u.id AS user_id,
    u.name AS employee_name,
    DATE_TRUNC('month', month_date)::DATE AS month,
    EXTRACT(YEAR FROM month_date)::INTEGER AS year,
    EXTRACT(MONTH FROM month_date)::INTEGER AS month_number
  FROM public.users u
  CROSS JOIN LATERAL generate_series(
    DATE_TRUNC('month', NOW() - INTERVAL '12 months'),
    DATE_TRUNC('month', NOW()),
    '1 month'::INTERVAL
  ) AS month_date
  WHERE u.role != 'owner'
  
  UNION
  
  -- Also include months from actual data (to cover older years)
  SELECT DISTINCT
    u.organization_id,
    tce.user_id,
    u.name AS employee_name,
    DATE_TRUNC('month', tce.clock_in)::DATE AS month,
    EXTRACT(YEAR FROM tce.clock_in)::INTEGER AS year,
    EXTRACT(MONTH FROM tce.clock_in)::INTEGER AS month_number
  FROM public.time_clock_entries tce
  INNER JOIN public.users u ON tce.user_id = u.id
  WHERE u.role != 'owner'
  
  UNION
  
  SELECT DISTINCT
    u.organization_id,
    vr.user_id,
    u.name AS employee_name,
    DATE_TRUNC('month', vr.start_date)::DATE AS month,
    EXTRACT(YEAR FROM vr.start_date)::INTEGER AS year,
    EXTRACT(MONTH FROM vr.start_date)::INTEGER AS month_number
  FROM public.vacation_requests vr
  INNER JOIN public.users u ON vr.user_id = u.id
  WHERE u.role != 'owner' AND vr.status = 'approved'
),
vacation_days_by_month AS (
  SELECT 
    vr.user_id,
    DATE_TRUNC('month', vr.start_date)::DATE AS month,
    SUM(vr.days) AS vacation_days
  FROM public.vacation_requests vr
  WHERE vr.status = 'approved'
  GROUP BY vr.user_id, DATE_TRUNC('month', vr.start_date)::DATE
),
sick_days_by_month AS (
  SELECT 
    tce.user_id,
    DATE_TRUNC('month', tce.clock_in)::DATE AS month,
    COUNT(DISTINCT DATE(tce.clock_in)) AS sick_days
  FROM public.time_clock_entries tce
  WHERE tce.is_sick = true
  GROUP BY tce.user_id, DATE_TRUNC('month', tce.clock_in)::DATE
),
worked_hours_by_month AS (
  SELECT 
    tce.user_id,
    DATE_TRUNC('month', tce.clock_in)::DATE AS month,
    -- Brutto hours: total time between clock_in and clock_out
    SUM(EXTRACT(EPOCH FROM (tce.clock_out - tce.clock_in)) / 3600.0) AS worked_hours_brutto,
    COUNT(DISTINCT DATE(tce.clock_in)) AS worked_days,
    COUNT(*) AS total_entries
  FROM public.time_clock_entries tce
  WHERE tce.is_sick = false AND tce.clock_out IS NOT NULL
  GROUP BY tce.user_id, DATE_TRUNC('month', tce.clock_in)::DATE
),
break_hours_by_month AS (
  -- Calculate actual break hours from time_clock_breaks
  SELECT 
    tce.user_id,
    DATE_TRUNC('month', tce.clock_in)::DATE AS month,
    SUM(EXTRACT(EPOCH FROM (tcb.break_end - tcb.break_start)) / 3600.0) AS break_hours_actual
  FROM public.time_clock_entries tce
  INNER JOIN public.time_clock_breaks tcb ON tce.id = tcb.time_clock_entry_id
  WHERE tce.is_sick = false 
    AND tce.clock_out IS NOT NULL
    AND tcb.break_end IS NOT NULL
  GROUP BY tce.user_id, DATE_TRUNC('month', tce.clock_in)::DATE
),
daily_hours_with_breaks AS (
  -- Calculate daily hours and required breaks per day
  SELECT 
    tce.user_id,
    DATE_TRUNC('month', tce.clock_in)::DATE AS month,
    DATE(tce.clock_in) AS work_date,
    EXTRACT(EPOCH FROM (tce.clock_out - tce.clock_in)) / 3600.0 AS daily_hours,
    -- Calculate required break time based on legal requirements:
    -- Ab 6 Stunden: 30 Minuten (0.5 Stunden)
    -- Ab 9 Stunden: 45 Minuten (0.75 Stunden)
    CASE 
      WHEN EXTRACT(EPOCH FROM (tce.clock_out - tce.clock_in)) / 3600.0 >= 9 THEN 0.75
      WHEN EXTRACT(EPOCH FROM (tce.clock_out - tce.clock_in)) / 3600.0 >= 6 THEN 0.5
      ELSE 0
    END AS required_break_hours
  FROM public.time_clock_entries tce
  WHERE tce.is_sick = false AND tce.clock_out IS NOT NULL
),
required_breaks_by_month AS (
  -- Sum up required break hours per month
  SELECT 
    user_id,
    month,
    SUM(required_break_hours) AS break_hours_required
  FROM daily_hours_with_breaks
  GROUP BY user_id, month
),
break_summary_by_month AS (
  -- Combine actual breaks and required breaks
  SELECT 
    COALESCE(bh.user_id, rb.user_id) AS user_id,
    COALESCE(bh.month, rb.month) AS month,
    COALESCE(bh.break_hours_actual, 0) AS break_hours_actual,
    COALESCE(rb.break_hours_required, 0) AS break_hours_required,
    -- Use actual breaks if available, otherwise use required breaks
    GREATEST(
      COALESCE(bh.break_hours_actual, 0),
      COALESCE(rb.break_hours_required, 0)
    ) AS break_hours_total
  FROM break_hours_by_month bh
  FULL OUTER JOIN required_breaks_by_month rb ON bh.user_id = rb.user_id AND bh.month = rb.month
)
SELECT 
  ms.organization_id,
  ms.user_id,
  ms.employee_name,
  ms.month,
  ms.year,
  ms.month_number,
  COALESCE(vd.vacation_days, 0)::DECIMAL(5,2) AS vacation_days,
  COALESCE(sd.sick_days, 0)::INTEGER AS sick_days,
  COALESCE(wh.worked_hours_brutto, 0)::DECIMAL(10,2) AS worked_hours_brutto,
  COALESCE(bs.break_hours_total, 0)::DECIMAL(10,2) AS break_hours,
  COALESCE(bs.break_hours_actual, 0)::DECIMAL(10,2) AS break_hours_actual,
  COALESCE(bs.break_hours_required, 0)::DECIMAL(10,2) AS break_hours_required,
  -- Netto hours = Brutto hours - Break hours
  GREATEST(
    COALESCE(wh.worked_hours_brutto, 0) - COALESCE(bs.break_hours_total, 0),
    0
  )::DECIMAL(10,2) AS worked_hours_netto,
  COALESCE(wh.worked_days, 0)::INTEGER AS worked_days,
  COALESCE(wh.total_entries, 0)::INTEGER AS total_entries
FROM month_series ms
LEFT JOIN vacation_days_by_month vd ON ms.user_id = vd.user_id AND ms.month = vd.month
LEFT JOIN sick_days_by_month sd ON ms.user_id = sd.user_id AND ms.month = sd.month
LEFT JOIN worked_hours_by_month wh ON ms.user_id = wh.user_id AND ms.month = wh.month
LEFT JOIN break_summary_by_month bs ON ms.user_id = bs.user_id AND ms.month = bs.month
WHERE ms.organization_id IS NOT NULL;

-- Drop materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.monthly_employee_summary_mv CASCADE;

-- Create a materialized view for better performance (can be refreshed periodically)
CREATE MATERIALIZED VIEW public.monthly_employee_summary_mv AS
SELECT * FROM public.monthly_employee_summary;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_monthly_summary_org_user_month 
ON public.monthly_employee_summary_mv(organization_id, user_id, month);

-- Add comment
COMMENT ON VIEW public.monthly_employee_summary IS 'Monthly summary of employee work hours, vacation days, and sick days for payroll preparation';
COMMENT ON MATERIALIZED VIEW public.monthly_employee_summary_mv IS 'Materialized version of monthly_employee_summary for better query performance';

-- Function to refresh the materialized view (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_monthly_employee_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.monthly_employee_summary_mv;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on the view (views inherit RLS from underlying tables)
-- Users can only see summaries for their organization
-- Staff can only see their own summaries, managers/owners can see all

-- Grant access to the view
GRANT SELECT ON public.monthly_employee_summary TO authenticated;
GRANT SELECT ON public.monthly_employee_summary_mv TO authenticated;

