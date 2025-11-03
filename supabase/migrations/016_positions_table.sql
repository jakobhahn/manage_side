-- Create positions table for shift planning
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code for UI display
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure position names are unique per organization
  UNIQUE(organization_id, name)
);

-- Create indexes for efficient querying
CREATE INDEX idx_positions_organization ON public.positions(organization_id);
CREATE INDEX idx_positions_active ON public.positions(is_active);
CREATE INDEX idx_positions_org_active ON public.positions(organization_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view positions for their organization
CREATE POLICY "Users can view positions for their organization" ON public.positions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can insert positions
CREATE POLICY "Managers can insert positions" ON public.positions
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policy: Managers and owners can update positions
CREATE POLICY "Managers can update positions" ON public.positions
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policy: Managers and owners can delete positions
CREATE POLICY "Managers can delete positions" ON public.positions
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.positions IS 'Job positions for shift planning (e.g., Server, Chef, Bartender)';
COMMENT ON COLUMN public.positions.color IS 'Hex color code for UI display';


