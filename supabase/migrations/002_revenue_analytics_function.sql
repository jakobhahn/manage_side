-- Create or replace the function to update revenue analytics
CREATE OR REPLACE FUNCTION public.update_revenue_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Important for allowing the function to bypass RLS if needed, but still respect organization_id
AS $$
DECLARE
    org_id uuid;
    transaction_date date;
    total_amount numeric;
    total_count bigint;
BEGIN
    -- Determine the organization_id and transaction_date from the new transaction
    org_id := NEW.organization_id;
    transaction_date := NEW.transaction_date::date;

    -- Update daily analytics
    INSERT INTO public.revenue_analytics (organization_id, period_type, period_start, total_revenue, transaction_count, created_at, updated_at)
    VALUES (org_id, 'daily', transaction_date, NEW.amount, 1, NOW(), NOW())
    ON CONFLICT (organization_id, period_type, period_start) DO UPDATE
    SET
        total_revenue = public.revenue_analytics.total_revenue + NEW.amount,
        transaction_count = public.revenue_analytics.transaction_count + 1,
        updated_at = NOW();

    -- Update weekly analytics (start of the week)
    INSERT INTO public.revenue_analytics (organization_id, period_type, period_start, total_revenue, transaction_count, created_at, updated_at)
    VALUES (org_id, 'weekly', date_trunc('week', transaction_date)::date, NEW.amount, 1, NOW(), NOW())
    ON CONFLICT (organization_id, period_type, period_start) DO UPDATE
    SET
        total_revenue = public.revenue_analytics.total_revenue + NEW.amount,
        transaction_count = public.revenue_analytics.transaction_count + 1,
        updated_at = NOW();

    -- Update monthly analytics (start of the month)
    INSERT INTO public.revenue_analytics (organization_id, period_type, period_start, total_revenue, transaction_count, created_at, updated_at)
    VALUES (org_id, 'monthly', date_trunc('month', transaction_date)::date, NEW.amount, 1, NOW(), NOW())
    ON CONFLICT (organization_id, period_type, period_start) DO UPDATE
    SET
        total_revenue = public.revenue_analytics.total_revenue + NEW.amount,
        transaction_count = public.revenue_analytics.transaction_count + 1,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Create a trigger that calls the function after an insert on payment_transactions
CREATE OR REPLACE TRIGGER trg_update_revenue_analytics
AFTER INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_revenue_analytics();