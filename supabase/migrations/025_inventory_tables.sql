-- Inventory Management Module
-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  current_stock DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  reorder_point DECIMAL(10,2) DEFAULT 0,
  reorder_quantity DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  supplier VARCHAR(255),
  supplier_contact JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'waste', 'transfer')),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  reason TEXT,
  reference_number VARCHAR(100),
  performed_by UUID REFERENCES public.users(id),
  movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_id ON public.inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_id ON public.inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON public.inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
CREATE POLICY "Users can view inventory items in their organization"
  ON public.inventory_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert inventory items"
  ON public.inventory_items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update inventory items"
  ON public.inventory_items FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete inventory items"
  ON public.inventory_items FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policies for inventory_movements
CREATE POLICY "Users can view inventory movements in their organization"
  ON public.inventory_movements FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert inventory movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update inventory movements"
  ON public.inventory_movements FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete inventory movements"
  ON public.inventory_movements FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- Function to update inventory stock when movement is created
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE public.inventory_items
    SET current_stock = current_stock + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  ELSIF NEW.movement_type IN ('out', 'waste') THEN
    UPDATE public.inventory_items
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    -- For adjustments, we need to calculate the difference
    -- This assumes adjustment quantity is the new desired stock level
    -- You might want to adjust this logic based on your needs
    UPDATE public.inventory_items
    SET current_stock = NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update stock
CREATE TRIGGER trigger_update_inventory_stock
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory_items updated_at
CREATE TRIGGER trigger_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();



