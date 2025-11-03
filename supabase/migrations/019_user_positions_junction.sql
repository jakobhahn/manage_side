-- Create junction table for many-to-many relationship between users and positions
CREATE TABLE public.user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, position_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_positions_user_id ON public.user_positions(user_id);
CREATE INDEX idx_user_positions_position_id ON public.user_positions(position_id);

-- Enable Row Level Security
ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own position assignments
CREATE POLICY "Users can view their own position assignments" ON public.user_positions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can view all position assignments in their organization
CREATE POLICY "Managers can view position assignments" ON public.user_positions
  FOR SELECT USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.organization_id IN (
        SELECT organization_id FROM public.users 
        WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- RLS Policy: Managers and owners can insert position assignments
CREATE POLICY "Managers can insert position assignments" ON public.user_positions
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.organization_id IN (
        SELECT organization_id FROM public.users 
        WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- RLS Policy: Managers and owners can delete position assignments
CREATE POLICY "Managers can delete position assignments" ON public.user_positions
  FOR DELETE USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.organization_id IN (
        SELECT organization_id FROM public.users 
        WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

COMMENT ON TABLE public.user_positions IS 'Junction table for many-to-many relationship between users and positions.';


