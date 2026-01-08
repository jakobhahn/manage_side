-- Create vacation_balances table for tracking vacation days per employee per year
CREATE TABLE IF NOT EXISTS public.vacation_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  total_days DECIMAL(5,2) NOT NULL DEFAULT 0, -- Total vacation days for the year
  used_days DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Days already used
  remaining_days DECIMAL(5,2) GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id, year)
);

-- Create vacation_requests table for vacation requests
CREATE TYPE vacation_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(5,2) NOT NULL, -- Number of vacation days requested
  status vacation_request_status NOT NULL DEFAULT 'pending',
  reason TEXT, -- Optional reason for the request
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.users(id), -- Manager/owner who reviewed
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT, -- Optional notes from reviewer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT positive_days CHECK (days > 0)
);

-- Create indexes
CREATE INDEX idx_vacation_balances_organization ON public.vacation_balances(organization_id);
CREATE INDEX idx_vacation_balances_user ON public.vacation_balances(user_id);
CREATE INDEX idx_vacation_balances_year ON public.vacation_balances(year);
CREATE INDEX idx_vacation_requests_organization ON public.vacation_requests(organization_id);
CREATE INDEX idx_vacation_requests_user ON public.vacation_requests(user_id);
CREATE INDEX idx_vacation_requests_status ON public.vacation_requests(status);
CREATE INDEX idx_vacation_requests_dates ON public.vacation_requests(start_date, end_date);
CREATE INDEX idx_vacation_requests_reviewed_by ON public.vacation_requests(reviewed_by);

-- Enable Row Level Security
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_balances
CREATE POLICY "Users can view their own vacation balance" ON public.vacation_balances
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view organization vacation balances" ON public.vacation_balances
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

CREATE POLICY "Managers can insert vacation balances" ON public.vacation_balances
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

CREATE POLICY "Managers can update vacation balances" ON public.vacation_balances
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- RLS Policies for vacation_requests
CREATE POLICY "Users can view their own vacation requests" ON public.vacation_requests
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view organization vacation requests" ON public.vacation_requests
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

CREATE POLICY "Users can insert their own vacation requests" ON public.vacation_requests
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own pending vacation requests" ON public.vacation_requests
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    ) AND status = 'pending'
  );

CREATE POLICY "Managers can update vacation requests for approval" ON public.vacation_requests
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- Add comments
COMMENT ON TABLE public.vacation_balances IS 'Vacation day balances per employee per year';
COMMENT ON TABLE public.vacation_requests IS 'Vacation requests from employees that need manager approval';
COMMENT ON COLUMN public.vacation_balances.total_days IS 'Total vacation days allocated for the year';
COMMENT ON COLUMN public.vacation_balances.used_days IS 'Vacation days already used (updated when requests are approved)';
COMMENT ON COLUMN public.vacation_requests.days IS 'Number of vacation days requested (calculated from start_date to end_date)';
COMMENT ON COLUMN public.vacation_requests.status IS 'Status of the vacation request: pending, approved, rejected, or cancelled';


