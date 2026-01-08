-- Create shifts table for shift planning module
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Shift timing
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Shift details
  position VARCHAR(100),
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  hourly_rate DECIMAL(8,2),
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure end_time is after start_time
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- Create indexes for efficient querying
CREATE INDEX idx_shifts_organization ON public.shifts(organization_id);
CREATE INDEX idx_shifts_user ON public.shifts(user_id);
CREATE INDEX idx_shifts_start_time ON public.shifts(start_time);
CREATE INDEX idx_shifts_status ON public.shifts(status);
CREATE INDEX idx_shifts_org_start ON public.shifts(organization_id, start_time);

-- Enable Row Level Security
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view shifts for their organization
CREATE POLICY "Users can view shifts for their organization" ON public.shifts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Staff can view their own shifts
CREATE POLICY "Staff can view their own shifts" ON public.shifts
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can insert shifts
CREATE POLICY "Managers can insert shifts" ON public.shifts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policy: Managers and owners can update shifts
CREATE POLICY "Managers can update shifts" ON public.shifts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policy: Managers and owners can delete shifts
CREATE POLICY "Managers can delete shifts" ON public.shifts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.shifts IS 'Employee shift schedules for the shift planning module';
COMMENT ON COLUMN public.shifts.status IS 'Shift status: scheduled, confirmed, completed, or cancelled';
COMMENT ON COLUMN public.shifts.position IS 'Job position for this shift (e.g., Server, Chef, Host)';
COMMENT ON COLUMN public.shifts.created_by IS 'User ID of the person who created this shift';






