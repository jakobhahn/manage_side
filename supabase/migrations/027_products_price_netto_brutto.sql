-- Add netto and brutto price fields to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS price_netto DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS price_brutto DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 19.0; -- Default 19% MwSt

-- Migrate existing price data: assume current price is brutto
UPDATE public.products
SET price_brutto = price,
    price_netto = ROUND(price / (1 + COALESCE(vat_rate, 19.0) / 100), 2)
WHERE price_brutto IS NULL;

-- Make price_brutto NOT NULL after migration
ALTER TABLE public.products
ALTER COLUMN price_brutto SET NOT NULL,
ALTER COLUMN price_brutto SET DEFAULT 0;

-- Update the update_product_cost function to also handle direct sales
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
  
  -- If product is direct sale, calculate cost from inventory item
  IF v_product.is_direct_sale AND v_product.inventory_item_id IS NOT NULL THEN
    SELECT cost_per_unit INTO v_inventory_cost
    FROM public.inventory_items
    WHERE id = v_product.inventory_item_id;
    
    v_total_cost := COALESCE(v_inventory_cost, 0);
  ELSE
    -- Calculate total cost from all recipes
    FOR v_recipe IN 
      SELECT pr.*, ii.cost_per_unit
      FROM public.product_recipes pr
      JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
      WHERE pr.product_id = v_product_id
    LOOP
      v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit, 0));
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

-- Function to update product cost when inventory item cost changes (for direct sales)
CREATE OR REPLACE FUNCTION update_product_cost_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Update cost for all products that use this inventory item
  -- Either in their recipe OR as direct sale
  FOR v_product_id IN 
    SELECT DISTINCT id 
    FROM public.products 
    WHERE (is_direct_sale = true AND inventory_item_id = NEW.id)
       OR id IN (
         SELECT DISTINCT product_id 
         FROM public.product_recipes 
         WHERE inventory_item_id = NEW.id
       )
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
  v_product RECORD;
  v_inventory_cost DECIMAL(10,2);
BEGIN
  -- Get product information
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN;
  END IF;
  
  -- If product is direct sale, calculate cost from inventory item
  IF v_product.is_direct_sale AND v_product.inventory_item_id IS NOT NULL THEN
    SELECT cost_per_unit INTO v_inventory_cost
    FROM public.inventory_items
    WHERE id = v_product.inventory_item_id;
    
    v_total_cost := COALESCE(v_inventory_cost, 0);
  ELSE
    -- Calculate total cost from all recipes
    FOR v_recipe IN 
      SELECT pr.*, ii.cost_per_unit
      FROM public.product_recipes pr
      JOIN public.inventory_items ii ON pr.inventory_item_id = ii.id
      WHERE pr.product_id = p_product_id
    LOOP
      v_total_cost := v_total_cost + (v_recipe.quantity * COALESCE(v_recipe.cost_per_unit, 0));
    END LOOP;
  END IF;
  
  -- Update product cost
  UPDATE public.products
  SET cost = v_total_cost,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update product cost when product is created or updated (for direct sales)
CREATE OR REPLACE FUNCTION update_product_cost_on_product_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If product is direct sale and inventory_item_id changed, update cost
  IF NEW.is_direct_sale AND NEW.inventory_item_id IS NOT NULL THEN
    PERFORM update_product_cost_for_product(NEW.id);
  ELSIF OLD.is_direct_sale AND (OLD.inventory_item_id IS DISTINCT FROM NEW.inventory_item_id OR OLD.is_direct_sale IS DISTINCT FROM NEW.is_direct_sale) THEN
    -- Product changed from direct sale or inventory item changed
    PERFORM update_product_cost_for_product(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update product cost when product is created or updated
CREATE TRIGGER trigger_update_product_cost_on_product_change
  AFTER INSERT OR UPDATE OF is_direct_sale, inventory_item_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_cost_on_product_change();

-- Function to automatically calculate price_brutto from price_netto and vice versa
CREATE OR REPLACE FUNCTION update_product_prices()
RETURNS TRIGGER AS $$
BEGIN
  -- If price_netto is set and price_brutto is not, calculate brutto
  IF NEW.price_netto IS NOT NULL AND (NEW.price_brutto IS NULL OR OLD.price_netto IS DISTINCT FROM NEW.price_netto) THEN
    NEW.price_brutto := ROUND(NEW.price_netto * (1 + COALESCE(NEW.vat_rate, 19.0) / 100), 2);
  -- If price_brutto is set and price_netto is not, calculate netto
  ELSIF NEW.price_brutto IS NOT NULL AND (NEW.price_netto IS NULL OR OLD.price_brutto IS DISTINCT FROM NEW.price_brutto) THEN
    NEW.price_netto := ROUND(NEW.price_brutto / (1 + COALESCE(NEW.vat_rate, 19.0) / 100), 2);
  END IF;
  
  -- Keep legacy price field in sync with brutto
  NEW.price := NEW.price_brutto;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate prices
CREATE TRIGGER trigger_update_product_prices
  BEFORE INSERT OR UPDATE OF price_netto, price_brutto, vat_rate ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_prices();



