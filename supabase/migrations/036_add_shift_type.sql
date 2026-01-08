-- Create shift_type enum
CREATE TYPE shift_type AS ENUM ('normal', 'urlaub', 'krankheit');

-- Add shift_type column to shifts table
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS shift_type shift_type DEFAULT 'normal';

-- Add comment for documentation
COMMENT ON COLUMN public.shifts.shift_type IS 'Type of shift: normal (regular work shift), urlaub (vacation), or krankheit (sick leave)';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_shifts_shift_type ON public.shifts(shift_type);


