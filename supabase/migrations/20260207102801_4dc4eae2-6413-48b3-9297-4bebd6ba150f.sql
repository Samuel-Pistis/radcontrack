
-- Drop existing public policies
DROP POLICY IF EXISTS "Anyone can view daily data" ON public.daily_contrast_data;
DROP POLICY IF EXISTS "Anyone can insert daily data" ON public.daily_contrast_data;
DROP POLICY IF EXISTS "Anyone can update daily data" ON public.daily_contrast_data;

-- Create auth-required policies
CREATE POLICY "Authenticated users can view data"
ON public.daily_contrast_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert data"
ON public.daily_contrast_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update data"
ON public.daily_contrast_data FOR UPDATE
TO authenticated
USING (true);

-- Prevent deletes
CREATE POLICY "Prevent deletes"
ON public.daily_contrast_data FOR DELETE
USING (false);
