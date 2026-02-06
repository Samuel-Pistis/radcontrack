
-- Create table for daily contrast data (shared, no auth required)
CREATE TABLE public.daily_contrast_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_contrast_data ENABLE ROW LEVEL SECURITY;

-- Public access policies (no login required)
CREATE POLICY "Anyone can view daily data"
  ON public.daily_contrast_data FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert daily data"
  ON public.daily_contrast_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update daily data"
  ON public.daily_contrast_data FOR UPDATE
  USING (true);

-- Index on date for fast lookups
CREATE INDEX idx_daily_contrast_date ON public.daily_contrast_data (date);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_daily_contrast_updated_at
  BEFORE UPDATE ON public.daily_contrast_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
