-- Remove restrictive Staff policy to allow staff to see all shifts in their organization
-- The general "Users can view shifts for their organization" policy is sufficient

DROP POLICY IF EXISTS "Staff can view their own shifts" ON public.shifts;

COMMENT ON POLICY "Users can view shifts for their organization" ON public.shifts IS 
  'Allows all users (including staff) in an organization to view all shifts in their organization';






