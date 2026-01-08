-- Make user_id nullable in shifts table to allow open shifts (without assigned employee)
ALTER TABLE public.shifts
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN user_id DROP CONSTRAINT shifts_user_id_fkey;

-- Re-add foreign key constraint without NOT NULL
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.users(id) 
  ON DELETE CASCADE;

-- Add position_id foreign key to shifts
ALTER TABLE public.shifts
  ADD COLUMN position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL;

-- Create index for position_id
CREATE INDEX idx_shifts_position_id ON public.shifts(position_id);

-- Update comment
COMMENT ON COLUMN public.shifts.user_id IS 'Assigned employee. NULL for open shifts.';
COMMENT ON COLUMN public.shifts.position_id IS 'Required position for this shift.';
COMMENT ON COLUMN public.shifts.position IS 'Legacy position name field (deprecated, use position_id instead).';






