
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view data" ON public.daily_contrast_data;
DROP POLICY IF EXISTS "Authenticated users can insert data" ON public.daily_contrast_data;
DROP POLICY IF EXISTS "Authenticated users can update data" ON public.daily_contrast_data;

-- Create email-restricted policies
CREATE POLICY "Authorized email can view data"
ON public.daily_contrast_data FOR SELECT
TO authenticated
USING (auth.jwt()->>'email' = 'btradiographers@gmail.com');

CREATE POLICY "Authorized email can insert data"
ON public.daily_contrast_data FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'email' = 'btradiographers@gmail.com');

CREATE POLICY "Authorized email can update data"
ON public.daily_contrast_data FOR UPDATE
TO authenticated
USING (auth.jwt()->>'email' = 'btradiographers@gmail.com');
