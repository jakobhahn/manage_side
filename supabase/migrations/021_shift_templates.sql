-- Create shift_templates table for storing shift templates
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shift_template_items table for storing individual shift items in a template
CREATE TABLE IF NOT EXISTS public.shift_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES public.shift_templates(id) ON DELETE CASCADE NOT NULL,
  
  -- Shift details (relative to week start)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Monday, 6 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Shift assignment
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for open shifts
  position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  
  -- Additional details
  notes TEXT,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed')),
  
  -- Order within template
  sort_order INTEGER DEFAULT 0,
  
  -- Ensure end_time is after start_time
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shift_templates_organization ON public.shift_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_template_items_template ON public.shift_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_shift_template_items_user ON public.shift_template_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_template_items_position ON public.shift_template_items(position_id);

-- Enable Row Level Security
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_template_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view templates for their organization
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shift_templates' 
    AND policyname = 'Users can view templates for their organization'
  ) THEN
    CREATE POLICY "Users can view templates for their organization" ON public.shift_templates
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM public.users 
          WHERE auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS Policy: Managers and owners can manage templates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shift_templates' 
    AND policyname = 'Managers can manage templates'
  ) THEN
    CREATE POLICY "Managers can manage templates" ON public.shift_templates
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM public.users 
          WHERE auth_id = auth.uid() 
          AND role IN ('manager', 'owner')
        )
      );
  END IF;
END $$;

-- RLS Policy: Users can view template items for their organization's templates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shift_template_items' 
    AND policyname = 'Users can view template items'
  ) THEN
    CREATE POLICY "Users can view template items" ON public.shift_template_items
      FOR SELECT USING (
        template_id IN (
          SELECT id FROM public.shift_templates
          WHERE organization_id IN (
            SELECT organization_id FROM public.users 
            WHERE auth_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- RLS Policy: Managers and owners can manage template items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shift_template_items' 
    AND policyname = 'Managers can manage template items'
  ) THEN
    CREATE POLICY "Managers can manage template items" ON public.shift_template_items
      FOR ALL USING (
        template_id IN (
          SELECT id FROM public.shift_templates
          WHERE organization_id IN (
            SELECT organization_id FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role IN ('manager', 'owner')
          )
        )
      );
  END IF;
END $$;

-- Add unique constraint for template name per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_templates_org_name ON public.shift_templates(organization_id, name);

