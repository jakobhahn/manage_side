-- Create time_clock_entries table for time clock functionality
CREATE TABLE IF NOT EXISTS public.time_clock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  
  -- Clock times
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  
  -- Validation and warnings
  shift_start_time TIMESTAMP WITH TIME ZONE, -- Planned shift start time
  shift_end_time TIMESTAMP WITH TIME ZONE,   -- Planned shift end time
  clock_in_deviation_minutes INTEGER,         -- Deviation from planned time in minutes
  clock_out_deviation_minutes INTEGER,        -- Deviation from planned time in minutes
  has_warning BOOLEAN DEFAULT false,           -- True if deviation > 30 minutes
  
  -- Approval
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional info
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT clock_out_after_clock_in CHECK (clock_out IS NULL OR clock_out > clock_in)
);

-- Create indexes
CREATE INDEX idx_time_clock_entries_organization ON public.time_clock_entries(organization_id);
CREATE INDEX idx_time_clock_entries_user ON public.time_clock_entries(user_id);
CREATE INDEX idx_time_clock_entries_shift ON public.time_clock_entries(shift_id);
CREATE INDEX idx_time_clock_entries_clock_in ON public.time_clock_entries(clock_in);
CREATE INDEX idx_time_clock_entries_approved ON public.time_clock_entries(is_approved);
CREATE INDEX idx_time_clock_entries_warning ON public.time_clock_entries(has_warning);

-- Enable Row Level Security
ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own time entries
CREATE POLICY "Users can view their own time entries" ON public.time_clock_entries
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can view all time entries in their organization
CREATE POLICY "Managers can view organization time entries" ON public.time_clock_entries
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- RLS Policy: Users can insert their own time entries (clock in/out)
CREATE POLICY "Users can insert their own time entries" ON public.time_clock_entries
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own time entries (only clock_out if clock_in exists)
CREATE POLICY "Users can update their own time entries" ON public.time_clock_entries
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can update time entries (approval)
CREATE POLICY "Managers can update time entries for approval" ON public.time_clock_entries
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- Add comment
COMMENT ON TABLE public.time_clock_entries IS 'Time clock entries for tracking actual work hours vs planned shifts';
COMMENT ON COLUMN public.time_clock_entries.shift_id IS 'Reference to the planned shift (can be null if no shift planned)';
COMMENT ON COLUMN public.time_clock_entries.clock_in_deviation_minutes IS 'Difference in minutes between clock_in and planned shift start_time';
COMMENT ON COLUMN public.time_clock_entries.has_warning IS 'True if deviation from planned time is more than 30 minutes';
COMMENT ON COLUMN public.time_clock_entries.is_approved IS 'True if manager/owner has approved the time entry';






