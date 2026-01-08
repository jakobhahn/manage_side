-- Add is_sick column to time_clock_entries for marking sick days
ALTER TABLE public.time_clock_entries
ADD COLUMN IF NOT EXISTS is_sick BOOLEAN DEFAULT false;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_is_sick ON public.time_clock_entries(is_sick) WHERE is_sick = true;

-- Add comment
COMMENT ON COLUMN public.time_clock_entries.is_sick IS 'True if the employee marked themselves as sick when clocking in/out';


