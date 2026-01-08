-- Add netto and brutto cost fields to inventory_items
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS cost_per_unit_netto DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cost_per_unit_brutto DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 19.0; -- Default 19% MwSt

-- Migrate existing cost_per_unit data: assume current cost is brutto
UPDATE public.inventory_items
SET cost_per_unit_brutto = cost_per_unit,
    cost_per_unit_netto = ROUND(cost_per_unit / (1 + COALESCE(vat_rate, 19.0) / 100), 2)
WHERE cost_per_unit_brutto IS NULL AND cost_per_unit > 0;

-- Make cost_per_unit_brutto NOT NULL after migration (default to 0)
ALTER TABLE public.inventory_items
ALTER COLUMN cost_per_unit_brutto SET DEFAULT 0;

-- Function to automatically calculate cost_per_unit_brutto from cost_per_unit_netto and vice versa
CREATE OR REPLACE FUNCTION update_inventory_item_costs()
RETURNS TRIGGER AS $$
BEGIN
  -- If cost_per_unit_netto is set and cost_per_unit_brutto is not, calculate brutto
  IF NEW.cost_per_unit_netto IS NOT NULL AND (NEW.cost_per_unit_brutto IS NULL OR OLD.cost_per_unit_netto IS DISTINCT FROM NEW.cost_per_unit_netto) THEN
    NEW.cost_per_unit_brutto := ROUND(NEW.cost_per_unit_netto * (1 + COALESCE(NEW.vat_rate, 19.0) / 100), 2);
  -- If cost_per_unit_brutto is set and cost_per_unit_netto is not, calculate netto
  ELSIF NEW.cost_per_unit_brutto IS NOT NULL AND (NEW.cost_per_unit_netto IS NULL OR OLD.cost_per_unit_brutto IS DISTINCT FROM NEW.cost_per_unit_brutto) THEN
    NEW.cost_per_unit_netto := ROUND(NEW.cost_per_unit_brutto / (1 + COALESCE(NEW.vat_rate, 19.0) / 100), 2);
  END IF;
  
  -- Keep legacy cost_per_unit field in sync with brutto
  NEW.cost_per_unit := NEW.cost_per_unit_brutto;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate costs
CREATE TRIGGER trigger_update_inventory_item_costs
  BEFORE INSERT OR UPDATE OF cost_per_unit_netto, cost_per_unit_brutto, vat_rate ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_item_costs();

-- Update the product cost calculation functions to use cost_per_unit_brutto or cost_per_unit_netto
-- The functions should use cost_per_unit_netto for cost calculations (since we want netto costs)
CREATE OR REPLACE FUNCTION update_product_cost_for_product(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_recipe RECORD;
  v_product RECORD;
  v_inventory_cost DECIMAL(10,2);
BEGIN
  -- Get product information
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN;
  END IF;
  
  -- If product is direct sale, calculate cost from inventory item (use netto cost)
  IF v_product.is_direct_sale AND v_product.inventory_item_id IS NOT NULL THEN
    SELECT COALESCE(cost_per_unit_netto, cost_per_unit) INTO v_inventory_cost
    FROM public.inventory_items
    WHERE id = v_product.inventory_item_id;
    
    v_total_cost := COALESCE(v_inventory_cost, 0);
  ELSE
    -- Calculate total cost from all recipes (use netto costs)
    FOR v_recipe IN 
      SELECT pr.*, COALESCE(ii.cost_per_unit_netto, ii.cost_per_unit) as cost_per_unit_netto
      FROM public.product_recipes pr
      JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
      WHERE pr.product_id = p_product_id
    LOOP
      v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit_netto, 0));
    END LOOP;
  END IF;
  
  -- Update product cost
  UPDATE public.products
  SET cost = v_total_cost,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Update the main update_product_cost function
CREATE OR REPLACE FUNCTION update_product_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_recipe RECORD;
  v_product_id UUID;
  v_product RECORD;
  v_inventory_cost DECIMAL(10,2);
BEGIN
  -- Determine which product_id to update
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;
  
  -- Get product information
  SELECT * INTO v_product FROM public.products WHERE id = v_product_id;
  
  IF v_product IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- If product is direct sale, calculate cost from inventory item (use netto cost)
  IF v_product.is_direct_sale AND v_product.inventory_item_id IS NOT NULL THEN
    SELECT COALESCE(cost_per_unit_netto, cost_per_unit) INTO v_inventory_cost
    FROM public.inventory_items
    WHERE id = v_product.inventory_item_id;
    
    v_total_cost := COALESCE(v_inventory_cost, 0);
  ELSE
    -- Calculate total cost from all recipes (use netto costs)
    FOR v_recipe IN 
      SELECT pr.*, COALESCE(ii.cost_per_unit_netto, ii.cost_per_unit) as cost_per_unit_netto
      FROM public.product_recipes pr
      JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
      WHERE pr.product_id = v_product_id
    LOOP
      v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit_netto, 0));
    END LOOP;
  END IF;
  
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



