-- Add position_id to users table
ALTER TABLE public.users
  ADD COLUMN position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL;

-- Create index for position_id
CREATE INDEX idx_users_position_id ON public.users(position_id);

-- Add comment
COMMENT ON COLUMN public.users.position_id IS 'Primary position of this employee.';


