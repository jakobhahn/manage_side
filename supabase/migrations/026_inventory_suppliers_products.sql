-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address JSONB DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products/Menu Items table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0, -- Calculated from recipe
  sku VARCHAR(100),
  barcode VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_direct_sale BOOLEAN DEFAULT false, -- If true, directly linked to inventory item
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL, -- Direct sale link
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Recipe (Bill of Materials) - Links products to inventory items
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL, -- Quantity of inventory item needed per product unit
  unit VARCHAR(50) NOT NULL, -- Unit for the quantity
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, inventory_item_id)
);

-- Transaction Items - Links transactions to products
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- NULL if product not found
  product_name VARCHAR(255) NOT NULL, -- Store name even if product is deleted
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  raw_data JSONB, -- Store raw item data from SumUp if available
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update inventory_items to use supplier_id instead of supplier VARCHAR
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_org_id ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_inventory_item_id ON public.products(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_recipes_org_id ON public.product_recipes(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id ON public.product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_inventory_item_id ON public.product_recipes(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_org_id ON public.transaction_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON public.transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier_id ON public.inventory_items(supplier_id);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers in their organization"
  ON public.suppliers FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete suppliers"
  ON public.suppliers FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policies for products
CREATE POLICY "Users can view products in their organization"
  ON public.products FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update products"
  ON public.products FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete products"
  ON public.products FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policies for product_recipes
CREATE POLICY "Users can view product recipes in their organization"
  ON public.product_recipes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert product recipes"
  ON public.product_recipes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update product recipes"
  ON public.product_recipes FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete product recipes"
  ON public.product_recipes FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- RLS Policies for transaction_items
CREATE POLICY "Users can view transaction items in their organization"
  ON public.transaction_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "System can insert transaction items"
  ON public.transaction_items FOR INSERT
  WITH CHECK (true); -- Allow system/service role to insert

-- Function to automatically track inventory when transaction items are created
CREATE OR REPLACE FUNCTION track_inventory_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_recipe RECORD;
  v_inventory_item_id UUID;
  v_quantity_needed DECIMAL(10,2);
BEGIN
  -- Get product information
  SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id;
  
  IF v_product IS NULL THEN
    -- Product not found, skip tracking
    RETURN NEW;
  END IF;
  
  -- If product is direct sale, track inventory directly
  IF v_product.is_direct_sale AND v_product.inventory_item_id IS NOT NULL THEN
    -- Create inventory movement for direct sale
    INSERT INTO public.inventory_movements (
      organization_id,
      item_id,
      movement_type,
      quantity,
      reason,
      reference_number,
      movement_date
    ) VALUES (
      NEW.organization_id,
      v_product.inventory_item_id,
      'out',
      NEW.quantity,
      'Verkauf: ' || NEW.product_name,
      (SELECT transaction_id FROM public.payment_transactions WHERE id = NEW.transaction_id),
      NOW()
    );
  ELSE
    -- Product has recipe, track all inventory items in recipe
    FOR v_recipe IN 
      SELECT * FROM public.product_recipes 
      WHERE product_id = NEW.product_id
    LOOP
      -- Calculate quantity needed: recipe quantity * transaction quantity
      v_quantity_needed := v_recipe.quantity * NEW.quantity;
      
      -- Create inventory movement
      INSERT INTO public.inventory_movements (
        organization_id,
        item_id,
        movement_type,
        quantity,
        reason,
        reference_number,
        movement_date
      ) VALUES (
        NEW.organization_id,
        v_recipe.inventory_item_id,
        'out',
        v_quantity_needed,
        'Verkauf: ' || NEW.product_name || ' (Rezept)',
        (SELECT transaction_id FROM public.payment_transactions WHERE id = NEW.transaction_id),
        NOW()
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically track inventory when transaction items are created
CREATE TRIGGER trigger_track_inventory_from_transaction
  AFTER INSERT ON public.transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION track_inventory_from_transaction();

-- Function to update product cost from recipe
CREATE OR REPLACE FUNCTION update_product_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_recipe RECORD;
  v_product_id UUID;
BEGIN
  -- Determine which product_id to update
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;
  
  -- Calculate total cost from all recipes
  FOR v_recipe IN 
    SELECT pr.*, ii.cost_per_unit
    FROM public.product_recipes pr
    JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
    WHERE pr.product_id = v_product_id
  LOOP
    v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit, 0));
  END LOOP;
  
  -- Update product cost
  UPDATE public.products
  SET cost = v_total_cost,
      updated_at = NOW()
  WHERE id = v_product_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update product cost when inventory item cost changes
CREATE OR REPLACE FUNCTION update_product_cost_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Update cost for all products that use this inventory item in their recipe
  FOR v_product_id IN 
    SELECT DISTINCT product_id 
    FROM public.product_recipes 
    WHERE inventory_item_id = NEW.id
  LOOP
    -- Recalculate cost for this product
    PERFORM update_product_cost_for_product(v_product_id);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to update cost for a specific product
CREATE OR REPLACE FUNCTION update_product_cost_for_product(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_recipe RECORD;
BEGIN
  -- Calculate total cost from all recipes
  FOR v_recipe IN 
    SELECT pr.*, ii.cost_per_unit
    FROM public.product_recipes pr
    JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
    WHERE pr.product_id = p_product_id
  LOOP
    v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit, 0));
  END LOOP;
  
  -- Update product cost
  UPDATE public.products
  SET cost = v_total_cost,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update product cost when recipe changes
CREATE TRIGGER trigger_update_product_cost_on_recipe_change
  AFTER INSERT OR UPDATE OR DELETE ON public.product_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_product_cost();

-- Trigger to update product cost when inventory item cost changes
CREATE TRIGGER trigger_update_product_cost_on_inventory_cost_change
  AFTER UPDATE OF cost_per_unit ON public.inventory_items
  FOR EACH ROW
  WHEN (OLD.cost_per_unit IS DISTINCT FROM NEW.cost_per_unit)
  EXECUTE FUNCTION update_product_cost_from_inventory();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_product_recipes_updated_at
  BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

