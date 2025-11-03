-- Create time_clock_breaks table for tracking breaks/pauses during work
CREATE TABLE IF NOT EXISTS public.time_clock_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  time_clock_entry_id UUID REFERENCES public.time_clock_entries(id) ON DELETE CASCADE NOT NULL,
  
  -- Break times
  break_start TIMESTAMP WITH TIME ZONE NOT NULL,
  break_end TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT break_end_after_break_start CHECK (break_end IS NULL OR break_end > break_start)
);

-- Create indexes
CREATE INDEX idx_time_clock_breaks_organization ON public.time_clock_breaks(organization_id);
CREATE INDEX idx_time_clock_breaks_user ON public.time_clock_breaks(user_id);
CREATE INDEX idx_time_clock_breaks_entry ON public.time_clock_breaks(time_clock_entry_id);
CREATE INDEX idx_time_clock_breaks_start ON public.time_clock_breaks(break_start);
CREATE INDEX idx_time_clock_breaks_active ON public.time_clock_breaks(time_clock_entry_id, break_end) WHERE break_end IS NULL;

-- Enable Row Level Security
ALTER TABLE public.time_clock_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own breaks
CREATE POLICY "Users can view their own breaks" ON public.time_clock_breaks
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can view all breaks in their organization
CREATE POLICY "Managers can view organization breaks" ON public.time_clock_breaks
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- RLS Policy: Users can insert their own breaks
CREATE POLICY "Users can insert their own breaks" ON public.time_clock_breaks
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own breaks
CREATE POLICY "Users can update their own breaks" ON public.time_clock_breaks
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.time_clock_breaks IS 'Break/pause entries during work time';
COMMENT ON COLUMN public.time_clock_breaks.time_clock_entry_id IS 'Reference to the time clock entry this break belongs to';
COMMENT ON COLUMN public.time_clock_breaks.break_start IS 'When the break started';
COMMENT ON COLUMN public.time_clock_breaks.break_end IS 'When the break ended (NULL if still on break)';


