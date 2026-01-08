-- Update the track_inventory_from_transaction function to use transaction_date from payment_transactions
CREATE OR REPLACE FUNCTION track_inventory_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_recipe RECORD;
  v_inventory_item_id UUID;
  v_quantity_needed DECIMAL(10,2);
  v_transaction_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get transaction date from payment_transactions
  SELECT transaction_date INTO v_transaction_date
  FROM public.payment_transactions
  WHERE id = NEW.transaction_id;
  
  -- If transaction date not found, use current time as fallback
  IF v_transaction_date IS NULL THEN
    v_transaction_date := NOW();
  END IF;
  
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
      v_transaction_date
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
        v_transaction_date
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing inventory movements that have a reference_number matching a transaction_id
-- to use the transaction_date from payment_transactions
UPDATE public.inventory_movements im
SET movement_date = pt.transaction_date
FROM public.payment_transactions pt
WHERE im.reference_number = pt.transaction_id
  AND im.organization_id = pt.organization_id
  AND im.movement_date != pt.transaction_date;



